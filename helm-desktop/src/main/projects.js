'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { dialog } = require('electron');
const settings = require('./settings');

/**
 * Project allowlist — the ONLY folders the phone can see and the ONLY paths an
 * agent may be spawned inside (see runner.js). Persisted in settings under
 * `projects` as an array of { id, name, path }.
 *
 * Directory isolation depends on this list: runner.js resolves a task's projectId
 * here and refuses to run if the id isn't present, so removing a folder makes it
 * immediately unavailable to the phone.
 */

function all() {
  const list = settings.get('projects');
  return Array.isArray(list) ? list : [];
}

/** Catalog shape sent to the phone — never leaks anything but name + path. */
function list() {
  return all().map((p) => ({ id: p.id, name: p.name, path: p.path }));
}

/** Resolve a projectId to its allowlisted absolute path, or null if not allowed. */
function resolvePath(projectId) {
  const p = all().find((x) => x.id === projectId);
  if (!p) return null;
  // Defence in depth: the stored path must still exist and be a directory.
  try {
    const real = fs.realpathSync(p.path);
    if (fs.statSync(real).isDirectory()) return real;
  } catch { /* gone */ }
  return null;
}

/** Open the native folder picker and add the chosen directory to the allowlist. */
async function add(parentWindow) {
  const res = await dialog.showOpenDialog(parentWindow, {
    title: 'Add a project folder to expose',
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths.length) return list();

  const list_ = all();
  for (const dir of res.filePaths) {
    const abs = path.normalize(dir);
    if (list_.some((p) => path.normalize(p.path) === abs)) continue; // no dupes
    list_.push({ id: crypto.randomUUID(), name: path.basename(abs) || abs, path: abs });
  }
  settings.set('projects', list_);
  return list();
}

/** Remove a project by id → it's instantly invisible to the phone. */
function remove(id) {
  settings.set('projects', all().filter((p) => p.id !== id));
  return list();
}

module.exports = { list, resolvePath, add, remove };
