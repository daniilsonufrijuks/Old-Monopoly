import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sound';
import { cardText, speak } from '../i18n';
import { chooseAction, fallbackAction, isAiTurn } from '../game/ai/AIController';
import { GameEngine } from '../game/engine/GameEngine';
import { actingPlayerId } from '../game/engine/TurnManager';
import type { CompanyPlate } from '../game/board/plates';
import type { GameAction, GameEvent, GameState, NewGameConfig } from '../game/types';
import { LANClient } from '../multiplayer/client/LANClient';
import { store } from '../platform/store';
import { useSettings } from '../settings/SettingsContext';
import { cardHoldMs, pauseMs, speedMs } from '../settings/defaults';
import { MatchView } from './MatchView';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SoloTable({ setup, resume, onExit }: { setup?: NewGameConfig; resume?: GameState; onExit: () => void }) {
  const { settings, update } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [engine] = useState(() => (resume ? new GameEngine(structuredClone(resume)) : GameEngine.create(setup!)));
  const [state, setState] = useState(() => engine.getState());
  const [positions, setPositions] = useState<Record<string, number>>(() => Object.fromEntries(engine.getState().players.map((player) => [player.id, player.position])));
  const [dice, setDice] = useState<[number, number] | null>(engine.getState().lastDice);
  const [rolling, setRolling] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const pumping = useRef(false);
  const dismissCard = useRef<(() => void) | null>(null);
  const recorded = useRef(false);
  const youId = state.players.find((player) => !player.isAI)?.id ?? '';

  function holdCard(text: string): Promise<void> {
    setCard(text);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        setCard(null);
        resolve();
      }, cardHoldMs(settingsRef.current.turnSpeed, settingsRef.current.reducedMotion));
      dismissCard.current = () => {
        clearTimeout(timer);
        setCard(null);
        resolve();
      };
    });
  }

  async function present(events: GameEvent[]) {
    const pace = speedMs(settingsRef.current.turnSpeed, settingsRef.current.reducedMotion);
    for (const event of events) {
      if (event.type === 'dice' && event.reason === 'turn') {
        setRolling(true);
        sfx.dice();
        await wait(settingsRef.current.reducedMotion ? 40 : 380);
        setDice(event.dice);
        setRolling(false);
      } else if (event.type === 'move') {
        if (event.direct || settingsRef.current.reducedMotion) setPositions((current) => ({ ...current, [event.playerId]: event.to }));
        else for (const space of event.path) {
          setPositions((current) => ({ ...current, [event.playerId]: space }));
          await wait(pace);
        }
      } else if (event.type === 'cash' && event.delta > 0) sfx.cash();
      else if (event.type === 'jail') sfx.jail();
      else if (event.type === 'card') {
        const text = cardText(settingsRef.current.language, event.cardId, event.text);
        if (settingsRef.current.commentary) speak(text, settingsRef.current.language);
        await holdCard(text);
      }       else if (event.type === 'build') sfx.build();
      else if (event.type === 'win') sfx.win();
    }
    await wait(pauseMs(settingsRef.current.turnSpeed, settingsRef.current.reducedMotion));
  }

  async function pump() {
    if (pumping.current) return;
    pumping.current = true;
    setBusy(true);
    try {
      let guard = 0;
      while (isAiTurn(engine.getState()) && guard < 50) {
        const current = engine.getState();
        const actor = actingPlayerId(current);
        if (!actor) break;
        let result = engine.apply(actor, chooseAction(current, actor));
        if (!result.ok) result = engine.apply(actor, fallbackAction(current, actor));
        if (!result.ok) {
          setError(result.error ?? 'An AI player could not take a legal action');
          break;
        }
        await present(result.events);
        setState(engine.getState());
        guard += 1;
      }
    } finally {
      pumping.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    void window.desktop?.setGameActive(true);
    void pump();
    return () => {
      void window.desktop?.setGameActive(false);
    };
    // The opening AI turns should play once when the table is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.phase.kind === 'pre-roll' || state.phase.kind === 'ended') {
      void store.saveGame({ id: 'solo-autosave', name: 'Solo autosave', mode: 'solo', updatedAt: Date.now(), state: engine.getState() });
    }
  }, [engine, state.phase.kind, state.turn]);

  useEffect(() => {
    if (state.phase.kind !== 'ended' || recorded.current) return;
    recorded.current = true;
    const won = state.phase.winnerId === youId;
    void update({ played: settingsRef.current.played + 1, won: settingsRef.current.won + (won ? 1 : 0) });
  }, [state.phase, update, youId]);

  async function onAction(action: GameAction) {
    if (busy || !youId) return;
    setError('');
    const result = engine.apply(youId, action);
    if (!result.ok) {
      setError(result.error ?? 'That move is not legal');
      return;
    }
    setBusy(true);
    await present(result.events);
    setState(result.state);
    setBusy(false);
    setNote('Saved locally');
    void pump();
  }

  return (
    <MatchView
      state={state}
      youId={youId}
      positions={positions}
      dice={dice}
      rolling={rolling}
      card={card}
      busy={busy}
      error={error}
      note={note || 'Offline solo'}
      canSave
      onAction={(action) => void onAction(action)}
      onDismissCard={() => dismissCard.current?.()}
      canEdit
      onPlates={(plates: Record<string, CompanyPlate>) => {
        engine.setPlates(plates);
        setState(engine.getState());
      }}
      onSave={() => {
        void store.saveGame({
          id: `solo-${Date.now()}`,
          name: `Solo turn ${state.turn}`,
          mode: 'solo',
          updatedAt: Date.now(),
          state: engine.getState(),
        }).then((result) => setNote(result.ok ? 'Game saved' : result.error ?? 'Save failed'));
      }}
      onLeave={onExit}
    />
  );
}

export function LanTable({ client, youId, opening, canSave, onExit }: { client: LANClient; youId: string; opening: GameState | null; canSave: boolean; onExit: () => void }) {
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [state, setState] = useState<GameState | null>(opening);
  const [positions, setPositions] = useState<Record<string, number>>(() => Object.fromEntries((opening?.players ?? []).map((player) => [player.id, player.position])));
  const [dice, setDice] = useState<[number, number] | null>(opening?.lastDice ?? null);
  const [rolling, setRolling] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('Connected');
  const [messages, setMessages] = useState<Array<{ name: string; text: string }>>([]);
  const dismissCard = useRef<(() => void) | null>(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    void window.desktop?.setGameActive(true);
    return () => {
      void window.desktop?.setGameActive(false);
    };
  }, []);

  async function present(events: GameEvent[]) {
    const pace = speedMs(settingsRef.current.turnSpeed, settingsRef.current.reducedMotion);
    for (const event of events) {
      if (event.type === 'dice' && event.reason === 'turn') {
        setRolling(true);
        sfx.dice();
        await wait(settingsRef.current.reducedMotion ? 40 : 380);
        setDice(event.dice);
        setRolling(false);
      } else if (event.type === 'move') {
        if (event.direct || settingsRef.current.reducedMotion) setPositions((current) => ({ ...current, [event.playerId]: event.to }));
        else for (const space of event.path) {
          setPositions((current) => ({ ...current, [event.playerId]: space }));
          await wait(pace);
        }
      } else if (event.type === 'cash' && event.delta > 0) sfx.cash();
      else if (event.type === 'jail') sfx.jail();
      else if (event.type === 'card') {
        const text = cardText(settingsRef.current.language, event.cardId, event.text);
        if (settingsRef.current.commentary) speak(text, settingsRef.current.language);
        await new Promise<void>((resolve) => {
          setCard(text);
          const timer = setTimeout(() => {
            setCard(null);
            resolve();
          }, cardHoldMs(settingsRef.current.turnSpeed, settingsRef.current.reducedMotion));
          dismissCard.current = () => {
            clearTimeout(timer);
            setCard(null);
            resolve();
          };
        });
      } else if (event.type === 'build') sfx.build();
      else if (event.type === 'win') sfx.win();
    }
    await wait(pauseMs(settingsRef.current.turnSpeed, settingsRef.current.reducedMotion));
  }

  useEffect(() => {
    const stopGame = client.onGame((payload) => {
      queue.current = queue.current.then(async () => {
        if (!payload.events.length) {
          setPositions(Object.fromEntries(payload.state.players.map((player) => [player.id, player.position])));
          setDice(payload.state.lastDice);
        } else {
          setBusy(true);
          await present(payload.events);
          setBusy(false);
        }
        setState(payload.state);
      });
    });
    const stopStatus = client.onStatus(setNote);
    const stopChat = client.onChat((message) => setMessages((current) => [...current, message].slice(-40)));
    const stopClosed = client.onClosed((payload) => setError(payload.reason));
    return () => {
      stopGame();
      stopStatus();
      stopChat();
      stopClosed();
    };
  }, [client]);

  if (!state) return <div className="grid h-full place-items-center text-cream">Waiting for the host to deal the table…</div>;

  return (
    <MatchView
      state={state}
      youId={youId}
      positions={positions}
      dice={dice}
      rolling={rolling}
      card={card}
      busy={busy}
      error={error}
      note={note}
      canSave={canSave}
      onAction={(action) => {
        setError('');
        void client.act(`act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action).then((result) => {
          if (!result.ok && !result.duplicate) setError(result.error ?? 'The host rejected that action');
        });
      }}
      onDismissCard={() => dismissCard.current?.()}
      canEdit={Boolean(state.players.find((player) => player.id === youId)?.isHost)}
      onPlates={(plates) => client.setPlates(plates)}
      messages={messages}
      onChat={(text) => client.chat(text)}
      onSave={() => {
        void store.saveGame({ id: `lan-${Date.now()}`, name: `LAN turn ${state.turn}`, mode: 'lan', updatedAt: Date.now(), state }).then((result) => {
          setNote(result.ok ? 'Snapshot saved on this computer' : result.error ?? 'Save failed');
        });
      }}
      onLeave={onExit}
    />
  );
}
