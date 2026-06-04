'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Tiny JSON settings store living in the OS userData dir.
 * No external deps. Survives restarts. Used to remember the user's
 * preferences AND the original Windows power values so we can restore them.
 */

const DEFAULTS = {
  firstRunDone: false,
  keepAwakeOnLaunch: false,
  launchAtStartup: false,
  showLidWarning: true,
  // Saved original lid-close action so we can put the machine back exactly how
  // we found it. null = nothing saved / not currently overridden. Shape is
  // platform-specific and opaque: { ac, dc } on Windows, { disableSleep } on macOS.
  savedLidAction: null,
  // Epoch ms when keep-awake was last turned ON (null when off). Persisted so the
  // "Protected for HH:MM:SS" timer keeps counting across an app restart while the
  // machine is still being kept awake. Not renderer-writable.
  keepAwakeSince: null,
  // Window mode the app reopens in: 'full' (the dashboard) or 'mini' (the small
  // always-on-top widget). Set by main.js when the user shrinks/expands. Not
  // renderer-writable through settings:set.
  windowMode: 'full',
  // Last on-screen position of the mini widget ({ x, y }) so it reopens where the
  // user left it. null = no saved position (place near the bottom-right corner).
  miniBounds: null,

  // --- HELM agent-control state ---
  // Allowlisted project folders the phone is allowed to see. Each entry:
  // { id, name, path }. Agents are spawned ONLY inside one of these paths.
  projects: [],
  // Stable pairing/session token for this laptop. Generated once and shown in the
  // QR / pairing panel; the phone presents it to the relay to reach this laptop.
  sessionToken: null,
  // Relay URL the desktop dials out to. Plain ws:// in dev; a tunnel provides wss.
  relayUrl: 'ws://localhost:8787',
  // The relay URL the PHONE should use (embedded in the QR). Differs from relayUrl
  // when the laptop reaches the relay locally but the phone reaches it via a tunnel
  // (e.g. wss://abc.trycloudflare.com). null = same as relayUrl.
  publicRelayUrl: null
};

let cache = null;
let filePath = null;

function file() {
  if (!filePath) {
    filePath = path.join(app.getPath('userData'), 'helm-settings.json');
    const oldPath = path.join(app.getPath('userData'), 'termwork-settings.json');
    if (!fs.existsSync(filePath) && fs.existsSync(oldPath)) {
      try {
        fs.renameSync(oldPath, filePath);
      } catch (err) {
        console.error('[settings] failed to migrate settings file:', err);
      }
    }
  }
  return filePath;
}

function load() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(file(), 'utf8');
    cache = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function save() {
  try {
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('[settings] failed to write:', err);
  }
}

function get(key) {
  return load()[key];
}

function getAll() {
  return { ...load() };
}

function set(key, value) {
  load();
  cache[key] = value;
  save();
}

/** Merge a partial object of settings at once (used by the settings screen). */
function merge(partial) {
  load();
  cache = { ...cache, ...partial };
  save();
  return { ...cache };
}

module.exports = { get, getAll, set, merge, DEFAULTS };
