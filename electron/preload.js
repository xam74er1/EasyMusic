'use strict';

const { contextBridge } = require('electron');

// The main process passes the backend port via additionalArguments
// so the preload can expose it to the renderer without needing ipcRenderer.
const portArg = process.argv.find((a) => a.startsWith('--backend-port='));
const backendPort = portArg ? parseInt(portArg.split('=')[1], 10) : 8000;

contextBridge.exposeInMainWorld('electronAPI', {
  backendPort,
});
