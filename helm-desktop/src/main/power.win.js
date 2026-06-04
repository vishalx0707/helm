'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Windows lid-close backend for the keep-awake engine.
 *
 * Sets the "when I close the lid" action to "Do nothing" for BOTH AC (plugged)
 * and DC (battery) via powercfg, run elevated through a one-shot UAC prompt.
 *
 * NOTE: On many Windows 11 laptops the lid-close setting is HIDDEN from powercfg
 * (only the power-button setting shows in SUB_BUTTONS). So the elevated batch
 * first unhides it (`/attributes ... -ATTRIB_HIDE`), then captures the current
 * value to a temp file (so we can restore exactly), then writes 0.
 *
 * SECURITY: every powercfg argument is a hard-coded constant or an integer we
 * validated ourselves. No renderer/user string is ever placed in a command.
 *
 * Interface (consumed by power.js):
 *   override()      -> { ok, denied, skipped, saved:{ac,dc}|null }
 *   restore(saved)  -> { ok, denied }
 */

const SUB_BUTTONS = '4f971e89-eebd-4455-a8de-9e59040e7347'; // Power buttons and lid
const LIDACTION   = '5ca83367-6e45-459f-a27b-476b1d01c936'; // Lid close action
const LID_DO_NOTHING = 0;
const ORIG_FILE = path.join(os.tmpdir(), 'helm-lid-orig.txt');

function runFile(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

function parseLid(text) {
  const ac = /Current AC Power Setting Index:\s*0x([0-9a-fA-F]+)/.exec(text);
  const dc = /Current DC Power Setting Index:\s*0x([0-9a-fA-F]+)/.exec(text);
  if (!ac || !dc) return null;
  return { ac: parseInt(ac[1], 16), dc: parseInt(dc[1], 16) };
}

/** Read lid action without elevation (works once it's been unhidden). */
async function readLidAction() {
  const { err, stdout } = await runFile('powercfg', ['/query', 'SCHEME_CURRENT', SUB_BUTTONS, LIDACTION]);
  if (err) return null;
  return parseLid(stdout);
}

/**
 * Run a list of fully-formed command lines elevated, in one UAC prompt.
 * Writes a temp .bat and launches it via `Start-Process -Verb RunAs -Wait`.
 * Returns { ok, denied }.
 *
 */
async function runElevated(lines, tag) {
  const bat = path.join(os.tmpdir(), `helm-${tag}-${Date.now()}.bat`);
  fs.writeFileSync(bat, ['@echo off', ...lines].join('\r\n'), 'utf8');
  const psCommand =
    `try { $p = Start-Process -FilePath '${bat}' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode } ` +
    `catch { exit 1223 }`; // 1223 = ERROR_CANCELLED (user declined UAC)
  const { err } = await runFile('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psCommand
  ]);
  try { fs.unlinkSync(bat); } catch {}
  if (err) return { ok: false, denied: err.code === 1223, error: err.message };
  return { ok: true, denied: false };
}

const ac_set = (v) => `powercfg /setacvalueindex SCHEME_CURRENT ${SUB_BUTTONS} ${LIDACTION} ${v}`;
const dc_set = (v) => `powercfg /setdcvalueindex SCHEME_CURRENT ${SUB_BUTTONS} ${LIDACTION} ${v}`;
const activate = 'powercfg /setactive SCHEME_CURRENT';
const unhide = `powercfg /attributes ${SUB_BUTTONS} ${LIDACTION} -ATTRIB_HIDE`;

/**
 * One elevated batch: unhide → capture original → set both rails to 0 → activate.
 * Returns the captured original as `saved` so power.js can persist it.
 */
async function override() {
  try { fs.unlinkSync(ORIG_FILE); } catch {}
  const res = await runElevated([
    unhide,
    `powercfg /query SCHEME_CURRENT ${SUB_BUTTONS} ${LIDACTION} > "${ORIG_FILE}"`,
    ac_set(LID_DO_NOTHING),
    dc_set(LID_DO_NOTHING),
    activate
  ], 'lid-on');

  const out = { ok: res.ok, denied: res.denied, skipped: false, saved: null };
  if (res.ok) {
    try { out.saved = parseLid(fs.readFileSync(ORIG_FILE, 'utf8')); } catch {}
    // INVARIANT GUARD: never persist our OWN override value (0 = "do nothing") as
    // the "original". If a rail reads 0 here, a prior session was almost certainly
    // killed without restoring, so the real original is lost — fall back to Sleep
    // (1, the Windows default) so OFF/quit can never leave the lid stuck on
    // "do nothing" (which would silently defeat sleep and risk overheating).
    if (out.saved) {
      if (out.saved.ac === LID_DO_NOTHING) out.saved.ac = 1;
      if (out.saved.dc === LID_DO_NOTHING) out.saved.dc = 1;
    }
    // Confirm it actually took (setting may be absent on a true desktop).
    const now = await readLidAction();
    if (!now) out.skipped = true; // no lid setting on this machine
  }
  try { fs.unlinkSync(ORIG_FILE); } catch {}
  return out;
}

/** Restore the saved original lid action for both AC and DC. */
async function restore(saved) {
  if (!saved || ![saved.ac, saved.dc].every((v) => Number.isInteger(v) && v >= 0 && v <= 3)) {
    return { ok: false, denied: false, error: 'invalid saved values' };
  }
  return runElevated([ac_set(saved.ac), dc_set(saved.dc), activate], 'lid-off');
}

module.exports = { override, restore, readLidAction };
