'use strict';

const { execFile } = require('child_process');

/**
 * Agent detection + spawn recipes.
 *
 * Scans the laptop for installed AI coding CLIs and exposes only those found.
 * Each agent also carries the recipe runner.js uses to invoke it non-interactively
 * (one-shot: take a task, print output, exit). The task is always passed as a
 * separate argv element — never concatenated into a command string.
 *
 * Public catalog sent to the phone is just { id, name }. The resolved binary path
 * and arg builder stay on the laptop.
 */

const isWin = process.platform === 'win32';

// Registry. `bins` are the executable names to look for, in preference order.
// `args(task)` returns the argv (after the binary) for a non-interactive run.
const REGISTRY = [
  // The `--` end-of-options sentinel makes the CLI treat the task as a positional
  // prompt, never a flag — preventing argv flag-smuggling from a paired client
  // (e.g. a task of "--add-dir /etc" can't become a real option). runner.js also
  // rejects tasks beginning with "-" as defense-in-depth.
  {
    id: 'claude',
    name: 'Claude Code',
    bins: ['claude'],
    args: (task) => ['-p', '--', task]    // -p/--print = non-interactive output
  },
  {
    id: 'codex',
    name: 'Codex',
    bins: ['codex'],
    args: (task) => ['exec', '--', task]  // `codex exec <task>` = non-interactive
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    bins: ['antigravity', 'ag'],
    args: (task) => ['--', task]
  }
];

// id -> { id, name, binPath, args }  (only for agents actually found)
let resolved = new Map();

/** Find the absolute path of a binary on PATH (and common shims), or null. */
function which(bin) {
  return new Promise((resolve) => {
    const finder = isWin ? 'where' : 'which';
    execFile(finder, [bin], { windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      // `where` can return several lines (e.g. codex + codex.cmd). Prefer a
      // directly-spawnable .exe, then .cmd/.bat, then the first line.
      const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return resolve(null);
      const exe = lines.find((l) => /\.exe$/i.test(l));
      const cmd = lines.find((l) => /\.(cmd|bat)$/i.test(l));
      resolve(exe || cmd || lines[0]);
    });
  });
}

/** Scan for every registered agent. Returns the public catalog [{id,name}]. */
async function detect() {
  const found = new Map();
  for (const a of REGISTRY) {
    let binPath = null;
    for (const bin of a.bins) {
      binPath = await which(bin);
      if (binPath) break;
    }
    if (binPath) found.set(a.id, { id: a.id, name: a.name, binPath, args: a.args });
  }
  resolved = found;
  return list();
}

/** Public catalog for the phone — only what's installed, only id + name. */
function list() {
  return [...resolved.values()].map((a) => ({ id: a.id, name: a.name }));
}

/** Internal: the resolved agent (with binPath + args) for the runner, or null. */
function get(agentId) {
  return resolved.get(agentId) || null;
}

module.exports = { detect, list, get };
