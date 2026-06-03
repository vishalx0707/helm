'use strict';

/**
 * HELM phone simulator — a browser stand-in for HELM Mobile.
 *
 * It speaks the exact same wire protocol the real Expo app will use, so getting
 * the full Project -> Agent -> Task -> Progress -> Result flow working here proves
 * the whole pipe (relay + desktop runner) before any mobile code exists.
 */

// Mirror of helm-relay/protocol.js (kept inline so the page has no build step).
const T = {
  CLIENT_HELLO: 'client_hello',
  PEER_ONLINE: 'peer_online', PEER_OFFLINE: 'peer_offline', RELAY_ERROR: 'relay_error',
  PING: 'ping', PONG: 'pong',
  LIST: 'list', CATALOG: 'catalog', SUBMIT_TASK: 'submit_task',
  TASK_STARTED: 'task_started', OUTPUT: 'output', TASK_COMPLETE: 'task_complete', TASK_ERROR: 'task_error'
};

const $ = (id) => document.getElementById(id);
const els = {
  token: $('token'), connect: $('connect'), conn: $('conn'), cdot: $('cdot'),
  refresh: $('refresh'), projects: $('projects'), agents: $('agents'),
  task: $('task'), send: $('send'), log: $('log')
};

let ws = null;
let peerOnline = false;
let projects = [];
let agents = [];
let selProject = null;
let selAgent = null;

function relayWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}

function setConn(state, text) {
  els.cdot.className = 'dot ' + state; // on | off | wait
  els.conn.textContent = text;
}

function logLine(text, cls) {
  if (els.log.classList.contains('muted')) { els.log.classList.remove('muted'); els.log.textContent = ''; }
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = text;
  els.log.appendChild(span);
  els.log.scrollTop = els.log.scrollHeight;
}

function send(type, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...payload }));
}

function connect() {
  const token = els.token.value.trim();
  if (!token) { setConn('off', 'enter a token'); return; }
  if (ws) { try { ws.close(); } catch {} }
  setConn('wait', 'connecting…');

  ws = new WebSocket(relayWsUrl());
  ws.onopen = () => { setConn('wait', 'pairing…'); send(T.CLIENT_HELLO, { token }); };
  ws.onclose = () => { setConn('off', 'disconnected'); peerOnline = false; updateSend(); };
  ws.onerror = () => setConn('off', 'connection error');
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    handle(msg);
  };
}

function handle(msg) {
  switch (msg.type) {
    case T.PEER_ONLINE:
      peerOnline = true; setConn('on', 'laptop online'); updateSend();
      send(T.LIST); // auto-fetch the catalog once the laptop is reachable
      break;
    case T.PEER_OFFLINE:
      peerOnline = false; setConn('wait', 'laptop offline — waiting'); updateSend();
      break;
    case T.RELAY_ERROR:
      logLine(`\n[relay] ${msg.message}\n`, 'err'); break;
    case T.CATALOG:
      projects = msg.projects || []; agents = msg.agents || [];
      renderCatalog(); break;
    case T.TASK_STARTED:
      logLine(`\n▶ task ${short(msg.taskId)} started\n`, 'muted'); break;
    case T.OUTPUT:
      logLine(msg.chunk, msg.stream === 'stderr' ? 'err' : null); break;
    case T.TASK_COMPLETE:
      logLine(`\n✓ task ${short(msg.taskId)} complete (exit ${msg.code})\n`, 'ok');
      els.send.disabled = false; break;
    case T.TASK_ERROR:
      logLine(`\n✗ task ${short(msg.taskId)} error: ${msg.message}\n`, 'err');
      els.send.disabled = false; break;
  }
}

const short = (id) => (id || '').slice(0, 8);

function renderCatalog() {
  els.projects.classList.remove('muted');
  els.projects.innerHTML = '';
  if (!projects.length) {
    els.projects.innerHTML = '<span class="muted">no projects allowlisted on the laptop yet</span>';
  }
  projects.forEach((p) => {
    const b = document.createElement('span');
    b.className = 'pill' + (selProject === p.id ? ' sel' : '');
    b.textContent = p.name;
    b.title = p.path || '';
    b.onclick = () => { selProject = p.id; renderCatalog(); };
    els.projects.appendChild(b);
  });

  els.agents.classList.remove('muted');
  els.agents.innerHTML = '';
  if (!agents.length) {
    els.agents.innerHTML = '<span class="muted">no agents detected on the laptop</span>';
  }
  agents.forEach((a) => {
    const b = document.createElement('span');
    b.className = 'pill' + (selAgent === a.id ? ' sel' : '');
    b.textContent = a.name;
    b.onclick = () => { selAgent = a.id; renderCatalog(); };
    els.agents.appendChild(b);
  });
  updateSend();
}

function updateSend() {
  els.send.disabled = !(peerOnline && selProject && selAgent && els.task.value.trim());
}

function sendTask() {
  const task = els.task.value.trim();
  if (!peerOnline || !selProject || !selAgent || !task) return;
  els.log.classList.remove('muted'); els.log.textContent = '';
  els.send.disabled = true;
  send(T.SUBMIT_TASK, { projectId: selProject, agentId: selAgent, task });
}

els.connect.onclick = connect;
els.refresh.onclick = () => send(T.LIST);
els.send.onclick = sendTask;
els.task.oninput = updateSend;
els.token.onkeydown = (e) => { if (e.key === 'Enter') connect(); };

// Auto-connect if the token is in the URL (?token=…), like a scanned QR would do.
const params = new URLSearchParams(location.search);
const urlToken = params.get('token');
if (urlToken) { els.token.value = urlToken; connect(); }
