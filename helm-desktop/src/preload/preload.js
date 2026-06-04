'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * The ONLY bridge between the sandboxed UI and the main process.
 * The renderer gets exactly these functions — no ipcRenderer, no require,
 * no Node. Each call maps to one whitelisted IPC channel in main.js.
 */
const api = {
  // read-only platform string so the UI can adapt copy + window controls
  platform: process.platform,

  getStatus:    () => ipcRenderer.invoke('status:get'),
  setKeepAwake: (on) => ipcRenderer.invoke('keepAwake:set', !!on),
  getSettings:  () => ipcRenderer.invoke('settings:get'),
  setSettings:  (partial) => ipcRenderer.invoke('settings:set', partial),

  // --- HELM agent control ---
  getPairing:   () => ipcRenderer.invoke('pairing:get'),
  regeneratePairing: () => ipcRenderer.invoke('pairing:regenerate'),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  addProject:   () => ipcRenderer.invoke('projects:add'),
  removeProject:(id) => ipcRenderer.invoke('projects:remove', id),
  listAgents:   () => ipcRenderer.invoke('agents:list'),
  rescanAgents: () => ipcRenderer.invoke('agents:rescan'),
  getRelayStatus: () => ipcRenderer.invoke('relay:status'),
  // push: relay/peer connection changes
  onRelay: (cb) => {
    const handler = (_e, status) => cb(status);
    ipcRenderer.on('relay:update', handler);
    return () => ipcRenderer.removeListener('relay:update', handler);
  },
  // push: live task events mirrored from the relay client (display only)
  onTask: (cb) => {
    const handler = (_e, ev) => cb(ev);
    ipcRenderer.on('task:update', handler);
    return () => ipcRenderer.removeListener('task:update', handler);
  },

  // window chrome (frameless custom titlebar)
  minimize: () => ipcRenderer.invoke('win:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('win:toggleMaximize'),
  hide:     () => ipcRenderer.invoke('win:hide'),
  quit:     () => ipcRenderer.invoke('app:quit'),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),

  // full <-> mini window mode (mini = small always-on-top widget)
  setMode: (mode) => ipcRenderer.invoke('win:setMode', mode),
  getMode: () => ipcRenderer.invoke('win:getMode'),

  // push updates from main (tray toggles etc.)
  onStatus: (cb) => {
    const handler = (_e, status) => cb(status);
    ipcRenderer.on('status:update', handler);
    return () => ipcRenderer.removeListener('status:update', handler);
  },

  // main tells the renderer which window mode is active (e.g. restored on launch)
  onMode: (cb) => {
    const handler = (_e, mode) => cb(mode);
    ipcRenderer.on('mode:update', handler);
    return () => ipcRenderer.removeListener('mode:update', handler);
  }
};

contextBridge.exposeInMainWorld('helm', Object.freeze(api));
