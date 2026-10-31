import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Difficulty, GameModeId, GameState, NewGameConfig, Personality, TokenId } from '../game/types';
import { describeRules, GAME_MODES, rulesForMode, rulesPatch, tableRules } from '../game/modes';
import { THEMES } from '../settings/themes';
import { TableCrest } from '../components/Marks';
import { TableEditor } from '../components/TableEditor';
import type { CompanyPlate } from '../game/board/plates';
import { t } from '../i18n';
import { LANClient } from '../multiplayer/client/LANClient';
import type { LobbySnapshot } from '../multiplayer/server/RoomManager';
import type { FoundTable, HostInfo, SaveSummary } from '../platform/types';
import { store } from '../platform/store';
import { useSettings } from '../settings/SettingsContext';
import { TOKENS, TokenGlyph } from '../components/Tokens';
import { LanTable } from './tables';
import type { SaveRecord } from '../storage/validate';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const PERSONALITIES: Personality[] = ['cautious', 'aggressive', 'trader', 'tycoon', 'opportunist'];

export function MainMenu({ onSolo, onHost, onJoin, onSettings, onSaves }: { onSolo: () => void; onHost: () => void; onJoin: () => void; onSettings: () => void; onSaves: () => void }) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <TableCrest className="menu-ink h-16 w-16" />
      <p className="menu-soft font-deed text-sm uppercase tracking-[0.35em]">A tabletop for the local network</p>
      <h1 className="menu-ink font-display text-6xl tracking-[0.12em] drop-shadow">MONOPOLY</h1>
      <p className="menu-soft max-w-xl font-deed text-lg">Play the classic board offline against the computer, or deal a table for friends on the same Wi-Fi. No accounts. No internet.</p>
      <div className="grid w-full gap-3">
        <MenuButton label="Solo Game" detail="Face one to five AI opponents" onClick={onSolo} />
        <MenuButton label="Multiplayer LAN" detail="Host or join a table on this network" onClick={onHost} secondary={onJoin} secondaryLabel="Join a table" />
        <MenuButton label="Settings" detail="Sound, rules, and your token" onClick={onSettings} />
        <button className="menu-soft text-sm underline" onClick={onSaves}>Saved games</button>
      </div>
    </div>
  );
}

function MenuButton({ label, detail, onClick, secondary, secondaryLabel }: { label: string; detail: string; onClick: () => void; secondary?: () => void; secondaryLabel?: string }) {
  return (
    <div className="wood-panel flex items-center justify-between rounded-2xl px-5 py-4 text-left">
      <button className="text-left" onClick={onClick}>
        <div className="menu-ink font-display text-2xl tracking-[0.08em]">{label}</div>
        <div className="menu-soft text-sm">{detail}</div>
      </button>
      {secondary && <button className="gold-button rounded-md px-4 py-2 text-xs" onClick={secondary}>{secondaryLabel}</button>}
    </div>
  );
}

export function SoloSetup({ onBack, onStart }: { onBack: () => void; onStart: (config: NewGameConfig) => void }) {
  const { settings, update } = useSettings();
  const [count, setCount] = useState(3);
  const [plates, setPlates] = useState<Record<string, CompanyPlate>>({});
  const [seats, setSeats] = useState(() => PERSONALITIES.slice(0, 3).map((personality, index) => ({ difficulty: 'normal' as Difficulty, personality, key: index })));
  const used = new Set<TokenId>([settings.token]);
  const aiTokens = TOKENS.filter((token) => !used.has(token.id));

  return (
    <Screen title="Solo game" onBack={onBack}>
      <NameAndToken />
      <ModePicker selected={settings.gameMode} onSelect={(gameMode) => void update({ gameMode })} />
      <p className="menu-soft text-sm">{describeRules(tableRules(settings))}</p>
      <label className="block text-sm">AI opponents: {count}
        <input className="w-full" type="range" min={1} max={5} value={count} onChange={(event) => setCount(Number(event.target.value))} />
      </label>
      {Array.from({ length: count }, (_, index) => {
        const seat = seats[index] ?? { difficulty: 'normal' as Difficulty, personality: PERSONALITIES[index % PERSONALITIES.length] };
        return (
          <div key={index} className="grid grid-cols-2 gap-2 text-sm">
            <span className="font-display">Opponent {index + 1}</span>
            <span />
            <select value={seat.difficulty} onChange={(event) => setSeats((current) => { const next = [...current]; next[index] = { ...seat, difficulty: event.target.value as Difficulty }; return next; })}>
              {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
            </select>
            <select value={seat.personality} onChange={(event) => setSeats((current) => { const next = [...current]; next[index] = { ...seat, personality: event.target.value as Personality }; return next; })}>
              {PERSONALITIES.map((personality) => <option key={personality} value={personality}>{personality}</option>)}
            </select>
          </div>
        );
      })}
      <TableEditor plates={plates} onChange={setPlates} />
      <button className="gold-button rounded-md px-4 py-3 text-sm" onClick={() => {
        void update({ playerName: settings.playerName });
        onStart({
          mode: 'solo',
          rules: tableRules(settings),
          extraCards: settings.extraCardText.trim() ? [{ text: settings.extraCardText, amount: settings.extraCardAmount }] : undefined,
          plates,
          players: [
            { name: settings.playerName || 'Player', token: settings.token, isAI: false },
            ...Array.from({ length: count }, (_, index) => ({
              name: ['Casey', 'Morgan', 'Riley', 'Quinn', 'Avery'][index],
              token: aiTokens[index].id,
              isAI: true,
              difficulty: seats[index]?.difficulty ?? 'normal',
              personality: seats[index]?.personality ?? 'cautious',
            })),
          ],
        });
      }}>Deal the cards</button>
    </Screen>
  );
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, update } = useSettings();
  return (
    <Screen title="Settings" onBack={onBack}>
      <NameAndToken />
      <div>
        <p className="font-display text-lg">Table theme</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {THEMES.map((theme) => (
            <button key={theme.id} className={`rounded-lg border p-2 text-left ${settings.theme === theme.id ? 'border-[#f0d48a]' : 'border-white/20'}`} onClick={() => void update({ theme: theme.id })}>
              <span className="mb-1 flex gap-1">{theme.swatch.map((color) => <i key={color} className="h-4 w-4 rounded-full border border-black/20" style={{ background: color }} />)}</span>
              <span className="block font-display text-sm">{theme.name}</span>
              <span className="menu-soft block text-xs">{theme.note}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm">{t(settings.language, 'language')}
        <select className="ml-2 rounded px-2" value={settings.language} onChange={(event) => void update({ language: event.target.value === 'ru' ? 'ru' : 'en' })}>
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </select>
      </label>
      <label className="block text-sm">{t(settings.language, 'dice')}
        <select className="ml-2 rounded px-2" value={settings.diceStyle} onChange={(event) => void update({ diceStyle: event.target.value as 'ivory' | 'ebony' | 'wood' })}>
          <option value="ivory">Ivory</option>
          <option value="ebony">Ebony</option>
          <option value="wood">Wood</option>
        </select>
      </label>
      <label className="block text-sm">{t(settings.language, 'lighting')}
        <select className="ml-2 rounded px-2" value={settings.lighting} onChange={(event) => void update({ lighting: event.target.value === 'night' ? 'night' : 'day' })}>
          <option value="day">{t(settings.language, 'day')}</option>
          <option value="night">{t(settings.language, 'night')}</option>
        </select>
      </label>
      <label className="flex items-center justify-between text-sm">{t(settings.language, 'commentary')} <input type="checkbox" checked={settings.commentary} onChange={(event) => void update({ commentary: event.target.checked })} /></label>
      <label className="block text-sm">{t(settings.language, 'houseCards')}
        <input className="mt-1 w-full rounded px-2 py-1" maxLength={80} value={settings.extraCardText} onChange={(event) => void update({ extraCardText: event.target.value })} />
      </label>
      <p className="menu-soft text-xs">Games {settings.played} · Wins {settings.won}</p>
      <label className="flex items-center justify-between text-sm">Sound <input type="checkbox" checked={settings.sound} onChange={(event) => void update({ sound: event.target.checked })} /></label>
      <label className="block text-sm">Volume
        <input className="w-full" type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(event) => void update({ volume: Number(event.target.value) })} />
      </label>
      <label className="flex items-center justify-between text-sm">Reduced motion <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => void update({ reducedMotion: event.target.checked })} /></label>
      <label className="block text-sm">Turn pace
        <select className="ml-2 rounded px-2 text-ink" value={settings.turnSpeed} onChange={(event) => void update({ turnSpeed: event.target.value as SettingsSpeed })}>
          <option value="slow">Slow</option>
          <option value="leisurely">Leisurely</option>
          <option value="relaxed">Relaxed</option>
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
        </select>
      </label>
      <p className="menu-soft text-xs">Slow and Leisurely keep each Chance card up until you press OK, and give the computer a longer pause between moves.</p>
      <p className="menu-soft text-xs">Starting cash, auctions, tax choice, and Free Parking below apply to the Classic mode. The other modes bring their own table rules.</p>
      <label className="block text-sm">Starting cash (Classic)
        <input className="ml-2 w-24 rounded px-2 text-ink" type="number" min={500} max={3000} step={50} value={settings.startingCash} onChange={(event) => void update({ startingCash: Number(event.target.value) })} />
      </label>
      <label className="block text-sm">LAN port
        <input className="ml-2 w-24 rounded px-2 text-ink" type="number" min={1024} max={65535} value={settings.port} onChange={(event) => void update({ port: Number(event.target.value) })} />
      </label>
      <label className="flex items-center justify-between text-sm">Auctions <input type="checkbox" checked={settings.auctions} onChange={(event) => void update({ auctions: event.target.checked })} /></label>
      <label className="flex items-center justify-between text-sm">Income tax choice <input type="checkbox" checked={settings.incomeTaxChoice} onChange={(event) => void update({ incomeTaxChoice: event.target.checked })} /></label>
      <label className="flex items-center justify-between text-sm">Free Parking pot <input type="checkbox" checked={settings.freeParkingPot} onChange={(event) => void update({ freeParkingPot: event.target.checked })} /></label>
      <label className="block text-sm">If a player disconnects
        <select className="ml-2 rounded px-2 text-ink" value={settings.disconnectMode} onChange={(event) => void update({ disconnectMode: event.target.value as 'wait' | 'autoplay' })}>
          <option value="autoplay">Auto-play after 15 seconds</option>
          <option value="wait">Wait for them</option>
        </select>
      </label>
      <p className="menu-soft text-xs">Shortcuts: Space rolls, Ctrl+S saves, Ctrl+Enter ends the turn, F11 is full screen.</p>
    </Screen>
  );
}

type SettingsSpeed = 'slow' | 'leisurely' | 'relaxed' | 'normal' | 'fast';

function NameAndToken() {
  const { settings, update } = useSettings();
  return (
    <div>
      <label className="block text-sm">Your name
        <input className="mt-1 w-full rounded px-2 py-1 text-ink" maxLength={16} value={settings.playerName} onChange={(event) => void update({ playerName: event.target.value })} />
      </label>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {TOKENS.map((token) => (
          <button key={token.id} className={`rounded-lg border p-2 ${settings.token === token.id ? 'border-[#f0d48a] bg-black/20' : 'border-transparent'}`} onClick={() => void update({ token: token.id })}>
            <span className="mx-auto block h-8 w-8"><TokenGlyph id={token.id} metal={token.metal} /></span>
            <span className="text-xs">{token.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SavesScreen({ onBack, onResumeSolo, onResumeLan }: { onBack: () => void; onResumeSolo: (state: GameState) => void; onResumeLan: (save: SaveRecord) => void }) {
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [error, setError] = useState('');
  const refresh = () => void store.listSaves().then(setSaves);
  useEffect(() => { refresh(); }, []);
  return (
    <Screen title="Saved games" onBack={onBack}>
      {error && <p>{error}</p>}
      {saves.length === 0 && <p>No saves yet. Solo games autosave at the start of each turn.</p>}
      {saves.map((save) => (
        <div key={save.id} className="flex items-center justify-between gap-3 border-b border-[#e7d3a4]/30 py-2 text-sm">
          <div>
            <div className="font-display">{save.name}</div>
            <div className="menu-soft text-xs">{save.mode === 'lan' ? 'LAN' : 'Solo'} · {new Date(save.updatedAt).toLocaleString()}</div>
          </div>
          <div className="flex gap-2">
            <button className="gold-button rounded px-2 py-1 text-xs" onClick={() => void store.loadGame(save.id).then((loaded) => {
              if (!loaded.ok) return setError(loaded.error);
              if (loaded.save.mode === 'lan') onResumeLan(loaded.save);
              else onResumeSolo(loaded.save.state);
            })}>Resume</button>
            <button className="text-xs underline" onClick={() => void store.deleteSave(save.id).then(refresh)}>Delete</button>
          </div>
        </div>
      ))}
    </Screen>
  );
}

export function HostScreen({ resume, onBack }: { resume?: SaveRecord; onBack: () => void }) {
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  const clientRef = useRef<LANClient | null>(null);
  const [info, setInfo] = useState<HostInfo | null>(null);
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [youId, setYouId] = useState('');
  const [error, setError] = useState('');
  const [plates, setPlates] = useState<Record<string, CompanyPlate>>({});

  useEffect(() => {
    const client = new LANClient();
    clientRef.current = client;
    let gone = false;
    const stopLobby = client.onLobby(setLobby);
    const stopGame = client.onGame((payload) => setGame(payload.state));
    void (async () => {
      if (!window.desktop) {
        setError('Hosting requires the Classic Monopoly desktop app so it can open a local server.');
        return;
      }
      try {
        const hosted = await window.desktop.hostLan({ hostName: settingsRef.current.playerName, port: settingsRef.current.port, rules: settingsRef.current });
        if (gone) return;
        setInfo(hosted);
        if (resume) {
          const restored = await window.desktop.restoreLan(resume);
          if (!restored.ok) throw new Error(restored.error ?? 'Could not restore that save');
        }
        await client.connect(`http://127.0.0.1:${hosted.port}`);
        const joined = await client.join({
          roomCode: hosted.roomCode,
          name: settingsRef.current.playerName,
          token: settingsRef.current.token,
          hostToken: hosted.hostToken,
        });
        if (!joined.ok || !joined.playerId) throw new Error(joined.error ?? 'Could not take the host seat');
        setYouId(joined.playerId);
      } catch (caught) {
        if (!gone) setError(caught instanceof Error ? caught.message : 'Could not host');
      }
    })();
    return () => {
      gone = true;
      stopLobby();
      stopGame();
      client.disconnect();
      void window.desktop?.stopLan();
    };
  }, [resume]);

  if (lobby?.status === 'playing' && clientRef.current) {
    return <LanTable client={clientRef.current} youId={youId} opening={game} canSave onExit={onBack} />;
  }

  return (
    <Screen title={resume ? 'Resume LAN table' : 'Host LAN game'} onBack={onBack}>
      {error && <p className="rounded bg-[#f8d7d2] px-3 py-2 text-sm text-ink">{error}</p>}
      {info && (
        <>
          <p>Ask your friends to connect to the same Wi-Fi and enter this IP address and join code.</p>
          <ul className="font-deed text-lg">
            {info.addresses.length === 0 && <li>No LAN address was found. Check that you are connected to Wi-Fi or Ethernet.</li>}
            {info.addresses.map((address) => <li key={address}>Host IP: {address}</li>)}
            <li>Port: {info.port}</li>
            <li>Room code: {info.roomCode}</li>
          </ul>
        </>
      )}
      <FirewallNote />
      {lobby && <LobbyPanel lobby={lobby} youId={youId} isHost />}
      {lobby && lobby.status === 'lobby' && (
        <div className="flex flex-wrap gap-2">
          <button className="rounded border px-3 py-2 text-xs" onClick={() => clientRef.current?.addAi('normal', 'trader')}>Add AI</button>
          <button className="gold-button rounded-md px-4 py-2 text-xs" onClick={() => void clientRef.current?.start(plates).then((result) => { if (!result.ok) setError(result.error ?? 'Cannot start'); })}>Start match</button>
        </div>
      )}
      {lobby?.status === 'lobby' && (
        <div className="grid gap-2 text-sm">
          <ModePicker selected={lobby.rules.modeId ?? 'classic'} onSelect={(modeId) => clientRef.current?.updateSettings(rulesPatch(rulesForMode(modeId)))} />
          <TableEditor plates={plates} onChange={setPlates} />
          <p className="menu-soft text-xs">{describeRules(lobby.rules)}</p>
          <label className="flex justify-between">Auctions <input type="checkbox" checked={lobby.rules.auctions} onChange={(event) => clientRef.current?.updateSettings({ auctions: event.target.checked })} /></label>
          <label className="flex justify-between">Free Parking pot <input type="checkbox" checked={lobby.rules.freeParkingPot} onChange={(event) => clientRef.current?.updateSettings({ freeParkingPot: event.target.checked })} /></label>
          <label className="flex justify-between">Disconnects
            <select className="rounded px-2 text-ink" value={lobby.rules.disconnectMode} onChange={(event) => clientRef.current?.updateSettings({ disconnectMode: event.target.value })}>
              <option value="autoplay">Auto-play after 15s</option>
              <option value="wait">Wait</option>
            </select>
          </label>
        </div>
      )}
    </Screen>
  );
}

export function JoinScreen({ onBack }: { onBack: () => void }) {
  const { settings } = useSettings();
  const clientRef = useRef<LANClient | null>(null);
  const [tables, setTables] = useState<FoundTable[]>([]);
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(settings.port);
  const [code, setCode] = useState('MONO');
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [youId, setYouId] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Looking for tables on this network…');
  const [spectator, setSpectator] = useState(false);

  useEffect(() => {
    const client = new LANClient();
    clientRef.current = client;
    const stopLobby = client.onLobby(setLobby);
    const stopGame = client.onGame((payload) => setGame(payload.state));
    const stopStatus = client.onStatus(setStatus);
    let stopFound: () => void = () => undefined;
    void window.desktop?.watchLan(true).then((result) => {
      if (!result.ok) setError(result.error ?? 'Automatic discovery is unavailable. Enter the host IP instead.');
    });
    stopFound = window.desktop?.onLanFound((table) => {
      setTables((current) => {
        const key = `${table.address}:${table.port}:${table.roomCode}`;
        const next = current.filter((entry) => `${entry.address}:${entry.port}:${entry.roomCode}` !== key);
        return [table, ...next].slice(0, 8);
      });
    }) ?? (() => undefined);
    return () => {
      stopLobby();
      stopGame();
      stopStatus();
      stopFound();
      client.disconnect();
      void window.desktop?.watchLan(false);
    };
  }, []);

  async function connect(address: string, hostPort: number, roomCode: string) {
    setError('');
    const client = clientRef.current;
    if (!client) return;
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)) {
      setError('Enter the host IPv4 address, for example 192.168.1.20');
      return;
    }
    try {
      await client.connect(`http://${address}:${hostPort}`);
      const joined = await client.join({ roomCode: roomCode.toUpperCase(), name: settings.playerName, token: settings.token, spectator });
      if (!joined.ok || !joined.playerId) throw new Error(joined.error ?? 'Join failed');
      setYouId(joined.playerId);
      localStorage.setItem('monopoly-session', JSON.stringify({ address, port: hostPort, roomCode, name: settings.playerName, token: settings.token, sessionToken: joined.sessionToken }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join');
    }
  }

  if (lobby?.status === 'playing' && clientRef.current) {
    return <LanTable client={clientRef.current} youId={youId} opening={game} canSave={false} onExit={onBack} />;
  }

  return (
    <Screen title="Join LAN game" onBack={onBack}>
      <p>{status}</p>
      {error && <p className="rounded bg-[#f8d7d2] px-3 py-2 text-sm text-ink">{error}</p>}
      <div className="space-y-2">
        {tables.map((table) => (
          <button key={`${table.address}:${table.roomCode}`} className="wood-panel block w-full rounded-lg px-3 py-2 text-left" onClick={() => { setIp(table.address); setPort(table.port); setCode(table.roomCode); void connect(table.address, table.port, table.roomCode); }}>
            <div className="font-display">{table.roomName}</div>
            <div className="text-xs">{table.address}:{table.port} · {table.roomCode} · {table.players}/{table.maxPlayers}</div>
          </button>
        ))}
        {tables.length === 0 && <p className="text-sm">No tables have announced themselves yet. You can still type the host IP.</p>}
      </div>
      <div className="grid gap-2 text-sm">
        <input className="rounded px-2 py-1 text-ink" placeholder="Host IP" value={ip} onChange={(event) => setIp(event.target.value)} />
        <input className="rounded px-2 py-1 text-ink" type="number" value={port} onChange={(event) => setPort(Number(event.target.value))} />
        <input className="rounded px-2 py-1 text-ink uppercase" placeholder="MONO482" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        <label className="flex items-center justify-between">{t(settings.language, 'spectator')} <input type="checkbox" checked={spectator} onChange={(event) => setSpectator(event.target.checked)} /></label>
        <button className="gold-button rounded-md px-3 py-2" onClick={() => void connect(ip, port, code)}>Connect</button>
      </div>
      {lobby && <LobbyPanel lobby={lobby} youId={youId} isHost={false} />}
      {lobby?.status === 'lobby' && <button className="gold-button rounded-md px-3 py-2 text-xs" onClick={() => clientRef.current?.ready(true)}>Ready</button>}
      <FirewallNote />
    </Screen>
  );
}

function LobbyPanel({ lobby, youId, isHost }: { lobby: LobbySnapshot; youId: string; isHost: boolean }) {
  return (
    <div>
      <h3 className="font-display text-lg">{lobby.roomName}</h3>
      <p className="text-sm">Host: {lobby.hostName} · {lobby.players.length}/6 seats</p>
      <ul className="mt-2 space-y-1 text-sm">
        {lobby.players.map((player) => (
          <li key={player.id} className="flex justify-between gap-2">
            <span>{player.name} · {player.token} {player.isAI ? '· AI' : ''} {player.id === youId ? '· you' : ''}</span>
            <span>{player.connected ? (player.ready ? 'Ready' : 'Not ready') : 'Away'}</span>
          </li>
        ))}
        {Array.from({ length: Math.max(0, 6 - lobby.players.length) }, (_, index) => <li key={index} className="text-[#f0ddb8]">Open seat</li>)}
        {lobby.spectators?.map((spectator) => <li key={spectator.id}>{spectator.name} · watching</li>)}
      </ul>
      {isHost && lobby.status === 'playing' && <p className="mt-2 text-sm">This computer keeps the official game. If you quit, the table closes. Host migration is not available.</p>}
    </div>
  );
}

function FirewallNote() {
  return (
    <aside className="menu-soft rounded-lg border border-white/20 p-3 text-xs leading-relaxed">
      If friends cannot connect, Windows Defender Firewall may be blocking the app. Allow Classic Monopoly on private networks when prompted, or open Windows Security → Firewall → Allow an app through firewall and enable it for Private. Everyone must be on the same Wi-Fi or Ethernet. The internet is not used.
    </aside>
  );
}

function ModePicker({ selected, onSelect }: { selected: GameModeId; onSelect: (mode: GameModeId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {GAME_MODES.map((mode) => (
        <button key={mode.id} className={`rounded-lg border p-2 text-left ${selected === mode.id ? 'border-[#f0d48a] bg-black/20' : 'border-white/15'}`} onClick={() => onSelect(mode.id)}>
          <span className="block font-display text-sm">{mode.name}</span>
          <span className="menu-soft block text-xs">{mode.blurb}</span>
        </button>
      ))}
    </div>
  );
}

function Screen({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="menu-ink mx-auto flex h-full max-w-2xl flex-col gap-4 overflow-auto px-6 py-8">
      <button className="self-start text-sm underline" onClick={onBack}>Back</button>
      <h2 className="font-display text-4xl tracking-[0.08em]">{title}</h2>
      {children}
    </div>
  );
}
