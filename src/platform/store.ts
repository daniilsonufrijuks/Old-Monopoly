import { DEFAULT_SETTINGS } from '../settings/defaults';
import { validateSaveRecord, type SaveRecord } from '../storage/validate';
import type { SaveSummary, Settings } from './types';

const SETTINGS_KEY = 'classic-monopoly-settings';
const SAVES_KEY = 'classic-monopoly-saves';

function readLocalSaves(): SaveRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVES_KEY) || '[]') as unknown[];
    return parsed.flatMap((entry) => {
      const save = validateSaveRecord(entry);
      return save.ok ? [save.save] : [];
    });
  } catch {
    return [];
  }
}

export const store = {
  async settings(): Promise<Settings> {
    if (window.desktop) return window.desktop.getSettings();
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },
  async saveSettings(settings: Settings): Promise<Settings> {
    if (window.desktop) return window.desktop.setSettings(settings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  },
  async listSaves(): Promise<SaveSummary[]> {
    if (window.desktop) return window.desktop.listSaves();
    return readLocalSaves()
      .map(({ state: _state, sessions: _sessions, ...summary }) => summary)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async saveGame(record: SaveRecord): Promise<{ ok: boolean; error?: string }> {
    const parsed = validateSaveRecord(record);
    if (!parsed.ok) return parsed;
    if (window.desktop) return window.desktop.saveGame(parsed.save);
    const saves = readLocalSaves().filter((save) => save.id !== parsed.save.id);
    saves.push(parsed.save);
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    return { ok: true };
  },
  async loadGame(id: string): Promise<{ ok: true; save: SaveRecord } | { ok: false; error: string }> {
    if (window.desktop) return window.desktop.loadGame(id);
    const save = readLocalSaves().find((entry) => entry.id === id);
    return save ? { ok: true, save } : { ok: false, error: 'Save not found' };
  },
  async deleteSave(id: string): Promise<void> {
    if (window.desktop) return window.desktop.deleteSave(id);
    localStorage.setItem(SAVES_KEY, JSON.stringify(readLocalSaves().filter((save) => save.id !== id)));
  },
};
