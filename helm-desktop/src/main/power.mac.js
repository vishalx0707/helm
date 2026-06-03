'use strict';

const { execFile } = require('child_process');

/**
 * macOS lid-close backend for the keep-awake engine.
 *
 * The macOS analog of the Windows "lid does nothing" override is
 *   sudo pmset -a disablesleep 1
 * which disables system sleep entirely — including closing the lid (clamshell) —
 * on both AC and battery. It needs admin, so we run it through one
 * `osascript ... with administrator privileges` prompt (the UAC analog). The
 * original value (normally 0) is read non-elevated via `pmset -g` and restored
 * on OFF/quit.
 *
 * Idle + display sleep is handled separately by powerSaveBlocker in power.js, so
 * here we only touch the sleep-disable flag.
 *
 * SECURITY: the shell string passed to osascript is a hard-coded command with an
 * integer (0/1) we validate ourselves. No renderer/user input is interpolated.
 *
 * Interface (consumed by power.js):
 *   override()      -> { ok, denied, skipped, saved:{disableSleep:0|1}|null }
 *   restore(saved)  -> { ok, denied }
 */

function runFile(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

/** Read the current SleepDisabled flag (0/1) without elevation. Default 0. */
async function readDisableSleep() {
  const { err, stdout } = await runFile('pmset', ['-g']);
  if (err) return null;
  const m = /SleepDisabled\s+(\d)/.exec(stdout);
  return m ? parseInt(m[1], 10) : 0;
}

/** Run `pmset -a disablesleep <value>` elevated via one auth prompt. */
async function setDisableSleep(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1) {
    return { ok: false, denied: false, error: 'invalid value' };
  }
  const script = `do shell script "/usr/bin/pmset -a disablesleep ${value}" with administrator privileges`;
  const { err, stderr } = await runFile('osascript', ['-e', script]);
  if (err) {
    // User dismissed the auth dialog → AppleScript error -128 ("User canceled").
    const denied = /User canceled|-128/.test(stderr) || /User canceled|-128/.test(err.message || '');
    return { ok: false, denied, error: err.message };
  }
  return { ok: true, denied: false };
}

/** Capture the original, then disable sleep. */
async function override() {
  const orig = await readDisableSleep();
  const res = await setDisableSleep(1);
  const out = { ok: res.ok, denied: res.denied, skipped: false, saved: null };
  if (res.ok) {
    out.saved = { disableSleep: orig === null ? 0 : orig };
    // Confirm it actually took.
    const now = await readDisableSleep();
    if (now !== 1) out.skipped = true;
  }
  return out;
}

/** Restore the saved original sleep-disable flag (default 0). */
async function restore(saved) {
  const v = saved && Number.isInteger(saved.disableSleep) ? saved.disableSleep : 0;
  return setDisableSleep(v);
}

module.exports = { override, restore, readDisableSleep };
