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

const PORT = process.env.PORT || RELAY_PORT;

// token -> { host: ws|null, client: ws|null }
const sessions = new Map();

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
    res.end(JSON.stringify({ ok: true, service: 'helm-relay', sessions: sessions.size }));
    return;
  }
  if (pathname === '/sim' || pathname.startsWith('/sim/')) return serveSim(pathname, res);
  res.writeHead(404).end('not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.token = null;
  ws.role = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    // --- registration ---
    if (msg.type === T.HOST_HELLO || msg.type === T.CLIENT_HELLO) {
      const token = typeof msg.token === 'string' && msg.token.length ? msg.token : null;
      if (!token) { send(ws, T.RELAY_ERROR, { message: 'missing token' }); return; }
      const role = msg.type === T.HOST_HELLO ? 'host' : 'client';
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

server.listen(PORT, () => {
  console.log(`[helm-relay] listening on http://localhost:${PORT}`);
  console.log(`[helm-relay] phone simulator at http://localhost:${PORT}/sim`);
});
