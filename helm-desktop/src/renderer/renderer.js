'use strict';

// All OS access goes through window.helm (see preload.js). No Node here.
const tw = window.helm;

const el = (id) => document.getElementById(id);

const ui = {
  body: document.body,
  toggle: el('toggle'),
  kicker: el('kicker'),
  clock: el('clock'),
  sdot: el('sdot'),
  stext: el('stext'),
  heroWarn: el('hero-warn'),
  miniDot: el('mini-dot'),
  miniClock: el('mini-clock'),
  miniMeta: el('mini-meta'),
};

let busy = false;
let awakeSince = null;        // epoch ms keep-awake started, or null
let lidDenied = false;        // last toggle-on had admin declined
let showLidWarn = true;       // user pref: show the closed-lid heat warning

const pad = (n) => String(n).padStart(2, '0');

// ---------- status / keep-awake ----------
function paintStatus(status) {
  const on = !!status.keepAwake;
  awakeSince = on ? (status.since || awakeSince || Date.now()) : null;

  ui.body.classList.toggle('awake', on);
  ui.toggle.setAttribute('aria-checked', String(on));
  ui.kicker.textContent = on ? 'Protected for' : 'Idle';
  ui.sdot.className = 'dot ' + (on ? 'fill pulse' : 'ring');
  ui.miniDot.className = 'dot ' + (on ? 'fill pulse' : 'ring');
  ui.heroWarn.hidden = !(on && showLidWarn);

  ui.stext.textContent = on
    ? (lidDenied ? 'Admin declined — lid override not applied'
                 : 'No sleep · screen on · lid does nothing')
    : 'Off — agents may pause when the machine sleeps';

  if (on) {
    paintTimer();
  } else {
    ui.clock.innerHTML = '00:00<span class="sec">:00</span>';
    ui.miniClock.textContent = '00:00';
  }
  updateMiniMeta();
}

// Tick the awake clock (hero + mini) once per second.
function paintTimer() {
  if (!awakeSince) return;
  let s = Math.max(0, Math.floor((Date.now() - awakeSince) / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  ui.clock.innerHTML = `${pad(h)}:${pad(m)}<span class="sec">:${pad(s)}</span>`;
  ui.miniClock.textContent = `${pad(h)}:${pad(m)}`;
}

// The mini widget's one-line summary: awake state.
function updateMiniMeta() {
  const on = !!awakeSince;
  ui.miniMeta.textContent = on ? 'awake' : 'idle';
}

async function refreshStatus() {
  paintStatus(await tw.getStatus());
}

// Toggle handler: turning ON shows the pre-elevation confirm modal first.
async function onToggle() {
  if (busy) return;
  const turningOn = ui.toggle.getAttribute('aria-checked') !== 'true';
  if (turningOn) { openConfirm(); return; }
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

// ---------- confirm modal (the "password" step) ----------
function openConfirm() { el('confirm').classList.remove('hidden'); }
function closeConfirm() { el('confirm').classList.add('hidden'); }

// ---------- full <-> mini mode ----------
function applyMode(mode) {
  const mini = mode === 'mini';
  ui.body.classList.toggle('mode-mini', mini);
  ui.body.classList.toggle('mode-full', !mini);
  ui.body.classList.remove('maximized'); // main restores a normal (non-maximized) window
}
async function setMode(mode) {
  applyMode(mode);            // optimistic; main confirms via onMode
  try { await tw.setMode(mode); } catch {}
}

// ---------- views ----------
function show(view) {
  el('view-main').classList.toggle('hidden', view !== 'main');
  el('view-settings').classList.toggle('hidden', view !== 'settings');
}
window.TwViews = { show };

async function openSettings() {
  const s = await tw.getSettings();
  el('set-startup').checked = !!s.launchAtStartup;
  el('set-lidwarn').checked = !!s.showLidWarning;
  show('settings');
}

async function saveSettings() {
  showLidWarn = el('set-lidwarn').checked;
  await tw.setSettings({
    launchAtStartup: el('set-startup').checked,
    showLidWarning: showLidWarn
  });
  show('main');
  refreshStatus();
}

// ================= HELM agent control =================
const hc = {
  qr: el('qr'),
  token: el('pair-token'),
  relayUrl: el('pair-relay'),
  copy: el('btn-copy-token'),
  relayDot: el('relay-dot'),
  relayText: el('relay-text'),
  addProject: el('btn-add-project'),
  projectList: el('project-list'),
  agentList: el('agent-list')
};

async function loadPairing() {
  try {
    const p = await tw.getPairing();
    if (p.qr) hc.qr.src = p.qr;
    hc.token.textContent = p.token || '—';
    hc.relayUrl.textContent = p.publicRelayUrl || p.relayUrl || '—';
  } catch {}
}

// Relay/peer connection indicator. States: offline → waiting → phone connected.
function paintRelay(s) {
  const connected = !!(s && s.relayConnected);
  const peer = !!(s && s.peerOnline);
  hc.relayDot.className = 'dot ' + (peer ? 'fill pulse' : connected ? 'fill' : 'ring');
  hc.relayText.textContent = !connected ? 'relay offline — retrying'
    : peer ? 'phone connected' : 'waiting for phone';
}

async function loadProjects() {
  let list = [];
  try { list = await tw.listProjects(); } catch {}
  hc.projectList.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No folders exposed yet.';
    hc.projectList.appendChild(li);
    return;
  }
  for (const p of list) {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'pinfo';
    const name = document.createElement('span');
    name.className = 'pname';
    name.textContent = p.name;
    const path = document.createElement('span');
    path.className = 'ppath';
    path.textContent = p.path;
    info.append(name, path);
    const rm = document.createElement('button');
    rm.className = 'premove';
    rm.title = 'Remove';
    rm.textContent = '✕';
    rm.addEventListener('click', async () => { await tw.removeProject(p.id); loadProjects(); });
    li.append(info, rm);
    hc.projectList.appendChild(li);
  }
}

async function loadAgents() {
  let list = [];
  try { list = await tw.listAgents(); } catch {}
  hc.agentList.innerHTML = '';
  if (!list.length) {
    const s = document.createElement('span');
    s.className = 'muted small';
    s.textContent = 'No agents detected on this laptop.';
    hc.agentList.appendChild(s);
    return;
  }
  for (const a of list) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = a.name;
    hc.agentList.appendChild(chip);
  }
}

hc.addProject.addEventListener('click', async () => { await tw.addProject(); loadProjects(); });
hc.copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(hc.token.textContent || ''); hc.copy.textContent = 'Copied'; }
  catch { hc.copy.textContent = 'Copy failed'; }
  setTimeout(() => { hc.copy.textContent = 'Copy token'; }, 1500);
});
tw.onRelay(paintRelay);

// ---------- wiring ----------
ui.toggle.addEventListener('click', onToggle);
el('btn-settings').addEventListener('click', openSettings);
el('btn-back').addEventListener('click', () => show('main'));
el('btn-save').addEventListener('click', saveSettings);
el('btn-quit').addEventListener('click', () => tw.quit());
el('btn-min').addEventListener('click', () => tw.minimize());
el('btn-close').addEventListener('click', () => tw.hide());
el('btn-shrink').addEventListener('click', () => setMode('mini'));
el('btn-expand').addEventListener('click', () => setMode('full'));

// maximize / restore (frameless window has no OS title bar)
async function toggleMaximize() {
  try { ui.body.classList.toggle('maximized', !!(await tw.toggleMaximize())); } catch {}
}
el('btn-max').addEventListener('click', toggleMaximize);
// double-click the top bar (anywhere but the window buttons) to maximize/restore
document.querySelector('.topbar').addEventListener('dblclick', (e) => {
  if (e.target.closest('.winbtns')) return;
  toggleMaximize();
});
el('confirm-cancel').addEventListener('click', () => { closeConfirm(); refreshStatus(); });
el('confirm-go').addEventListener('click', async () => { closeConfirm(); await applyKeepAwake(true); });

tw.onStatus(paintStatus);
tw.onMode(applyMode);

// ---------- platform polish ----------
function applyPlatform() {
  const p = tw.platform || 'win32';
  document.body.classList.add('platform-' + (p === 'darwin' ? 'mac' : p === 'win32' ? 'win' : p));
  if (p === 'darwin') {
    const startup = el('lbl-startup');
    if (startup) startup.textContent = 'Launch at login';
    const note = el('fr-note');
    if (note) note.textContent =
      'Turning it on disables macOS sleep — including closing the lid — with one admin prompt, and restores it exactly when you turn it off.';
    const body = el('confirm-body');
    if (body) body.textContent =
      "HELM needs admin access to keep this Mac fully awake — including when the lid is closed. You'll see your system's password prompt next.";
  }
}

// ---------- init ----------
async function init() {
  applyPlatform();
  try { applyMode(await tw.getMode()); } catch { applyMode('full'); }
  const s = await tw.getSettings();
  showLidWarn = s.showLidWarning !== false;
  if (!s.firstRunDone) {
    el('firstrun').classList.remove('hidden');
    el('fr-go').addEventListener('click', async () => {
      await tw.setSettings({ firstRunDone: true });
      el('firstrun').classList.add('hidden');
    });
  }
  await refreshStatus();
  setInterval(paintTimer, 1000);

  // HELM agent control panels
  loadPairing();
  loadProjects();
  loadAgents();
  try { paintRelay(await tw.getRelayStatus()); } catch {}
}

init();
