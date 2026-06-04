'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, screen } = require('electron');
const path = require('path');
const power = require('./power');
const settings = require('./settings');
const projects = require('./projects');
const agents = require('./agents');
const runner = require('./runner');
const pairing = require('./pairing');
const relayClient = require('./relay-client');

const ICON_PNG = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const ICON_ICO = path.join(__dirname, '..', '..', 'assets', 'icon.ico');
const TRAY_TEMPLATE = path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png');
const isDev = process.argv.includes('--dev');
const isMac = process.platform === 'darwin';
const APP_NAME = 'HELM';

// Give Windows a stable app identity so the taskbar shows our icon + name (and
// groups windows under the app, not the working folder / generic Electron host).
// Must be set before any window is created. Matches build.appId.
app.setAppUserModelId('com.helm.app');
app.setName(APP_NAME);

// The two window shapes. FULL is the resizable dashboard; MINI is the small,
// fixed, always-on-top widget the user drags into a corner.
const FULL = { width: 940, height: 660, minWidth: 760, minHeight: 560 };
const MINI = { width: 252, height: 100 };

let win = null;
let tray = null;
let isQuitting = false;
let windowMode = 'full';     // 'full' | 'mini'
let savedFullBounds = null;   // restored when expanding back to full

function trayImage() {
  // macOS menubar wants a small monochrome template image that adapts to
  // light/dark; Windows uses the full-color app icon.
  if (isMac) {
    const t = nativeImage.createFromPath(TRAY_TEMPLATE);
    if (!t.isEmpty()) { t.setTemplateImage(true); return t; }
  }
  let img = nativeImage.createFromPath(ICON_PNG);
  if (!img.isEmpty()) {
    img = img.resize({ width: 16, height: 16 });
  }
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function createWindow() {
  const opts = {
    width: FULL.width,
    height: FULL.height,
    minWidth: FULL.minWidth,
    minHeight: FULL.minHeight,
    resizable: true,
    backgroundColor: '#f4f3ef',
    show: false,
    title: APP_NAME,
    icon: isMac ? ICON_PNG : ICON_ICO,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev
    }
  };
  // Native traffic lights on macOS (top-left); frameless custom titlebar on Windows.
  if (isMac) {
    opts.titleBarStyle = 'hiddenInset';
    opts.trafficLightPosition = { x: 12, y: 15 };
  } else {
    opts.frame = false;
  }
  win = new BrowserWindow(opts);

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    // Reopen in whichever mode the user left the app in last session.
    if (settings.get('windowMode') === 'mini') applyWindowMode('mini');
    win.show();
  });

  // While in mini, remember where the user drags the widget so it reopens there.
  win.on('moved', () => {
    if (windowMode === 'mini' && win && !win.isDestroyed()) {
      const b = win.getBounds();
      settings.set('miniBounds', { x: b.x, y: b.y });
    }
  });

  // Closing the window does NOT quit — hide to tray, keep blocking sleep.
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

// Reshape the single window between the full dashboard and the mini widget.
// Mini is fixed-size, always-on-top, and positioned at the last drag spot (or
// the bottom-right corner the first time). Full restores the prior bounds.
function applyWindowMode(mode) {
  if (!win || win.isDestroyed()) return;
  const next = mode === 'mini' ? 'mini' : 'full';

  if (next === 'mini') {
    if (windowMode === 'full') savedFullBounds = win.getBounds();
    win.setResizable(false);
    win.setMinimumSize(MINI.width, MINI.height);
    win.setMaximumSize(MINI.width, MINI.height);
    if (isMac && win.setWindowButtonVisibility) win.setWindowButtonVisibility(false);

    const saved = settings.get('miniBounds');
    let x, y;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      ({ x, y } = saved);
    } else {
      const wa = screen.getPrimaryDisplay().workArea;
      x = wa.x + wa.width - MINI.width - 24;
      y = wa.y + wa.height - MINI.height - 24;
    }
    win.setBounds({ x, y, width: MINI.width, height: MINI.height });
    win.setAlwaysOnTop(true, 'floating');
  } else {
    win.setAlwaysOnTop(false);
    win.setMaximumSize(0, 0); // 0 = no maximum
    win.setMinimumSize(FULL.minWidth, FULL.minHeight);
    win.setResizable(true);
    if (isMac && win.setWindowButtonVisibility) win.setWindowButtonVisibility(true);
    if (savedFullBounds) win.setBounds(savedFullBounds);
    else win.setSize(FULL.width, FULL.height);
  }

  windowMode = next;
  settings.set('windowMode', next);
  if (win && !win.isDestroyed()) win.webContents.send('mode:update', next);
}

function buildTrayMenu() {
  const active = power.isActive();
  return Menu.buildFromTemplate([
    { label: active ? '● Keeping awake' : '○ Idle', enabled: false },
    { type: 'separator' },
    { label: 'Show HELM', click: () => showWindow() },
    {
      label: active ? 'Turn keep-awake OFF' : 'Turn keep-awake ON',
      click: async () => {
        if (active) await power.disable(); else await power.enable();
        refreshTray();
        sendStatus();
      }
    },
    { type: 'separator' },
    { label: 'Quit HELM', click: () => quit() }
  ]);
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

// macOS shows an application menu bar; give it the standard app + edit + window
// roles so Cmd+Q (→ before-quit → restore), Cmd+W, and copy/paste in text inputs
// all work. Windows has no menu bar (frameless window).
function setupAppMenu() {
  if (!isMac) { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ]));
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip(APP_NAME);
  tray.on('click', () => showWindow());
  refreshTray();
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

function sendStatus() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('status:update', power.getStatus());
  }
}

async function quit() {
  isQuitting = true;
  try { runner.cancelAll(); } catch (e) { console.error(e); }
  try { relayClient.stop(); } catch (e) { console.error(e); }
  // Restore Windows power settings before exiting (may prompt UAC once).
  try { await power.restoreForQuit(); } catch (e) { console.error(e); }
  app.exit(0);
}

// ---- single instance ----
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(async () => {
    power.init(); // sync internal state with any saved override from a prior session

    setupAppMenu();
    createWindow();
    createTray();

    // Re-arm keep-awake if the user left it on last session.
    if (settings.get('keepAwakeOnLaunch')) {
      try { await power.enable(); } catch (e) { console.error(e); }
      refreshTray();
      sendStatus();
    }

    // --- HELM agent control ---
    // Push relay/peer connection changes to the window's Pairing panel.
    relayClient.onStatus((s) => { if (win && !win.isDestroyed()) win.webContents.send('relay:update', s); });
    // Mirror live task events to the renderer's Status frame (display only).
    relayClient.onTask((ev) => { if (win && !win.isDestroyed()) win.webContents.send('task:update', ev); });
    // An agent run engages/releases keep-awake — refresh the timer + tray when it does.
    runner.setOnChange(() => { refreshTray(); sendStatus(); });
    // Detect installed agents (async; the catalog is sent to the phone on request).
    agents.detect().catch((e) => console.error('[agents] detect failed', e));
    // Dial out to the relay and stay connected.
    relayClient.start();
  });
}

app.on('window-all-closed', (e) => {
  // Do nothing: we live in the tray. Never auto-quit on window close.
});

// macOS: clicking the Dock icon re-opens the window.
app.on('activate', () => showWindow());

app.on('before-quit', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    quit();
  }
});

// ---------------- IPC: the ONLY surface the renderer can reach ----------------

ipcMain.handle('status:get', () => power.getStatus());

ipcMain.handle('keepAwake:set', async (_e, on) => {
  const res = on ? await power.enable() : await power.disable();
  refreshTray();
  return res;
});

ipcMain.handle('settings:get', () => settings.getAll());

ipcMain.handle('settings:set', (_e, partial) => {
  // Whitelist keys the renderer is allowed to change.
  const allowed = ['firstRunDone', 'launchAtStartup', 'showLidWarning'];
  const clean = {};
  for (const k of allowed) {
    if (k in (partial || {})) clean[k] = partial[k];
  }
  const merged = settings.merge(clean);
  if ('launchAtStartup' in clean) {
    app.setLoginItemSettings({ openAtLogin: !!clean.launchAtStartup, path: process.execPath });
  }
  return merged;
});

ipcMain.handle('win:minimize', () => { if (win) win.minimize(); });
ipcMain.handle('win:hide', () => { if (win) win.hide(); });
ipcMain.handle('win:setMode', (_e, mode) => {
  applyWindowMode(mode === 'mini' ? 'mini' : 'full');
  return windowMode;
});
ipcMain.handle('win:getMode', () => windowMode);
ipcMain.handle('win:toggleMaximize', () => {
  if (!win || windowMode === 'mini') return false;   // mini is fixed-size
  if (win.isMaximized()) { win.unmaximize(); return false; }
  win.maximize();
  return true;
});
ipcMain.handle('app:quit', () => quit());
ipcMain.handle('open:external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});

// ---- HELM agent control ----
ipcMain.handle('pairing:get', () => pairing.info());
ipcMain.handle('pairing:regenerate', async () => {
  // Request a new 6-digit code without rotating the durable token —
  // so generating a new code never kicks an already-paired phone off.
  relayClient.requestNewCode();
  // Give the relay a moment to respond with pair_code before we read info
  await new Promise(r => setTimeout(r, 300));
  return pairing.info();
});
ipcMain.handle('projects:list', () => projects.list());
ipcMain.handle('projects:add', () => projects.add(win));
ipcMain.handle('projects:remove', (_e, id) => projects.remove(typeof id === 'string' ? id : ''));
ipcMain.handle('agents:list', () => agents.list());
ipcMain.handle('agents:rescan', () => agents.detect());
ipcMain.handle('relay:status', () => relayClient.getStatus());
