'use strict';

const crypto = require('crypto');
const { spawn } = require('child_process');
const projects = require('./projects');
const agents = require('./agents');
const power = require('./power');

/**
 * Agent runner — the directory-isolation + keep-awake core of HELM.
 *
 * On a task: resolve the projectId to an ALLOWLISTED absolute path (refuse
 * otherwise — agents never run outside an allowlisted folder), resolve the agent
 * to its installed binary, then spawn it with cwd = that folder and the task as a
 * plain argv element. Stream stdout/stderr back through the provided emit()
 * callback as { taskId, stream, chunk }, and signal completion/error at the end.
 *
 * Keep-awake: the FIRST running task takes an 'agent' hold on power.js; the LAST
 * one to finish releases it. This honours the invariant — the sleep inhibitor is
 * active only while an agent is actually running, and is released when idle,
 * without disturbing the user's manual toggle.
 *
 * SECURITY: the task string is passed as a single argv entry to spawn() with
 * shell:false — it is never concatenated into a command line we build. .cmd/.bat
 * shims are run via `cmd.exe /c <path> <args...>` (still an argv array, no shell
 * string assembled here).
 */

const isWin = process.platform === 'win32';
const active = new Map(); // taskId -> child process
let onChange = null;      // fired whenever the active-task count changes (UI/keep-awake)

/**
 * Spawn an agent for a task.
 * @param {{projectId,agentId,task,taskId?}} req
 * @param {(type:string, payload:object)=>void} emit  send a host->client message
 * @returns {string|null} taskId, or null if rejected (emit already told the client)
 */
function run(req, emit) {
  const taskId = req.taskId || crypto.randomUUID();
  const task = typeof req.task === 'string' ? req.task.trim() : '';

  if (!task) { emit('task_error', { taskId, message: 'empty task' }); return null; }

  // Defense-in-depth against argv flag-smuggling: a task that begins with "-"
  // could be parsed by an agent CLI as an option rather than the prompt. The
  // recipes already insert the `--` end-of-options sentinel; this guards any CLI
  // that doesn't honour it. (Markdown bullets etc. can be reworded.)
  if (task.startsWith('-')) {
    emit('task_error', { taskId, message: 'task must not start with "-"' });
    return null;
  }

  // --- directory isolation: only ever inside an allowlisted folder ---
  const cwd = projects.resolvePath(req.projectId);
  if (!cwd) {
    emit('task_error', { taskId, message: 'project not allowlisted (or folder missing)' });
    return null;
  }

  const agent = agents.get(req.agentId);
  if (!agent) { emit('task_error', { taskId, message: 'agent not available' }); return null; }

  // Build argv: [agentBin, ...agentArgs(task)]. Route .cmd/.bat through cmd.exe.
  const agentArgs = agent.args(task);
  let cmd = agent.binPath;
  let args = agentArgs;
  if (isWin && /\.(cmd|bat)$/i.test(agent.binPath)) {
    cmd = process.env.ComSpec || 'cmd.exe';
    args = ['/c', agent.binPath, ...agentArgs];
  }

  let child;
  try {
    child = spawn(cmd, args, {
      cwd,
      shell: false,                 // never a shell string — argv only
      windowsHide: true,
      env: process.env,             // agent needs the laptop's PATH/credentials
      // No stdin to give: ignore it so CLIs (e.g. claude -p) don't wait on a pipe.
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    emit('task_error', { taskId, message: `failed to start agent: ${err.message}` });
    return null;
  }

  // First active task → take the keep-awake hold.
  if (active.size === 0) power.enable('agent').catch(() => {});
  active.set(taskId, child);
  emit('task_started', { taskId });
  if (onChange) try { onChange(); } catch {}

  child.stdout.on('data', (d) => emit('output', { taskId, stream: 'stdout', chunk: d.toString() }));
  child.stderr.on('data', (d) => emit('output', { taskId, stream: 'stderr', chunk: d.toString() }));

  child.on('error', (err) => {
    emit('task_error', { taskId, message: err.message });
    finish(taskId);
  });
  child.on('close', (code) => {
    emit('task_complete', { taskId, code: code == null ? -1 : code });
    finish(taskId);
  });

  return taskId;
}

function finish(taskId) {
  active.delete(taskId);
  // Last task done → release the keep-awake hold (won't disturb a manual 'user' hold).
  if (active.size === 0) power.disable('agent').catch(() => {});
  if (onChange) try { onChange(); } catch {}
}

/** Kill a running task (used on quit / disconnect cleanup). */
function cancel(taskId) {
  const child = active.get(taskId);
  if (child) { try { child.kill(); } catch {} }
}

/** Kill everything (app quitting). */
function cancelAll() {
  for (const id of [...active.keys()]) cancel(id);
}

function activeCount() { return active.size; }
function setOnChange(cb) { onChange = cb; }

module.exports = { run, cancel, cancelAll, activeCount, setOnChange };
