import { useEffect, useState } from 'react';
import type { GameState, NewGameConfig } from './game/types';
import type { SaveRecord } from './storage/validate';
import { HostScreen, JoinScreen, MainMenu, SavesScreen, SettingsScreen, SoloSetup } from './screens/home';
import { SoloTable } from './screens/tables';
import { SettingsProvider, useSettings } from './settings/SettingsContext';

type Screen =
  | { name: 'menu' }
  | { name: 'solo' }
  | { name: 'host'; resume?: SaveRecord }
  | { name: 'join' }
  | { name: 'settings' }
  | { name: 'saves' }
  | { name: 'play'; config?: NewGameConfig; resume?: GameState };

const HELP: Record<string, { title: string; body: string }> = {
  rules: {
    title: 'How to play',
    body: 'Roll the dice and move clockwise. Buy streets, railroads, and utilities, or let them go to auction. Rent rises with a color set, houses, and hotels. Build evenly. Three doubles sends you to jail. Pay $50, use a card, or roll doubles to leave. The last player who is not bankrupt wins.',
  },
  firewall: {
    title: 'Playing on your network',
    body: 'The host computer runs the game. Other players connect to its local IP and room code. If Windows asks, allow Classic Monopoly on private networks. You can also open Windows Security, choose Firewall & network protection, then Allow an app through firewall. No internet, account, or cloud server is required. If the host quits, the table ends. The host can resume the autosave later; the game does not migrate to another computer.',
  },
  about: {
    title: 'Classic Monopoly',
    body: 'A desktop table for solo play and same-network multiplayer. The host keeps the official board. Saved games stay on this computer.',
  },
  quit: {
    title: 'Leave this game?',
    body: 'The current match is still going. Solo games are autosaved. A LAN table ends for everyone if the host quits.',
  },
};

function Shell() {
  const { ready } = useSettings();
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [help, setHelp] = useState<string | null>(null);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    const stopMenu = desktop.onMenu((action) => {
      if (action === 'rules' || action === 'firewall' || action === 'about') setHelp(action);
      if (action === 'solo') setScreen({ name: 'solo' });
      if (action === 'host') setScreen({ name: 'host' });
      if (action === 'join') setScreen({ name: 'join' });
      if (action === 'settings') setScreen({ name: 'settings' });
      if (action === 'saves') setScreen({ name: 'saves' });
      if (action === 'menu') setScreen({ name: 'menu' });
      if (action === 'roll' || action === 'end-turn' || action === 'save') {
        window.dispatchEvent(new CustomEvent('monopoly-menu', { detail: action }));
      }
    });
    const stopQuit = desktop.onQuitRequest(() => setHelp('quit'));
    return () => {
      stopMenu();
      stopQuit();
    };
  }, []);

  if (!ready) return <div className="grid h-full place-items-center font-display text-2xl text-[#f8e7c4]">Shuffling the deck…</div>;

  return (
    <div className="h-full">
      {screen.name === 'menu' && <MainMenu onSolo={() => setScreen({ name: 'solo' })} onHost={() => setScreen({ name: 'host' })} onJoin={() => setScreen({ name: 'join' })} onSettings={() => setScreen({ name: 'settings' })} onSaves={() => setScreen({ name: 'saves' })} />}
      {screen.name === 'solo' && <SoloSetup onBack={() => setScreen({ name: 'menu' })} onStart={(config) => setScreen({ name: 'play', config })} />}
      {screen.name === 'settings' && <SettingsScreen onBack={() => setScreen({ name: 'menu' })} />}
      {screen.name === 'saves' && <SavesScreen onBack={() => setScreen({ name: 'menu' })} onResumeSolo={(resume) => setScreen({ name: 'play', resume })} onResumeLan={(resume) => setScreen({ name: 'host', resume })} />}
      {screen.name === 'host' && <HostScreen resume={screen.resume} onBack={() => setScreen({ name: 'menu' })} />}
      {screen.name === 'join' && <JoinScreen onBack={() => setScreen({ name: 'menu' })} />}
      {screen.name === 'play' && <SoloTable setup={screen.config} resume={screen.resume} onExit={() => setScreen({ name: 'menu' })} />}
      {help && HELP[help] && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-6">
          <article className="paper-panel max-w-lg rounded-xl p-6 text-ink">
            <h2 className="font-display text-2xl">{HELP[help].title}</h2>
            <p className="mt-3 leading-relaxed">{HELP[help].body}</p>
            <div className="mt-4 flex gap-2">
              {help === 'quit' && <button className="gold-button rounded-md px-3 py-2 text-xs" onClick={() => void window.desktop?.quit()}>Quit</button>}
              <button className="rounded-md border px-3 py-2 text-xs" onClick={() => setHelp(null)}>Close</button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}
