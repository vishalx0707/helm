'use strict';

const { powerSaveBlocker } = require('electron');
const settings = require('./settings');

/**
 * Keep-awake engine (cross-platform orchestrator).
 *
 * Two independent layers, both engaged by enable():
 *   1. powerSaveBlocker('prevent-display-sleep') — blocks idle system sleep AND
 *      the display turning off. No elevation, no native module. Identical on
 *      Windows and macOS, so it lives here.
 *   2. Lid-close override — makes closing the lid do nothing on BOTH AC and
 *      battery. This is the only OS-specific part, delegated to a platform
 *      backend (power.win.js → powercfg; power.mac.js → pmset via osascript).
 *      Either way it prompts for elevation once and the original value is saved
 *      so we can restore it exactly.
 *
 * INVARIANT: every path that turns keep-awake OFF (disable/quit) restores the
 * saved original lid value. The saved original is persisted in
 * settings.savedLidAction (opaque shape — {ac,dc} on Windows,
 * {disableSleep} on macOS) the first time we override; we never overwrite it
 * with our own value.
 */

const backend = process.platform === 'darwin'
  ? require('./power.mac')
  : require('./power.win');

let blockerId = null;
let lidOverridden = false;
// Epoch ms when keep-awake last transitioned ON (null when off). Drives the
// "Protected for HH:MM:SS" timer in the UI; persisted via settings.keepAwakeSince.
let enabledAt = null;

// Who is currently holding keep-awake ON. Two independent reasons can hold it:
//   'user'  — the manual toggle (tray / window). Persisted via keepAwakeOnLaunch.
//   'agent' — an agent task is running (driven by runner.js).
// We only physically stand down (stop blocker + restore lid) when NO holder
// remains, so a manual OFF can't cut sleep-protection out from under a running
// agent, and an agent finishing can't undo the user's manual ON.
const holders = new Set();

/** Start blocking sleep + override the lid. Idempotent. `reason`: 'user'|'agent'. */
async function enable(reason = 'user') {
  holders.add(reason);
  const wasActive = isActive();
  if (blockerId === null || !powerSaveBlocker.isStarted(blockerId)) {
    blockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
  // Stamp the start time only on a real OFF→ON transition (so re-arming an
  // already-active session doesn't reset the timer).
  if (!wasActive || !enabledAt) {
    enabledAt = Date.now();
    settings.set('keepAwakeSince', enabledAt);
  }

  let lid = { ok: true, denied: false, skipped: false };
  if (!lidOverridden) {
    const res = await backend.override();
    lid = res;
    if (res.ok) {
      // Save the captured original (only if we don't already have one).
      if (res.saved && !settings.get('savedLidAction')) {
        settings.set('savedLidAction', res.saved);
      }
      if (!res.skipped) lidOverridden = true;
    }
  }

  // Only the manual toggle persists across launches; an agent hold does not.
  if (reason === 'user') settings.set('keepAwakeOnLaunch', true);
  return { ...getStatus(), lid };
}

/** Release a hold; physically stand down only when no holder remains. */
async function disable(reason = 'user') {
  holders.delete(reason);
  if (reason === 'user') settings.set('keepAwakeOnLaunch', false);
  // Another reason still wants us awake (e.g. user toggled off mid-task) → stay on.
  if (holders.size > 0) return { ...getStatus(), lid: { ok: true, denied: false } };

  if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId);
  }
  blockerId = null;
  enabledAt = null;
  settings.set('keepAwakeSince', null);

  let lid = { ok: true, denied: false };
  const saved = settings.get('savedLidAction');
  if (lidOverridden && saved) {
    lid = await backend.restore(saved);
    if (lid.ok) {
      lidOverridden = false;
      settings.set('savedLidAction', null);
    }
  } else {
    settings.set('savedLidAction', null);
    lidOverridden = false;
  }

  return { ...getStatus(), lid };
}

/** Sync in-memory state with persisted settings on startup (crash recovery). */
function init() {
  lidOverridden = !!settings.get('savedLidAction');
  // Restore the timer's start so it keeps counting if we re-arm on launch.
  enabledAt = settings.get('keepAwakeSince') || null;
}

function isActive() {
  return blockerId !== null && powerSaveBlocker.isStarted(blockerId);
}

function getStatus() {
  const active = isActive();
  return {
    keepAwake: active,
    blockerActive: active,
    lidOverridden,
    savedLidAction: settings.get('savedLidAction'),
    since: active ? enabledAt : null   // epoch ms keep-awake started → UI timer
  };
}

/** Best-effort restore on quit (prompts for elevation once if lid is overridden). */
async function restoreForQuit() {
  holders.clear();
  if (!lidOverridden) return { ok: true, restored: false };
  const saved = settings.get('savedLidAction');
  if (!saved) return { ok: true, restored: false };
  const res = await backend.restore(saved);
  if (res.ok) {
    lidOverridden = false;
    enabledAt = null;
    settings.set('savedLidAction', null);
    settings.set('keepAwakeSince', null);
    settings.set('keepAwakeOnLaunch', false);
  }
  return { ...res, restored: res.ok };
}

module.exports = { init, enable, disable, isActive, getStatus, restoreForQuit };
