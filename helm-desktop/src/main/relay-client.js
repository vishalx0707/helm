'use strict';

const WebSocket = require('ws');
const pairing = require('./pairing');
const projects = require('./projects');
const agents = require('./agents');
const runner = require('./runner');

/**
 * Relay client — the laptop's persistent outbound link to the relay.
 *
 * The laptop is behind home NAT, so it dials OUT and stays connected. It registers
 * as the HOST for this session token, then answers the phone's requests forwarded
 * by the relay:
 *   - `list`        -> reply with the catalog (allowlisted projects + detected agents)
 *   - `submit_task` -> hand to runner.js, stream its events back to the phone
 *   - `ping`        -> `pong`
 *
 * Reconnects automatically with capped exponential backoff so the laptop is always
 * reachable while the app is open.
 */

let ws = null;
let connected = false;      // socket open to the relay
let peerOnline = false;     // a phone is paired on the other side
let stopped = false;
let backoff = 1000;
let reconnectTimer = null;
let pingTimer = null;       // app-level keepalive so the relay sees traffic
let statusCb = null;
let taskCb = null;

function getStatus() {
  return { relayConnected: connected, peerOnline };
}

function onStatus(cb) { statusCb = cb; }
function emitStatus() { if (statusCb) try { statusCb(getStatus()); } catch {} }

// Display-only mirror of the in-flight task to the desktop UI (the Status frame).
// This does NOT touch the wire protocol or spawn anything — it echoes the same
// runner events the laptop already produces locally so the renderer can show the
// laptop side of a run. The phone still receives the authoritative stream.
function onTask(cb) { taskCb = cb; }
function emitTask(ev) { if (taskCb) try { taskCb(ev); } catch {} }

function send(type, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ type, ...payload })); } catch {}
  }
}

function connect() {
  const url = pairing.relayUrl();
  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    connected = true;
    backoff = 1000;
    send('host_hello', { token: pairing.token() });
    // Request a 6-digit pairing code from the relay
    send('pair_new', {});
    // App-level keepalive so the relay's 30s heartbeat always sees traffic.
    // Mirrors the mobile's 20s ping. 25s avoids hitting the 30s deadline.
    clearInterval(pingTimer);
    pingTimer = setInterval(() => send('ping'), 25000);
    emitStatus();
  });

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    handle(m);
  });

  ws.on('close', () => {
    connected = false;
    peerOnline = false;
    clearInterval(pingTimer);
    emitStatus();
    scheduleReconnect();
  });

  // Swallow errors; the 'close' that follows drives reconnect.
  ws.on('error', () => {});
}

function handle(m) {
  switch (m.type) {
    case 'peer_online':
      peerOnline = true; emitStatus(); break;
    case 'peer_offline':
      peerOnline = false; emitStatus(); break;
    case 'ping':
      send('pong'); break;
    case 'list':
      send('catalog', { projects: projects.list(), agents: agents.list() });
      break;
    case 'submit_task': {
      const meta = { projectId: m.projectId, agentId: m.agentId, task: m.task };
      // mirror the submission to the desktop UI, then mirror every runner event
      emitTask({ type: 'submit_task', ...meta });
      runner.run(meta, (type, payload) => {
        send(type, payload);          // authoritative stream to the phone
        emitTask({ type, ...payload }); // local echo to the desktop renderer
      });
      break;
    }
    case 'pair_code':
      // Relay returned a 6-digit code for this host
      pairing.setCode(m.code, m.ttl);
      emitStatus();  // tell the renderer to refresh the pairing panel
      break;
    // relay_error / pong / unknown → ignore
  }
}

function scheduleReconnect() {
  if (stopped) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 15000);
}

function start() {
  stopped = false;
  backoff = 1000;
  connect();
}

function stop() {
  stopped = true;
  clearTimeout(reconnectTimer);
  clearInterval(pingTimer);
  if (ws) { try { ws.close(); } catch {} }
}

/** Reconnect with the current settings (e.g. after the relay URL changes). */
function restart() {
  stop();
  start();
}

/** Request a fresh 6-digit pairing code without rotating the durable token. */
function requestNewCode() {
  send('pair_new', {});
}

module.exports = { start, stop, restart, requestNewCode, getStatus, onStatus, onTask };
