import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../src/platform/types';

const desktop: DesktopBridge = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  listSaves: () => ipcRenderer.invoke('saves:list'),
  saveGame: (record) => ipcRenderer.invoke('saves:put', record),
  loadGame: (id) => ipcRenderer.invoke('saves:get', id),
  deleteSave: (id) => ipcRenderer.invoke('saves:delete', id),
  hostLan: (input) => ipcRenderer.invoke('lan:host', input),
  stopLan: () => ipcRenderer.invoke('lan:stop'),
  restoreLan: (save) => ipcRenderer.invoke('lan:restore', save),
  watchLan: (start) => ipcRenderer.invoke('lan:watch', start),
  addresses: () => ipcRenderer.invoke('lan:addresses'),
  setGameActive: (active) => ipcRenderer.invoke('app:game-active', active),
  quit: () => ipcRenderer.invoke('app:quit'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  version: () => ipcRenderer.invoke('app:version'),
  onMenu: (handler) => {
    const listener = (_event: unknown, action: string) => handler(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
  onQuitRequest: (handler) => {
    const listener = () => handler();
    ipcRenderer.on('app:confirm-quit', listener);
    return () => ipcRenderer.removeListener('app:confirm-quit', listener);
  },
  onLanFound: (handler) => {
    const listener = (_event: unknown, table: Parameters<DesktopBridge['onLanFound']>[0] extends (arg: infer T) => void ? T : never) => handler(table);
    ipcRenderer.on('lan:found', listener);
    return () => ipcRenderer.removeListener('lan:found', listener);
  },
  onLanClosed: (handler) => {
    const listener = (_event: unknown, reason: string) => handler(reason);
    ipcRenderer.on('lan:closed', listener);
    return () => ipcRenderer.removeListener('lan:closed', listener);
  },
};

contextBridge.exposeInMainWorld('desktop', desktop);
