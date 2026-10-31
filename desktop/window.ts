import { BrowserWindow, Menu, app, shell } from 'electron';
import path from 'node:path';

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: 'Classic Monopoly',
    backgroundColor: '#3a2416',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const dev = process.env.ELECTRON_RENDERER_URL;
    const allowed = url.startsWith('file://') || (dev && url.startsWith(dev));
    if (!allowed) event.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  return win;
}

export function createMenu(win: BrowserWindow): void {
  const send = (action: string) => win.webContents.send('menu:action', action);
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New Solo Game', accelerator: 'CmdOrCtrl+N', click: () => send('solo') },
        { label: 'Host LAN Game', click: () => send('host') },
        { label: 'Join LAN Game', click: () => send('join') },
        { type: 'separator' },
        { label: 'Save Game', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Saved Games', accelerator: 'CmdOrCtrl+O', click: () => send('saves') },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Game',
      submenu: [
        { label: 'Roll Dice', accelerator: 'Space', click: () => send('roll') },
        { label: 'End Turn', accelerator: 'CmdOrCtrl+Enter', click: () => send('end-turn') },
        { type: 'separator' },
        { label: 'Main Menu', click: () => send('menu') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen', accelerator: 'F11' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'toggleDevTools', visible: !app.isPackaged },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'How to Play', click: () => send('rules') },
        { label: 'Firewall Help', click: () => send('firewall') },
        { label: 'About Classic Monopoly', click: () => send('about') },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}
