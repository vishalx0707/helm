'use strict';

/**
 * HELM Relay — the dumb middle.
 *
 * The laptop (HOST) is behind home NAT, so it can't accept inbound connections.
 * Instead BOTH sides dial OUT to this relay. The relay pairs the two sockets that
 * present the same session `token` and forwards messages between them. That's it:
 *   - no storage of user data (no code, no secrets, no task content persisted)
 *   - no business logic (it never reads `submit_task`/`output` payloads)
 *   - just routing + connect/disconnect bookkeeping
 *
 * It also serves the browser "phone simulator" at /sim so the whole pipe can be
 * exercised from a laptop before the real mobile app exists.
 *
 * TLS: in dev this listens on plain http/ws; a tunnel (cloudflared/ngrok) in front
 * provides wss:// to the phone. Production TLS is a roadmap item, not an MVP blocker.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { RELAY_PORT, T, RELAY_CONTROL } = require('./protocol');
const { createPairingCodes } = require('./pairing');

const PORT = process.env.PORT || RELAY_PORT;

// --- abuse limits (the relay is publicly reachable; everything below assumes a
// hostile internet, not a trusted LAN) ---
const MAX_FRAME_BYTES = 256 * 1024;   // reject oversized WS frames (memory DoS)
const MAX_SESSIONS = 5000;            // ceiling on concurrent token slots
const MAX_CONNS_PER_IP = 30;          // concurrent sockets allowed from one source
const MAX_MSGS_PER_SOCKET = 240;      // messages/window before a socket is dropped
const MSG_WINDOW_MS = 10_000;         // sliding window for the per-socket message cap

// token -> { host: ws|null, client: ws|null }
const sessions = new Map();
// source IP -> live socket count, so one address can't exhaust the relay.
const connsByIp = new Map();

// Short-lived 6-digit pairing codes -> durable host token (in memory only,
// CSPRNG-generated, one-time, TTL- and rate-limited; see pairing.js).
//   maxAttempts:       per-source redeem guesses per minute (10 leaves room for a
//                      few fat-finger retries — and many users behind one CGNAT
//                      address — while keeping a single IP to ~100 guesses over a
//                      code's 10-min life, i.e. 1e-4 of the space).
//   maxGlobalAttempts: a ceiling across ALL sources, so a botnet can't walk the
//                      space in parallel (it can only slow legitimate pairing).
const pairCodes = createPairingCodes({ maxAttempts: 10, maxGlobalAttempts: 60 });

function getSession(token) {
  let s = sessions.get(token);
  if (!s) { s = { host: null, client: null }; sessions.set(token, s); }
  return s;
}

function send(ws, type, payload = {}) {
  if (ws && ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify({ type, ...payload })); } catch { /* socket gone */ }
  }
}

// Behind Render/Fly/Cloudflare the TLS terminator sets x-forwarded-for; the
// leftmost entry is the originating client. Fall back to the socket address.
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// ---- static: the browser phone simulator ----
const SIM_DIR = path.join(__dirname, 'sim');
function serveSim(pathname, res) {
  const rel = pathname === '/sim' || pathname === '/sim/' ? 'index.html'
            : pathname.replace(/^\/sim\//, '');
  const file = path.join(SIM_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(SIM_DIR)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    const ext = path.extname(file);
    const mime = ext === '.html' ? 'text/html'
               : ext === '.js' ? 'text/javascript'
               : ext === '.css' ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': mime });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  // Route on the pathname only — a query string (e.g. /sim?token=… from a scanned
  // QR) must not defeat the match.
  const pathname = req.url.split('?')[0];
  if (pathname === '/' || pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    // Don't leak live usage counts to anonymous callers — just liveness.
    res.end(JSON.stringify({ ok: true, service: 'helm-relay' }));
    return;
  }
  if (pathname === '/sim' || pathname.startsWith('/sim/')) return serveSim(pathname, res);
  res.writeHead(404).end('not found');
});

const wss = new WebSocketServer({ server, maxPayload: MAX_FRAME_BYTES });
// Never let a socket/server error propagate to an uncaught exception.
wss.on('error', (err) => console.error('[helm-relay] wss error:', err.message));

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);

  // Per-IP connection ceiling: refuse a source that's already holding too many
  // sockets, so it can't exhaust file descriptors or bypass redeem throttling
  // by fanning out across many concurrent connections.
  const open = connsByIp.get(ip) || 0;
  if (open >= MAX_CONNS_PER_IP) {
    send(ws, T.RELAY_ERROR, { message: 'too many connections' });
    try { ws.close(); } catch {}
    return;
  }
  connsByIp.set(ip, open + 1);

  ws.ip = ip;
  ws.token = null;
  ws.role = null;
  ws.isAlive = true;
  ws.msgTimes = [];       // recent message timestamps (per-socket flood guard)
  ws.on('pong', () => { ws.isAlive = true; });
  // MUST listen for 'error': ws emits it on protocol violations (e.g. a frame
  // over maxPayload). With no listener, Node rethrows and crashes the whole
  // relay — so a single oversized frame from anyone would be a one-shot DoS.
  ws.on('error', () => { try { ws.close(); } catch {} });

  ws.on('message', (raw) => {
    // Per-socket message-rate guard: drop a socket that floods us regardless of
    // content. maxPayload already bounds each frame's size.
    const tnow = Date.now();
    ws.msgTimes = ws.msgTimes.filter((ts) => tnow - ts < MSG_WINDOW_MS);
    ws.msgTimes.push(tnow);
    if (ws.msgTimes.length > MAX_MSGS_PER_SOCKET) {
      send(ws, T.RELAY_ERROR, { message: 'rate limit' });
      try { ws.close(); } catch {}
      return;
    }

    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    // --- registration ---
    if (msg.type === T.HOST_HELLO || msg.type === T.CLIENT_HELLO) {
      const token = typeof msg.token === 'string' && msg.token.length ? msg.token : null;
      if (!token) { send(ws, T.RELAY_ERROR, { message: 'missing token' }); return; }
      const role = msg.type === T.HOST_HELLO ? 'host' : 'client';

      // Cap distinct sessions so an attacker can't grow the map without bound by
      // registering endless random tokens. Existing sessions are always allowed.
      if (!sessions.has(token) && sessions.size >= MAX_SESSIONS) {
        send(ws, T.RELAY_ERROR, { message: 'relay at capacity, try again later' });
        return;
      }
      const s = getSession(token);

      // One socket per slot: replace a stale one if a fresh connection arrives.
      if (s[role] && s[role] !== ws) { try { s[role].close(); } catch {} }
      s[role] = ws;
      ws.token = token;
      ws.role = role;

      // Tell each side whether its peer is already present.
      const peerRole = role === 'host' ? 'client' : 'host';
      send(ws, s[peerRole] ? T.PEER_ONLINE : T.PEER_OFFLINE);
      if (s[peerRole]) send(s[peerRole], T.PEER_ONLINE);
      return;
    }

    // --- 6-digit pairing codes ---
    if (msg.type === T.PAIR_NEW) {
      // Only a registered host can request a code
      if (!ws.token || ws.role !== 'host') {
        send(ws, T.RELAY_ERROR, { message: 'must register as host first' });
        return;
      }
      const result = pairCodes.mint(ws.token);
      if (result.error) { send(ws, T.PAIR_ERROR, { message: result.error }); return; }
      send(ws, T.PAIR_CODE, result);
      return;
    }

    if (msg.type === T.PAIR_REDEEM) {
      const code = typeof msg.code === 'string' ? msg.code.trim() : '';
      if (!/^\d{6}$/.test(code)) { send(ws, T.PAIR_ERROR, { message: 'invalid or expired code' }); return; }
      // Rate-limited per source IP (and globally) inside pairCodes — keyed on the
      // address, not the socket, so reconnecting can't reset the attempt count.
      const r = pairCodes.redeem(code, ws.ip);
      if (r.error) { send(ws, T.PAIR_ERROR, { message: r.error }); return; }
      send(ws, T.PAIR_OK, { token: r.token });
      return;
    }

    if (msg.type === T.PING) { send(ws, T.PONG); return; }
    if (msg.type === T.PONG) return;

    // --- forwarding: everything else goes to the peer, untouched ---
    if (!ws.token || !ws.role) { send(ws, T.RELAY_ERROR, { message: 'not registered' }); return; }
    if (RELAY_CONTROL.has(msg.type)) return; // control types are never forwarded
    const s = sessions.get(ws.token);
    const peer = s && s[ws.role === 'host' ? 'client' : 'host'];
    if (!peer) { send(ws, T.PEER_OFFLINE); return; }
    if (peer.readyState === peer.OPEN) peer.send(raw.toString());
  });

  ws.on('close', () => {
    // Always release this socket's slot in the per-IP count — including throwaway
    // redeem sockets that never registered a token/role.
    const n = (connsByIp.get(ws.ip) || 1) - 1;
    if (n <= 0) connsByIp.delete(ws.ip);
    else connsByIp.set(ws.ip, n);

    if (!ws.token || !ws.role) return;
    const s = sessions.get(ws.token);
    if (!s) return;
    if (s[ws.role] === ws) s[ws.role] = null;
    const peer = s[ws.role === 'host' ? 'client' : 'host'];
    if (peer) send(peer, T.PEER_OFFLINE);
    if (!s.host && !s.client) sessions.delete(ws.token);
  });
});

// Drop dead sockets so a slot doesn't stay falsely "online".
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

// Reclaim expired codes and stale rate-limit buckets every 60s.
const codeSweep = setInterval(() => pairCodes.gc(), 60_000);
if (codeSweep.unref) codeSweep.unref();
wss.on('close', () => clearInterval(codeSweep));

server.listen(PORT, () => {
  console.log(`[helm-relay] listening on http://localhost:${PORT}`);
  console.log(`[helm-relay] phone simulator at http://localhost:${PORT}/sim`);
});
