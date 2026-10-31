import type { GameModeId, GameState, TokenId } from '../game/types';
import type { ThemeId } from '../settings/themes';
import type { DiscoveryBeacon } from '../multiplayer/protocol';
import type { SaveRecord } from '../storage/validate';

export interface Settings {
  playerName: string;
  token: TokenId;
  sound: boolean;
  volume: number;
  reducedMotion: boolean;
  turnSpeed: 'relaxed' | 'normal' | 'fast';
  theme: ThemeId;
  gameMode: GameModeId;
  port: number;
  startingCash: number;
  freeParkingPot: boolean;
  auctions: boolean;
  incomeTaxChoice: boolean;
  disconnectMode: 'wait' | 'autoplay';
}

export interface HostInfo {
  port: number;
  roomCode: string;
  hostToken: string;
  addresses: string[];
}

export interface FoundTable extends DiscoveryBeacon {
  address: string;
}

export interface DesktopBridge {
  getSettings: () => Promise<Settings>;
  setSettings: (settings: Settings) => Promise<Settings>;
  listSaves: () => Promise<Array<Omit<SaveRecord, 'state' | 'sessions'> & { updatedAt: number }>>;
  saveGame: (record: SaveRecord) => Promise<{ ok: boolean; error?: string }>;
  loadGame: (id: string) => Promise<{ ok: true; save: SaveRecord } | { ok: false; error: string }>;
  deleteSave: (id: string) => Promise<void>;
  hostLan: (input: { hostName: string; port: number; rules: Settings }) => Promise<HostInfo>;
  stopLan: () => Promise<void>;
  restoreLan: (save: SaveRecord) => Promise<{ ok: boolean; error?: string }>;
  watchLan: (start: boolean) => Promise<{ ok: boolean; error?: string }>;
  addresses: () => Promise<string[]>;
  setGameActive: (active: boolean) => Promise<void>;
  quit: () => Promise<void>;
  minimize: () => Promise<void>;
  toggleFullscreen: () => Promise<boolean>;
  version: () => Promise<string>;
  onMenu: (handler: (action: string) => void) => () => void;
  onQuitRequest: (handler: () => void) => () => void;
  onLanFound: (handler: (table: FoundTable) => void) => () => void;
  onLanClosed: (handler: (reason: string) => void) => () => void;
}

export type SaveSummary = Awaited<ReturnType<DesktopBridge['listSaves']>>[number];

export interface StoredSave extends SaveRecord {
  state: GameState;
}
