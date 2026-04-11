'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The main process passes the initial backend port via additionalArguments
const portArg = process.argv.find((a) => a.startsWith('--backend-port='));
const initialPort = portArg ? parseInt(portArg.split('=')[1], 10) : 8000;

contextBridge.exposeInMainWorld('electronAPI', {
  backendPort: initialPort,
  changeBackendPort: (port) => ipcRenderer.invoke('change-backend-port', port),
  onBackendPortUpdated: (callback) => ipcRenderer.on('backend-port-updated', (_event, value) => callback(value)),
  getBackendEnv: () => ipcRenderer.invoke('get-backend-env'),
  updateBackendEnv: (env) => ipcRenderer.invoke('update-backend-env', env),
});
