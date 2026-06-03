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
let statusCb = null;

function getStatus() {
  return { relayConnected: connected, peerOnline };
}

function onStatus(cb) { statusCb = cb; }
function emitStatus() { if (statusCb) try { statusCb(getStatus()); } catch {} }

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
    case 'submit_task':
      runner.run(
        { projectId: m.projectId, agentId: m.agentId, task: m.task },
        (type, payload) => send(type, payload)
      );
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
  if (ws) { try { ws.close(); } catch {} }
}

/** Reconnect with the current settings (e.g. after the relay URL changes). */
function restart() {
  stop();
  start();
}

module.exports = { start, stop, restart, getStatus, onStatus };
