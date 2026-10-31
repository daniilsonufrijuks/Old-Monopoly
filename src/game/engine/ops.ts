import { netWorth } from '../rules/building';
import type { Ctx } from './context';
import type { GameState, PlayerState, Resume } from '../types';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function playerById(state: GameState, id: string): PlayerState {
  const player = state.players.find((entry) => entry.id === id);
  if (!player) throw new Error(`Unknown player ${id}`);
  return player;
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

export function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => !player.bankrupt);
}

export function log(state: GameState, ctx: Ctx, message: string): void {
  state.log.push({ id: uid('log'), turn: state.turn, message });
  if (state.log.length > 250) state.log.splice(0, state.log.length - 250);
  ctx.events.push({ type: 'log', message });
}

export function transfer(
  state: GameState,
  ctx: Ctx,
  fromId: string,
  toId: string | 'bank',
  amount: number,
  reason: string,
): void {
  if (amount <= 0) return;
  const from = playerById(state, fromId);
  from.cash -= amount;
  if (toId === 'bank') {
    if (state.rules.freeParkingPot && (reason === 'Income Tax' || reason === 'Luxury Tax')) {
      state.freeParking += amount;
    }
  } else {
    playerById(state, toId).cash += amount;
  }
  ctx.events.push({
    type: 'cash',
    playerId: fromId,
    delta: -amount,
    reason,
    counterparty: toId,
  });
  if (toId !== 'bank') {
    ctx.events.push({
      type: 'cash',
      playerId: toId,
      delta: amount,
      reason,
      counterparty: fromId,
    });
  }
  const target = toId === 'bank' ? 'the bank' : playerById(state, toId).name;
  log(state, ctx, `${from.name} pays $${amount} to ${target} (${reason}).`);
}

export function credit(state: GameState, ctx: Ctx, playerId: string, amount: number, reason: string): void {
  if (amount <= 0) return;
  const player = playerById(state, playerId);
  player.cash += amount;
  ctx.events.push({ type: 'cash', playerId, delta: amount, reason, counterparty: 'bank' });
  log(state, ctx, `${player.name} receives $${amount} (${reason}).`);
}

export function ended(state: GameState): boolean {
  return state.phase.kind === 'ended';
}

export function declareWinner(state: GameState, ctx: Ctx): boolean {
  const alive = alivePlayers(state);
  if (alive.length > 1) return false;
  const winner = alive[0];
  state.phase = { kind: 'ended', winnerId: winner?.id ?? '', reason: 'survival' };
  state.pendingRollAgain = false;
  if (winner) {
    log(state, ctx, `${winner.name} wins the game.`);
    ctx.events.push({ type: 'win', playerId: winner.id });
  }
  return true;
}

export function declareScoreWinner(state: GameState, ctx: Ctx): void {
  const ranked = [...alivePlayers(state)].sort((a, b) => {
    const worth = netWorth(state, b.id) - netWorth(state, a.id);
    if (worth !== 0) return worth;
    return b.cash - a.cash;
  });
  const winner = ranked[0];
  state.phase = { kind: 'ended', winnerId: winner?.id ?? '', reason: 'limit' };
  state.pendingRollAgain = false;
  if (winner) {
    log(state, ctx, `${winner.name} wins when the clock ends, worth $${netWorth(state, winner.id)}.`);
    ctx.events.push({ type: 'win', playerId: winner.id });
  }
}

export function nextAliveIndex(state: GameState, from: number): number {
  const count = state.players.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (from + step) % count;
    if (!state.players[index].bankrupt) return index;
  }
  return from;
}

export type ContinueFn = (state: GameState, ctx: Ctx, resume: Resume) => void;

export function shallowResume(resume: Resume): Resume {
  return structuredClone(resume);
}
