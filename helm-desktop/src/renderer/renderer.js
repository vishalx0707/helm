'use strict';

// All OS access goes through window.helm (see preload.js). No Node here.
const tw = window.helm;
const el = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');

let busy = false;            // a keep-awake toggle is in flight
let awakeSince = null;       // epoch ms keep-awake started, or null
let lidDenied = false;       // last toggle-on had admin declined
let keepAwakeOn = false;

let projectsCache = [];
let agentsCache = [];
const runningTasks = new Set();
let currentTaskId = null;
let currentRunMeta = null;   // { projectName, agentName }
let relayState = { relayConnected: false, peerOnline: false };

// Known agent registry mirrors agents.js so we can show "not installed" rows
// without exposing anything from the laptop. Found-state comes from listAgents().
const KNOWN_AGENTS = [
  { id: 'claude', name: 'Claude Code', desc: 'Conversational, file-editing agent. Best for multi-step work.',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/></svg>' },
  { id: 'codex', name: 'Codex', desc: 'Direct code-completion CLI. Fast, focused edits.',
    icon: '<span class="mono">&lt;/&gt;</span>' },
  { id: 'antigravity', name: 'Antigravity', desc: 'Local tool assistant. Install the antigravity / ag CLI to enable.',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>' }
];

const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>';
const REVEAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M15 3h6v6M21 3l-9 9M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>';
const REMOVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 13 4 4 10-12"/></svg>';
const RING = '<svg class="ring" viewBox="0 0 24 24"><circle class="bg" cx="12" cy="12" r="9"/><circle class="fg" cx="12" cy="12" r="9"/></svg>';

// ---------- view switching ----------
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === name));
}
document.querySelectorAll('.nav-item').forEach((n) => {
  n.addEventListener('click', () => showView(n.dataset.view));
});

// ---------- platform polish ----------
function applyPlatform() {
  const p = tw.platform || 'win32';
  document.body.classList.add('platform-' + (p === 'darwin' ? 'mac' : p === 'win32' ? 'win' : p));
  if (p === 'darwin') {
    const startup = el('lbl-startup');
    if (startup) startup.textContent = 'Launch at login';
    const body = el('confirm-body');
    if (body) body.textContent =
      "HELM needs admin access to keep this Mac fully awake — including with the lid closed. You'll see your system's password prompt next, and it's restored exactly when you turn it off.";
  }
}

// ---------- window controls / mode ----------
function applyMode(mode) {
  const mini = mode === 'mini';
  document.body.classList.toggle('mode-mini', mini);
  document.body.classList.toggle('mode-full', !mini);
}
async function setMode(mode) {
  applyMode(mode);
  try { await tw.setMode(mode); } catch {}
}

// ---------- pairing ----------
async function loadPairing() {
  try {
    const pp = await tw.getPairing();
    if (pp.qr) el('qr-img').src = pp.qr;
    // Show the 6-digit code prominently, fall back to token display
    const codeEl = el('pair-code');
    if (codeEl) {
      if (pp.code) {
        codeEl.textContent = pp.code.slice(0,3) + ' ' + pp.code.slice(3);
        codeEl.classList.remove('dim');
      } else {
        codeEl.textContent = '— — —';
        codeEl.classList.add('dim');
      }
    }
    el('pair-token').textContent = pp.token ? pp.token.slice(0, 8) + '…' : '—';
    el('pair-relay').textContent = pp.publicRelayUrl || pp.relayUrl || '—';
    el('kv-relay').textContent = pp.publicRelayUrl || pp.relayUrl || '—';
    el('kv-session').textContent = shortToken(pp.token);
    el('set-relay').textContent = hostOf(pp.publicRelayUrl || pp.relayUrl);
  } catch {}
}
function shortToken(t) { return t ? String(t).slice(0, 8) : '—'; }
function hostOf(url) {
  if (!url) return '—';
  try { return new URL(url).host; } catch { return url; }
}

// ---------- projects ----------
async function loadProjects() {
  let list = [];
  try { list = await tw.listProjects(); } catch {}
  projectsCache = list;
  el('badge-projects').textContent = String(list.length);
  el('projects-sub').textContent =
    `${list.length} ${list.length === 1 ? 'directory' : 'directories'} exposed · agents may run only inside these`;
  const host = el('project-list');
  host.innerHTML = '';
  if (!list.length) {
    host.innerHTML = '<div class="empty-note">No folders exposed yet — authorize one to let an agent run there.</div>';
    return;
  }
  for (const p of list) {
    const row = document.createElement('div');
    row.className = 'row-card';
    row.innerHTML =
      `<div class="ic">${FOLDER}</div>` +
      `<div class="meta"><div class="nm"></div><div class="pth"></div></div>` +
      `<div class="act">` +
        `<button class="icon-btn js-reveal" title="Reveal">${REVEAL}</button>` +
        `<button class="icon-btn js-remove" title="Remove">${REMOVE}</button>` +
      `</div>`;
    row.querySelector('.nm').textContent = p.name;
    row.querySelector('.pth').textContent = p.path;
    row.querySelector('.js-remove').addEventListener('click', async () => { await tw.removeProject(p.id); loadProjects(); });
    host.appendChild(row);
  }
}

// ---------- agents ----------
async function loadAgents() {
  let list = [];
  try { list = await tw.listAgents(); } catch {}
  agentsCache = list;
  const foundIds = new Set(list.map((a) => a.id));
  el('badge-agents').textContent = String(list.length);
  el('agents-sub').textContent = `scanned this laptop · ${list.length} of ${KNOWN_AGENTS.length} found`;

  const host = el('agent-list');
  host.innerHTML = '';
  // found first (preserve detection order), then known-but-missing
  const ordered = [
    ...list.map((a) => ({ ...meta(a.id), name: a.name, found: true })),
    ...KNOWN_AGENTS.filter((k) => !foundIds.has(k.id)).map((k) => ({ ...k, found: false }))
  ];
  for (const a of ordered) {
    const row = document.createElement('div');
    row.className = 'row-card agent-card ' + (a.found ? 'found' : 'missing');
    row.innerHTML =
      `<div class="ic">${a.icon || ''}</div>` +
      `<div class="meta"><div class="nm"></div><div class="desc"></div></div>` +
      `<div class="act">${a.found ? `<div class="check">${CHECK}</div>` : '<span class="tag off">Not found</span>'}</div>`;
    row.querySelector('.nm').textContent = a.name;
    row.querySelector('.desc').textContent = a.desc || '';
    host.appendChild(row);
  }
  refreshRunUI();
}
function meta(id) { return KNOWN_AGENTS.find((k) => k.id === id) || { id, icon: '', desc: '' }; }
function agentName(id) {
  const a = agentsCache.find((x) => x.id === id) || KNOWN_AGENTS.find((x) => x.id === id);
  return a ? a.name : id;
}
function projectName(id) {
  const p = projectsCache.find((x) => x.id === id);
  return p ? p.name : id;
}

// ---------- relay / connection ----------
function paintRelay(s) {
  relayState = s || relayState;
  const connected = !!relayState.relayConnected;
  const peer = !!relayState.peerOnline;

  const dot = el('connDot');
  const text = el('connText');
  const pill = el('connPill');
  dot.className = 'dot ' + (peer ? 'live' : connected ? 'dim' : 'hollow');
  pill.classList.toggle('off', !peer);
  text.textContent = !connected ? 'Relay offline' : peer ? 'Connected · phone' : 'Awaiting device';

  el('pairWait').style.opacity = peer ? '0.4' : '1';

  // status tiles
  el('tile-relay-dot').className = 'dot ' + (connected ? 'live' : 'dim');
  el('tile-relay').textContent = connected ? 'Online' : 'Offline';
  el('tile-paired').textContent = peer ? 'Phone' : '—';
  el('awakeRelay').textContent = connected ? 'Online' : 'Offline';
  el('awakeDevice').textContent = peer ? 'Phone' : '—';

  // settings connection rows
  el('set-peer').textContent = peer ? 'Phone connected' : 'No phone connected';
  el('set-conn').textContent = peer ? 'Live' : connected ? 'Waiting' : 'Offline';
}

// ---------- keep-awake / status ----------
function paintStatus(status) {
  keepAwakeOn = !!status.keepAwake;
  awakeSince = keepAwakeOn ? (status.since || awakeSince || Date.now()) : null;

  // awake strip
  const strip = el('awstrip');
  strip.classList.toggle('on', keepAwakeOn);
  const running = runningTasks.size > 0;
  el('awstripText').textContent = keepAwakeOn ? 'Keep-awake active' : 'System sleep normal';
  el('awstripSub').textContent = keepAwakeOn
    ? (running ? 'agent running · sleep inhibited until idle' : (lidDenied ? 'admin declined — lid override not applied' : 'sleep inhibited'))
    : 'no agent running';

  // status tiles + mini
  el('tile-awake').textContent = keepAwakeOn ? 'On' : 'Off';
  const mini = el('status-awake-mini');
  mini.classList.toggle('on', keepAwakeOn);
  el('status-awake-tag').className = 'tag' + (keepAwakeOn ? ' on' : '');
  el('status-awake-tag').textContent = keepAwakeOn ? 'On' : 'Off';
  el('status-awake-sub').textContent = keepAwakeOn
    ? (running ? 'held awake · agent running' : 'held awake · manual')
    : 'normal sleep · no agent running';

  // awake view toggle
  const toggle = el('awakeToggle');
  toggle.classList.toggle('on', keepAwakeOn);
  toggle.setAttribute('aria-pressed', String(keepAwakeOn));
  el('awakeState').textContent = keepAwakeOn ? 'ON' : 'OFF';
  el('awakeDesc').textContent = keepAwakeOn
    ? 'This laptop will not sleep while keep-awake is held.'
    : 'Turn on to stop this laptop sleeping while agents run.';
  el('timer-card').classList.toggle('on', keepAwakeOn);
  el('timer-dot').className = 'dot ' + (keepAwakeOn ? 'live' : 'dim');
  el('awakeTimerSub').textContent = keepAwakeOn ? 'sleep inhibitor engaged' : 'sleep inhibitor idle';

  paintTimer();
}

function paintTimer() {
  if (!awakeSince) {
    el('awakeTimer').textContent = '00:00:00';
    el('mini-sub').textContent = runningTasks.size ? 'running' : 'idle';
    return;
  }
  let s = Math.max(0, Math.floor((Date.now() - awakeSince) / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const t = `${pad(h)}:${pad(m)}:${pad(s)}`;
  el('awakeTimer').textContent = t;
  el('mini-sub').textContent = `awake ${pad(h)}:${pad(m)}`;
}

function paintClock() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = (h % 12) || 12;
  el('awakeClock').textContent = `${h}:${pad(m)} ${ap}`;
}

async function refreshStatus() { paintStatus(await tw.getStatus()); }

// ---------- keep-awake toggle (+ confirm) ----------
async function onToggle() {
  if (busy) return;
  if (!keepAwakeOn) { el('confirm').classList.remove('hidden'); return; }
  await applyKeepAwake(false);
}
async function applyKeepAwake(on) {
  busy = true;
  lidDenied = false;
  paintStatus({ keepAwake: on, since: on ? Date.now() : null }); // optimistic
  try {
    const res = await tw.setKeepAwake(on);
    if (res && res.lid && res.lid.denied) lidDenied = true;
    paintStatus(res);
  } catch {
    await refreshStatus();
  } finally {
    busy = false;
  }
}

// ---------- live run mirror (Status console) ----------
function appendConsole(stream, chunk, cls) {
  const box = el('deskConsole');
  // first real line clears the idle placeholder
  if (box.querySelector('.cline.idle')) box.innerHTML = '';
  const text = String(chunk == null ? '' : chunk).replace(/\s+$/, '');
  if (!text) return;
  const line = document.createElement('div');
  line.className = 'cline show' + (cls ? ' ' + cls : (stream === 'stderr' ? ' err' : ''));
  line.textContent = text;
  box.appendChild(line);
  // cap the DOM so a chatty agent can't grow it unbounded
  while (box.childElementCount > 400) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}
function setRunning(running, meta) {
  const console = el('status-console');
  console.classList.toggle('live', running);
  const runLabel = el('console-run');
  const who = el('console-who');
  if (running) {
    const nm = meta ? `${meta.projectName} · ${meta.agentName}` : 'agent running';
    runLabel.innerHTML = `<span class="dot live" style="width:6px;height:6px"></span>${escapeHtml(nm)}`;
    who.innerHTML = `${RING}streaming to phone…`;
  } else {
    runLabel.innerHTML = `<span class="dot dim" style="width:6px;height:6px"></span>No agent running`;
    who.textContent = runningTasks.size ? 'streaming to phone…' : 'waiting for a task…';
  }
}
function refreshRunUI() {
  const running = runningTasks.size;
  el('tile-agents').innerHTML = `${agentsCache.length} <span class="sm">ready</span>`;
  el('awakeAgents').innerHTML = running
    ? `${running} <span class="ring" style="width:12px;height:12px"><svg viewBox="0 0 24 24" style="width:12px;height:12px"><circle class="bg" cx="12" cy="12" r="9" fill="none" stroke-width="2.6"/><circle class="fg" cx="12" cy="12" r="9" fill="none" stroke-width="2.6"/></svg></span>`
    : '0';
  el('mini-title').textContent = running ? `${currentRunMeta?.agentName || 'Agent'} · running` : 'HELM';
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function onTaskEvent(ev) {
  switch (ev.type) {
    case 'submit_task': {
      currentRunMeta = { projectName: projectName(ev.projectId), agentName: agentName(ev.agentId) };
      el('deskConsole').innerHTML = '';
      appendConsole(null, `$ ${currentRunMeta.agentName} · ${currentRunMeta.projectName}`, 'idle');
      appendConsole(null, 'Spawning in allowlisted folder…', 'idle');
      setRunning(true, currentRunMeta);
      refreshRunUI();
      break;
    }
    case 'task_started':
      if (ev.taskId) { runningTasks.add(ev.taskId); currentTaskId = ev.taskId; }
      setRunning(true, currentRunMeta);
      refreshRunUI();
      paintStatus({ keepAwake: keepAwakeOn, since: awakeSince }); // refresh strip sub-text
      break;
    case 'output':
      appendConsole(ev.stream, ev.chunk);
      break;
    case 'task_complete':
      if (ev.taskId) runningTasks.delete(ev.taskId);
      appendConsole(null, `✓ completed · exit ${ev.code}`, 'idle');
      setRunning(false, currentRunMeta);
      refreshRunUI();
      paintStatus({ keepAwake: keepAwakeOn, since: awakeSince });
      break;
    case 'task_error':
      if (ev.taskId) runningTasks.delete(ev.taskId);
      appendConsole('stderr', `✕ ${ev.message || 'agent error'}`);
      setRunning(false, currentRunMeta);
      refreshRunUI();
      paintStatus({ keepAwake: keepAwakeOn, since: awakeSince });
      break;
  }
}

// ---------- settings ----------
async function loadSettings() {
  let s = {};
  try { s = await tw.getSettings(); } catch {}
  setSwitch(el('set-startup'), !!s.launchAtStartup);
  setSwitch(el('set-lidwarn'), s.showLidWarning !== false);
}
function setSwitch(node, on) { node.classList.toggle('on', !!on); }
async function saveSettings() {
  await tw.setSettings({
    launchAtStartup: el('set-startup').classList.contains('on'),
    showLidWarning: el('set-lidwarn').classList.contains('on')
  });
}
el('set-startup').addEventListener('click', () => { el('set-startup').classList.toggle('on'); saveSettings(); });
el('set-lidwarn').addEventListener('click', () => { el('set-lidwarn').classList.toggle('on'); saveSettings(); });

// ---------- wiring ----------
el('btn-min').addEventListener('click', () => tw.minimize());
el('btn-max').addEventListener('click', () => tw.toggleMaximize());
el('btn-close').addEventListener('click', () => tw.hide());
el('btn-expand').addEventListener('click', () => setMode('full'));
el('btn-quit-row').addEventListener('click', () => tw.quit());

el('btn-add-project').addEventListener('click', async () => { await tw.addProject(); loadProjects(); });
el('ghost-add-project').addEventListener('click', async () => { await tw.addProject(); loadProjects(); });
el('btn-rescan').addEventListener('click', async () => { try { await tw.rescanAgents(); } catch {} loadAgents(); });

el('btn-copy-token').addEventListener('click', async () => {
  const btn = el('btn-copy-token');
  try { await navigator.clipboard.writeText(el('pair-token').textContent || ''); btn.textContent = 'Copied'; }
  catch { btn.textContent = 'Failed'; }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
});

el('btn-refresh-qr').addEventListener('click', async () => {
  const btn = el('btn-refresh-qr');
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Generating…';
  try {
    const pp = await tw.regeneratePairing();
    if (pp.qr) el('qr-img').src = pp.qr;
    el('pair-token').textContent = pp.token || '—';
    el('kv-session').textContent = shortToken(pp.token);
    btn.textContent = 'New code ready';
  } catch {
    btn.textContent = 'Failed';
  }
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1400);
});

el('awakeToggle').addEventListener('click', onToggle);
el('status-awake-mini').addEventListener('click', () => showView('awake'));
el('confirm-cancel').addEventListener('click', () => { el('confirm').classList.add('hidden'); refreshStatus(); });
el('confirm-go').addEventListener('click', async () => { el('confirm').classList.add('hidden'); await applyKeepAwake(true); });

// push channels from main
tw.onRelay((s) => { paintRelay(s); loadPairing(); });
tw.onStatus(paintStatus);
tw.onMode(applyMode);
tw.onTask(onTaskEvent);

// ---------- init ----------
async function init() {
  applyPlatform();
  el('tbVer').textContent = 'desktop';
  try { applyMode(await tw.getMode()); } catch { applyMode('full'); }

  await loadPairing();
  await loadProjects();
  await loadAgents();
  await loadSettings();
  await refreshStatus();
  try { paintRelay(await tw.getRelayStatus()); } catch {}

  paintClock();
  setInterval(() => { paintTimer(); paintClock(); }, 1000);
}

init();
