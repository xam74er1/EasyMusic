'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

const DEV_MODE = process.env.NODE_ENV === 'development';
const VITE_DEV_URL = process.env.VITE_DEV_URL || 'http://localhost:5173';
const BACKEND_READY_SIGNAL = 'BACKEND_READY';
const BACKEND_STARTUP_TIMEOUT_MS = 30_000;
const MAX_RESTART_ATTEMPTS = 3;
const PORT_RANGE_START = 8000;
const PORT_RANGE_END = 8999;

let mainWindow = null;
let backendProcess = null;
let backendPort = null;
let restartCount = 0;
let isQuitting = false;

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'electron_settings.json');
}

function loadSettings() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (err) {
    console.error('[main] Failed to load settings:', err);
  }
  return {};
}

function saveSettings(settings) {
  try {
    const p = getSettingsPath();
    fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('[main] Failed to save settings:', err);
  }
}

// ---------------------------------------------------------------------------
// 3.1 Port selection
// ---------------------------------------------------------------------------

/**
 * Probe a single port: resolves true if free, false if in use.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Scan ports PORT_RANGE_START–PORT_RANGE_END and return the first free one.
 * Throws if none are available.
 * @returns {Promise<number>}
 */
async function findAvailablePort() {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${PORT_RANGE_START}–${PORT_RANGE_END}`);
}


// ---------------------------------------------------------------------------
// 3.2 Backend spawn logic
// ---------------------------------------------------------------------------

/**
 * Resolve the path to the PyInstaller backend bundle embedded as an extraResource.
 * In production the bundle lives under process.resourcesPath.
 * In development we fall back to a local dist path for manual testing.
 * @returns {string}
 */
function resolveBackendBundlePath() {
  const binaryName = process.platform === 'win32'
    ? 'easymusic-backend.exe'
    : 'easymusic-backend';

  if (DEV_MODE) {
    // Allow developers to point at a locally-built binary
    return process.env.BACKEND_BINARY_PATH
      || path.join(__dirname, '..', 'backend', 'dist', binaryName);
  }

  return path.join(process.resourcesPath, 'backend', binaryName);
}

/**
 * Spawn the backend bundle on the given port.
 * Sets USER_DATA_DIR so the backend stores all user data in the OS-standard location.
 * @param {number} port
 * @returns {import('child_process').ChildProcess}
 */
function spawnBackend(port) {
  const bundlePath = resolveBackendBundlePath();

  if (!fs.existsSync(bundlePath)) {
    throw Object.assign(
      new Error(`Backend binary not found: ${bundlePath}`),
      { code: 'ENOENT', bundlePath }
    );
  }

  // 3.8 Resolve data directory
  const settings = loadSettings();
  const userDataDir = settings.customDataDir || app.getPath('userData');
  const customEnv = settings.backendEnv || {};

  const child = spawn(bundlePath, ['--port', String(port)], {
    env: {
      ...process.env,
      ...customEnv,
      USER_DATA_DIR: userDataDir,
      LOG_TO_FILE: 'TRUE',
      NODE_ENV: DEV_MODE ? 'development' : 'production',
    },
    // Pipe stdout/stderr so we can read the ready signal
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Forward backend stderr to the Electron process stderr for debugging
  child.stderr.on('data', (data) => {
    process.stderr.write(`[backend] ${data}`);
  });

  return child;
}


// ---------------------------------------------------------------------------
// 3.3 Ready signal detection
// ---------------------------------------------------------------------------

/**
 * Wait for the backend process to emit BACKEND_READY on stdout.
 * Resolves when the signal is detected; rejects on timeout or premature exit.
 * @param {import('child_process').ChildProcess} child
 * @returns {Promise<void>}
 */
function waitForBackendReady(child) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let lineBuffer = '';

    const settle = (fn, ...args) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.removeAllListeners('data');
      fn(...args);
    };

    // 30-second startup timeout
    const timer = setTimeout(() => {
      settle(reject, new Error(
        `Backend did not emit ${BACKEND_READY_SIGNAL} within ${BACKEND_STARTUP_TIMEOUT_MS / 1000}s`
      ));
    }, BACKEND_STARTUP_TIMEOUT_MS);

    // Read stdout line-by-line
    child.stdout.on('data', (chunk) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      // Keep the last (potentially incomplete) fragment
      lineBuffer = lines.pop();

      for (const line of lines) {
        process.stdout.write(`[backend] ${line}\n`);
        if (line.trim() === BACKEND_READY_SIGNAL) {
          settle(resolve);
          return;
        }
      }
    });

    // Reject if the process dies before signalling ready
    child.once('exit', (code) => {
      settle(reject, new Error(`Backend exited (code ${code}) before emitting ${BACKEND_READY_SIGNAL}`));
    });
  });
}


// ---------------------------------------------------------------------------
// 3.4 Restart manager
// ---------------------------------------------------------------------------

/**
 * Attach an exit listener that restarts the backend on unexpected crashes.
 * After MAX_RESTART_ATTEMPTS failures, shows an error dialog and exits the app.
 * @param {import('child_process').ChildProcess} child
 * @param {number} port
 */
function attachRestartManager(child, port) {
  child.once('exit', (code, signal) => {
    // Ignore intentional kills triggered by the quit handler
    if (isQuitting) return;

    restartCount += 1;
    console.error(`[main] Backend exited unexpectedly (code=${code}, signal=${signal}). Restart attempt ${restartCount}/${MAX_RESTART_ATTEMPTS}.`);

    if (restartCount > MAX_RESTART_ATTEMPTS) {
      dialog.showErrorBox(
        'EasyMusic — Backend Failure',
        `The backend process crashed ${restartCount} times and could not be restarted.\n\nThe application will now close.`
      );
      app.exit(1);
      return;
    }

    // Attempt restart: spawn a fresh process on the same port
    try {
      backendProcess = spawnBackend(port);
      attachRestartManager(backendProcess, port);

      // Wait for ready signal again; if it fails, treat as another crash
      waitForBackendReady(backendProcess).catch((err) => {
        console.error('[main] Backend failed to become ready after restart:', err.message);
        backendProcess.kill();
      });
    } catch (err) {
      showStartupError(err);
    }
  });
}


// ---------------------------------------------------------------------------
// 3.6 Error dialog helpers for startup failures
// ---------------------------------------------------------------------------

/**
 * Show a user-facing error dialog for startup failures and exit the app.
 * Handles: timeout, binary not found, no available port, and generic errors.
 * @param {Error} err
 */
function showStartupError(err) {
  let title = 'EasyMusic — Startup Error';
  let message;

  if (err.code === 'ENOENT') {
    message = `Could not find the backend binary.\n\nExpected path:\n${err.bundlePath || 'unknown'}\n\nThe application will now close.`;
  } else if (err.message.includes('No available port')) {
    message = `Could not find a free port in the range ${PORT_RANGE_START}–${PORT_RANGE_END}.\n\nPlease free up some ports and try again.\n\nThe application will now close.`;
  } else if (err.message.includes('did not emit')) {
    message = `The backend took too long to start (>${BACKEND_STARTUP_TIMEOUT_MS / 1000}s).\n\nThe application will now close.`;
  } else {
    message = `An unexpected error occurred during startup:\n\n${err.message}\n\nThe application will now close.`;
  }

  dialog.showErrorBox(title, message);
  app.exit(1);
}

// ---------------------------------------------------------------------------
// 3.5 App quit handler
// ---------------------------------------------------------------------------

app.on('before-quit', () => {
  isQuitting = true;
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

// ---------------------------------------------------------------------------
// BrowserWindow factory
// ---------------------------------------------------------------------------

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--backend-port=${port}`],
    },
  });

  // 3.7 Development mode: load Vite dev server; production: load static assets
  if (DEV_MODE) {
    mainWindow.loadURL(VITE_DEV_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// 3.7 App startup — wires everything together
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  try {
    // 3.7 In dev mode, allow skipping backend spawn if SKIP_BACKEND=1
    if (DEV_MODE && process.env.SKIP_BACKEND === '1') {
      const settings = loadSettings();
      backendPort = parseInt(process.env.BACKEND_PORT || settings.preferredBackendPort || '8000', 10);
      console.log(`[main] Dev mode: skipping backend spawn, using port ${backendPort}`);
    } else {
      // 3.1 Find a free port: prioritize saved preference
      const settings = loadSettings();
      const preferredPort = settings.preferredBackendPort;

      if (preferredPort && await isPortFree(preferredPort)) {
        backendPort = preferredPort;
      } else {
        backendPort = await findAvailablePort();
      }

      // 3.2 Spawn the backend
      backendProcess = spawnBackend(backendPort);

      // 3.3 Wait for BACKEND_READY signal
      await waitForBackendReady(backendProcess);

      // 3.4 Attach restart manager (only after first successful start)
      restartCount = 0;
      attachRestartManager(backendProcess, backendPort);
    }

    createWindow(backendPort);
    createNativeMenu();
  } catch (err) {
    showStartupError(err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(backendPort);
    }
  });
});

// ---------------------------------------------------------------------------
// Native Menu Configuration
// ---------------------------------------------------------------------------

function createNativeMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Set Data Library Location...',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory', 'createDirectory'],
              title: 'Select Folder for EasyMusic Data (Database & Tracks)',
              buttonLabel: 'Select Library Folder'
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const newPath = result.filePaths[0];
              const settings = loadSettings();
              
              if (settings.customDataDir === newPath) return;

              settings.customDataDir = newPath;
              saveSettings(settings);

              const response = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['Restart Now', 'Later'],
                title: 'Library Changed',
                message: `Data library set to: ${newPath}\n\nA restart is required to load the new database. Restart backend now?`
              });

              if (response.response === 0) {
                // Restart backend logic (similar to port change)
                if (backendProcess && !backendProcess.killed) {
                  backendProcess.removeAllListeners('exit');
                  backendProcess.kill();
                }
                
                try {
                  const newProcess = spawnBackend(backendPort);
                  await waitForBackendReady(newProcess);
                  backendProcess = newProcess;
                  restartCount = 0;
                  attachRestartManager(backendProcess, backendPort);
                  
                  // Notify frontend to refresh if needed (though the DB change is internal)
                  mainWindow.webContents.reload();
                } catch (err) {
                  dialog.showErrorBox('Restart Failed', err.message);
                }
              }
            }
          }
        },
        {
          label: 'Reveal Data Folder in Explorer',
          click: () => {
            const settings = loadSettings();
            const dataPath = settings.customDataDir || app.getPath('userData');
            if (fs.existsSync(dataPath)) {
              shell.openPath(dataPath);
            } else {
                shell.openPath(app.getPath('userData'));
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About EasyMusic',
          click: async () => {
            await dialog.showMessageBox(mainWindow, {
              title: 'About EasyMusic',
              message: 'EasyMusic - Your AI-Powered Improv Music Assistant',
              detail: 'Version 1.0.0\nBuilt for portable Electron deployment.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ---------------------------------------------------------------------------
// IPC Handlers for Dynamic Port Scaling
// ---------------------------------------------------------------------------

ipcMain.handle('get-backend-port', () => {
  return backendPort;
});

ipcMain.handle('change-backend-port', async (event, newPort) => {
  const targetPort = parseInt(newPort, 10);
  if (isNaN(targetPort) || targetPort < 1024 || targetPort > 65535) {
    throw new Error('Invalid port number');
  }

  if (targetPort === backendPort) return { success: true, port: backendPort };

  const isFree = await isPortFree(targetPort);
  if (!isFree) {
    throw new Error(`Port ${targetPort} is already in use.`);
  }

  console.log(`[main] Restarting backend on new port: ${targetPort}`);

  // 1. Persist the choice
  const settings = loadSettings();
  settings.preferredBackendPort = targetPort;
  saveSettings(settings);

  // 2. Kill current process
  if (backendProcess && !backendProcess.killed) {
    // Temporarily disable the crash-restart manager to avoid double-spawning
    backendProcess.removeAllListeners('exit'); 
    backendProcess.kill();
  }

  try {
    // 3. Spawn new process
    const newProcess = spawnBackend(targetPort);
    await waitForBackendReady(newProcess);
    
    // 4. Update globals and re-attach manager
    backendProcess = newProcess;
    backendPort = targetPort;
    restartCount = 0;
    attachRestartManager(backendProcess, backendPort);

    // 5. Notify all windows
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('backend-port-updated', backendPort);
    });

    return { success: true, port: backendPort };
  } catch (err) {
    // If restart fails, try to go back to a safe port or show error
    console.error('[main] Failed to restart backend on requested port:', err);
    throw err;
  }
});

ipcMain.handle('get-backend-env', () => {
  const settings = loadSettings();
  return settings.backendEnv || {};
});

ipcMain.handle('update-backend-env', async (event, newEnv) => {
  console.log('[main] Updating backend environment variables');

  // 1. Persist
  const settings = loadSettings();
  settings.backendEnv = newEnv;
  saveSettings(settings);

  // 2. Restart backend to apply changes
  // We use current port for the restart
  const targetPort = backendPort;

  if (backendProcess && !backendProcess.killed) {
    backendProcess.removeAllListeners('exit'); 
    backendProcess.kill();
  }

  try {
    const newProcess = spawnBackend(targetPort);
    await waitForBackendReady(newProcess);
    
    backendProcess = newProcess;
    restartCount = 0;
    attachRestartManager(backendProcess, targetPort);

    return { success: true };
  } catch (err) {
    console.error('[main] Failed to restart backend after env update:', err);
    throw err;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
