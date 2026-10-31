import { app, session } from 'electron';
import path from 'node:path';
import { AppDatabase } from './database';
import { DiscoveryBeacon, DiscoveryListener } from './discovery';
import { registerIpc, stopHost } from './ipc';
import { createMenu, createWindow } from './window';

const userDataFlag = process.argv.find((arg) => arg.startsWith('--user-data-dir='));
if (userDataFlag) app.setPath('userData', path.resolve(userDataFlag.slice('--user-data-dir='.length)));

app.setName('Classic Monopoly');
if (process.platform === 'win32') app.setAppUserModelId('com.classicmonopoly.desktop');

const database = new AppDatabase();
const host = { server: null, beacon: new DiscoveryBeacon(), listener: new DiscoveryListener(), port: 3000 };
let gameActive = false;
let quitting = false;

function shutdown(): void {
  void stopHost(host, 'The host closed Classic Monopoly. This table is no longer available. Ask the host to resume the save if you want to continue.');
}

app.whenReady().then(async () => {
  await database.open();
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders };
      headers['Content-Security-Policy'] = [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http: ws:;",
      ];
      callback({ responseHeaders: headers });
    });
  }
  const win = createWindow();
  createMenu(win);
  registerIpc(database, win, host, {
    getGameActive: () => gameActive,
    setGameActive: (active) => {
      gameActive = active;
    },
    requestQuit: () => {
      quitting = true;
      win.close();
    },
  });
  win.on('close', (event) => {
    if (gameActive && !quitting) {
      event.preventDefault();
      win.webContents.send('app:confirm-quit');
    }
  });
  app.on('activate', () => {
    if (win.isDestroyed()) createWindow();
  });
}).catch((error: unknown) => {
  console.error(error);
  app.quit();
});

app.on('before-quit', () => {
  quitting = true;
  shutdown();
});

app.on('window-all-closed', () => {
  shutdown();
  if (process.platform !== 'darwin') app.quit();
});
