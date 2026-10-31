import { sanitizePlates } from '../game/board/plates';
import { checkInvariants } from '../game/engine/invariants';
import { normalizeRules } from '../game/modes';
import type { GameState } from '../game/types';

export interface SaveRecord {
  id: string;
  name: string;
  mode: 'solo' | 'lan';
  updatedAt: number;
  state: GameState;
  sessions?: Record<string, string>;
}

export function validateGameState(input: unknown): { ok: true; state: GameState } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Save data is missing' };
  const state = input as GameState;
  if (state.version !== 1 || !Array.isArray(state.players) || !state.properties || !state.decks || !state.phase) {
    return { ok: false, error: 'Save data is not a Classic Monopoly game' };
  }
  try {
    const copy = structuredClone(state);
    copy.rules = normalizeRules(copy.rules);
    if (!Array.isArray(copy.agreements)) copy.agreements = [];
    copy.plates = sanitizePlates(copy.plates);
    for (const player of copy.players) {
      if (!Number.isInteger(player.rentIn)) player.rentIn = 0;
      if (!Number.isInteger(player.rentOut)) player.rentOut = 0;
    }
    if (copy.phase.kind === 'auction' && !Number.isInteger(copy.phase.deadline)) copy.phase.deadline = 0;
    if (copy.phase.kind === 'trade' && !Number.isInteger(copy.phase.offer.rentShareTurns)) copy.phase.offer.rentShareTurns = 0;
    const problems = checkInvariants(copy);
    if (problems.length) return { ok: false, error: `Save failed validation (${problems[0]})` };
    return { ok: true, state: copy };
  } catch {
    return { ok: false, error: 'Save data could not be read' };
  }
}

export function validateSaveRecord(input: unknown): { ok: true; save: SaveRecord } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Save data is missing' };
  const record = input as SaveRecord;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return { ok: false, error: 'Save is missing a name' };
  const game = validateGameState(record.state);
  if (!game.ok) return game;
  return {
    ok: true,
    save: {
      id: record.id,
      name: record.name.slice(0, 40),
      mode: record.mode === 'lan' ? 'lan' : 'solo',
      updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : Date.now(),
      state: game.state,
      sessions: record.sessions && typeof record.sessions === 'object' ? record.sessions : undefined,
    },
  };
}
