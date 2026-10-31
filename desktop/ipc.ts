import { app, ipcMain, type BrowserWindow } from 'electron';
import { LANServer } from '../src/multiplayer/server/LANServer';
import { isGameMode, tableRules } from '../src/game/modes';
import type { Language } from '../src/i18n';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { isTheme } from '../src/settings/themes';
import type { Settings } from '../src/platform/types';
import { validateSaveRecord } from '../src/storage/validate';
import type { AppDatabase } from './database';
import { DiscoveryBeacon, DiscoveryListener, lanAddresses } from './discovery';

interface HostState {
  server: LANServer | null;
  beacon: DiscoveryBeacon;
  listener: DiscoveryListener;
  port: number;
}

function readSettings(input: unknown): Settings {
  const raw = input && typeof input === 'object' ? (input as Partial<Settings>) : {};
  const name = String(raw.playerName ?? DEFAULT_SETTINGS.playerName).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16);
  const port = Number(raw.port);
  const cash = Number(raw.startingCash);
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    playerName: name || 'Player',
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : DEFAULT_SETTINGS.port,
    startingCash: Number.isInteger(cash) && cash >= 500 && cash <= 3000 ? cash : DEFAULT_SETTINGS.startingCash,
    volume: Math.min(1, Math.max(0, Number(raw.volume ?? DEFAULT_SETTINGS.volume))),
    token: raw.token ?? DEFAULT_SETTINGS.token,
    turnSpeed: raw.turnSpeed === 'slow' || raw.turnSpeed === 'leisurely' || raw.turnSpeed === 'relaxed' || raw.turnSpeed === 'fast' ? raw.turnSpeed : 'normal',
    theme: isTheme(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    gameMode: isGameMode(raw.gameMode) ? raw.gameMode : DEFAULT_SETTINGS.gameMode,
    language: raw.language === 'ru' ? 'ru' as Language : 'en',
    diceStyle: raw.diceStyle === 'ebony' || raw.diceStyle === 'wood' ? raw.diceStyle : 'ivory',
    lighting: raw.lighting === 'night' ? 'night' : 'day',
    commentary: Boolean(raw.commentary),
    played: Number.isInteger(raw.played) && (raw.played ?? 0) >= 0 ? raw.played ?? 0 : 0,
    won: Number.isInteger(raw.won) && (raw.won ?? 0) >= 0 ? raw.won ?? 0 : 0,
    extraCardText: String(raw.extraCardText ?? '').slice(0, 80),
    extraCardAmount: Number.isInteger(raw.extraCardAmount) ? Math.max(-500, Math.min(500, raw.extraCardAmount ?? 0)) : 50,
    disconnectMode: raw.disconnectMode === 'wait' ? 'wait' : 'autoplay',
  };
}

export function registerIpc(
  db: AppDatabase,
  win: BrowserWindow,
  host: HostState,
  flags: { getGameActive: () => boolean; setGameActive: (active: boolean) => void; requestQuit: () => void },
): void {
  const publishBeacon = () => {
    if (!host.server) return;
    const lobby = host.server.lobby();
    host.beacon.update({
      roomCode: lobby.roomCode,
      roomName: lobby.roomName,
      hostName: lobby.hostName,
      port: host.port,
      players: lobby.players.length,
      maxPlayers: 6,
    });
  };

  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:set', (_event, input: unknown) => db.setSettings(readSettings(input)));
  ipcMain.handle('saves:list', () => db.listSaves());
  ipcMain.handle('saves:put', (_event, input: unknown) => {
    const parsed = validateSaveRecord(input);
    if (!parsed.ok) return parsed;
    return db.saveGame(parsed.save);
  });
  ipcMain.handle('saves:get', (_event, id: unknown) => db.loadGame(String(id ?? '')));
  ipcMain.handle('saves:delete', (_event, id: unknown) => db.deleteSave(String(id ?? '')));
  ipcMain.handle('lan:addresses', () => lanAddresses());
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:game-active', (_event, active: unknown) => flags.setGameActive(Boolean(active)));
  ipcMain.handle('app:quit', () => flags.requestQuit());
  ipcMain.handle('window:minimize', () => win.minimize());
  ipcMain.handle('window:fullscreen', () => {
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
  });

  ipcMain.handle('lan:host', async (_event, input: unknown) => {
    const body = input && typeof input === 'object' ? (input as { hostName?: unknown; port?: unknown; rules?: unknown }) : {};
    const settings = readSettings(body.rules);
    const hostName = String(body.hostName ?? settings.playerName).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16) || 'Host';
    await stopHost(host, 'The host started a new table.');
    const server = new LANServer({
      port: Number(body.port) || settings.port,
      hostName,
      rules: tableRules(settings),
      onState: (state, sessions) => {
        db.saveGame({
          id: 'lan-autosave',
          name: 'LAN autosave',
          mode: 'lan',
          updatedAt: Date.now(),
          state,
          sessions,
        });
        publishBeacon();
      },
    });
    try {
      const started = await server.start();
      host.server = server;
      host.port = started.port;
      publishBeacon();
      return { ...started, addresses: lanAddresses() };
    } catch (error) {
      await server.close('The table failed to start.');
      throw error instanceof Error ? error : new Error('The LAN table could not start.');
    }
  });

  ipcMain.handle('lan:restore', async (_event, input: unknown) => {
    const parsed = validateSaveRecord(input);
    if (!parsed.ok) return parsed;
    if (!host.server) return { ok: false, error: 'Host a table before restoring a LAN save' };
    if (parsed.save.mode !== 'lan') return { ok: false, error: 'That save is a solo game' };
    host.server.restore(parsed.save.state, parsed.save.sessions ?? {});
    win.webContents.send('lan:restored');
    return { ok: true };
  });

  ipcMain.handle('lan:stop', async () => {
    await stopHost(host, 'The host closed the table. This match is no longer available.');
  });

  ipcMain.handle('lan:watch', async (event, start: unknown) => {
    if (!start) {
      host.listener.stop();
      return { ok: true };
    }
    try {
      await host.listener.start((table) => event.sender.send('lan:found', table));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Discovery failed' };
    }
  });
}

export async function stopHost(host: HostState, reason: string): Promise<void> {
  host.beacon.stop();
  host.listener.stop();
  const server = host.server;
  host.server = null;
  if (server) await server.close(reason);
}
