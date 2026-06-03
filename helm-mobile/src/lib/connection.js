import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { T } from '../protocol';

/**
 * RelayConnection — the phone's persistent link to the relay, and the engine
 * behind the whole Project -> Agent -> Task -> Progress -> Result flow. It speaks
 * the exact protocol proven by helm-relay/sim/sim.js:
 *
 *   open socket -> client_hello { token }
 *   peer_online -> the laptop is reachable -> auto-send `list`
 *   catalog     -> { projects[], agents[] } to show
 *   submit_task -> task_started -> output… -> task_complete | task_error
 *
 * Reconnects with capped exponential backoff so a flaky phone network never
 * leaves the UI stuck. All state lives here and is published via a snapshot;
 * the React layer below just subscribes and re-renders. The phone never holds
 * code or secrets — only the streamed output text, kept in memory for the run.
 */

const MAX_LINES = 4000; // cap streamed output so a chatty agent can't OOM the phone

// Connection status the UI renders:
//   'idle'         no pairing configured yet
//   'connecting'   socket opening / handshaking with the relay
//   'waiting'      relay reached, but the laptop (peer) is offline
//   'online'       the laptop is reachable — ready to work
//   'disconnected' socket dropped; a reconnect is scheduled
export class RelayConnection {
  constructor() {
    this.ws = null;
    this.relay = null;
    this.token = null;
    this.stopped = true;
    this.backoff = 1000;
    this.reconnectTimer = null;
    this.pingTimer = null;

    this.listeners = new Set();
    this.state = {
      status: 'idle',
      projects: [],
      agents: [],
      selectedAgentId: null,
      task: emptyTask(),
    };
  }

  // ---- subscription ----
  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  getSnapshot() {
    return this.state;
  }
  _set(partial) {
    this.state = { ...this.state, ...partial };
    for (const cb of this.listeners) cb(this.state);
  }
  _setTask(partial) {
    this._set({ task: { ...this.state.task, ...partial } });
  }

  // ---- lifecycle ----
  configure({ relay, token }) {
    this.relay = relay;
    this.token = token;
  }

  start() {
    if (!this.relay || !this.token) return;
    this.stopped = false;
    this.backoff = 1000;
    this._connect();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    if (this.ws) {
      try {
        this.ws.onclose = null; // we're tearing down on purpose; don't reconnect
        this.ws.close();
      } catch {
        /* already closed */
      }
    }
    this.ws = null;
    this._set({ status: 'idle' });
  }

  /** Re-point at a new relay/token (after a fresh pairing) and reconnect. */
  reconfigure(pairing) {
    this.stop();
    this.configure(pairing);
    this.start();
  }

  _connect() {
    if (this.stopped) return;
    this._set({ status: 'connecting' });
    let ws;
    try {
      ws = new WebSocket(this.relay);
    } catch {
      this._scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this._send(T.CLIENT_HELLO, { token: this.token });
      // app-level keepalive so the relay's 30s heartbeat always has traffic
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this._send(T.PING), 20000);
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this._handle(msg);
    };

    ws.onerror = () => {
      // the close handler that follows drives the reconnect
    };

    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.stopped) return;
      this._set({ status: 'disconnected' });
      this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this._connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 15000);
  }

  /** User-driven immediate retry (the "Try again" button). */
  retryNow() {
    if (this.stopped) {
      this.start();
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.backoff = 1000;
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this._connect();
  }

  _send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type, ...payload }));
      } catch {
        /* socket gone */
      }
    }
  }

  _handle(msg) {
    switch (msg.type) {
      case T.PEER_ONLINE:
        this._set({ status: 'online' });
        this._send(T.LIST); // auto-fetch the catalog the moment the laptop is reachable
        break;
      case T.PEER_OFFLINE:
        this._set({ status: 'waiting' });
        break;
      case T.PONG:
        break;
      case T.RELAY_ERROR:
        // surface relay-level problems into a running task if there is one
        if (this.state.task.status === 'running') {
          this._appendLine('stderr', `[relay] ${msg.message || 'error'}\n`);
        }
        break;
      case T.CATALOG: {
        const projects = Array.isArray(msg.projects) ? msg.projects : [];
        const agents = Array.isArray(msg.agents) ? msg.agents : [];
        // keep a valid agent selected: first detected one by default
        let selectedAgentId = this.state.selectedAgentId;
        if (!agents.find((a) => a.id === selectedAgentId)) {
          selectedAgentId = agents.length ? agents[0].id : null;
        }
        this._set({ projects, agents, selectedAgentId });
        break;
      }
      case T.TASK_STARTED:
        this._setTask({ status: 'running', taskId: msg.taskId, startedAt: Date.now() });
        break;
      case T.OUTPUT:
        if (msg.taskId === this.state.task.taskId) {
          this._appendLine(msg.stream || 'stdout', msg.chunk || '');
        }
        break;
      case T.TASK_COMPLETE:
        if (msg.taskId === this.state.task.taskId) {
          this._setTask({
            status: 'done',
            code: typeof msg.code === 'number' ? msg.code : -1,
            endedAt: Date.now(),
          });
        }
        break;
      case T.TASK_ERROR:
        // task_error can arrive before task_started (e.g. rejected task), so don't gate on taskId
        this._setTask({
          status: 'error',
          message: msg.message || 'agent error',
          endedAt: Date.now(),
        });
        break;
      default:
        break;
    }
  }

  _appendLine(stream, chunk) {
    const lines = this.state.task.lines.concat([{ stream, chunk }]);
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    this._setTask({ lines });
  }

  // ---- actions the UI calls ----
  refresh() {
    this._send(T.LIST);
  }

  selectAgent(agentId) {
    this._set({ selectedAgentId: agentId });
  }

  /** Begin a run. Returns false if we can't (offline / missing selection). */
  submitTask({ projectId, projectName, agentId, agentName, task }) {
    if (this.state.status !== 'online') return false;
    if (!projectId || !agentId || !task || !task.trim()) return false;
    this._set({
      task: {
        ...emptyTask(),
        status: 'running',
        text: task.trim(),
        projectId,
        projectName,
        agentId,
        agentName,
        startedAt: Date.now(),
      },
    });
    this._send(T.SUBMIT_TASK, { projectId, agentId, task: task.trim() });
    return true;
  }

  /**
   * Local cancel. The MVP protocol has no cancel_task message (see
   * helm-relay/protocol.js), so this stops the phone listening and resets the UI;
   * the laptop run finishes on its own. A real remote-cancel is roadmap.
   */
  resetTask() {
    this._set({ task: emptyTask() });
  }
}

function emptyTask() {
  return {
    status: 'idle', // 'idle' | 'running' | 'done' | 'error'
    taskId: null,
    text: '',
    projectId: null,
    projectName: null,
    agentId: null,
    agentName: null,
    lines: [], // [{ stream:'stdout'|'stderr', chunk:string }]
    code: null,
    message: null,
    startedAt: null,
    endedAt: null,
  };
}

// ---- React glue ----------------------------------------------------------

const RelayContext = createContext(null);

export function RelayProvider({ children }) {
  // one connection instance for the app's lifetime
  const connRef = useRef(null);
  if (!connRef.current) connRef.current = new RelayConnection();
  const conn = connRef.current;

  const [snapshot, setSnapshot] = useState(conn.getSnapshot());

  useEffect(() => {
    const unsub = conn.subscribe(setSnapshot);
    return unsub;
  }, [conn]);

  const value = { conn, ...snapshot };
  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
}

export function useRelay() {
  const ctx = useContext(RelayContext);
  if (!ctx) throw new Error('useRelay must be used inside <RelayProvider>');
  return ctx;
}
