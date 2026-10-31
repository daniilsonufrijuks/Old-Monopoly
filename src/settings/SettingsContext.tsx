import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { configureSound } from '../audio/sound';
import { store } from '../platform/store';
import type { Settings } from '../platform/types';
import { DEFAULT_SETTINGS } from './defaults';
import { isTheme } from './themes';

interface SettingsValue {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void store.settings().then((loaded) => {
      setSettings(loaded);
      configureSound(loaded.sound, loaded.volume);
      document.documentElement.dataset.theme = isTheme(loaded.theme) ? loaded.theme : 'classic';
      document.documentElement.dataset.lighting = loaded.lighting === 'night' ? 'night' : 'day';
      document.documentElement.dataset.dice = loaded.diceStyle ?? 'ivory';
      setReady(true);
    });
  }, []);

  async function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    configureSound(next.sound, next.volume);
    document.documentElement.dataset.theme = isTheme(next.theme) ? next.theme : 'classic';
    document.documentElement.dataset.lighting = next.lighting === 'night' ? 'night' : 'day';
    document.documentElement.dataset.dice = next.diceStyle ?? 'ivory';
    await store.saveSettings(next);
  }

  return <SettingsContext.Provider value={{ settings, ready, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('Settings are unavailable');
  return value;
}
