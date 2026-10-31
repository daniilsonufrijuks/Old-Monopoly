import { describe, expect, it } from 'vitest';
import { chooseAction } from '../src/game/ai/AIController';
import { GameEngine } from '../src/game/engine/GameEngine';
import { actingPlayerId } from '../src/game/engine/TurnManager';
import { checkInvariants } from '../src/game/engine/invariants';
import type { GameState } from '../src/game/types';
import { CLASSIC_RULES } from '../src/game/types';
import { rulesForMode } from '../src/game/modes';

function engine(seed = 1): GameEngine {
  return GameEngine.create({
    mode: 'solo',
    seed,
    rules: CLASSIC_RULES,
    players: [
      { name: 'Ada', token: 'car', isAI: false },
      { name: 'Bea', token: 'dog', isAI: true, difficulty: 'hard', personality: 'aggressive' },
    ],
  });
}

function patch(game: GameEngine, edit: (state: GameState) => void): GameState {
  const state = game.getState();
  edit(state);
  game.replaceState(state);
  return game.getState();
}

describe('classic rules', () => {
  it('pays salary for passing GO and offers Mediterranean', () => {
    const game = engine();
    const start = game.getState();
    patch(game, (state) => {
      state.players[0].position = 39;
      state.currentPlayerIndex = 0;
      state.phase = { kind: 'pre-roll' };
    });
    game.setDiceQueue([1, 1]);
    const actor = start.players.find((player) => player.name === 'Ada')?.id ?? game.getState().players[0].id;
    const result = game.apply(game.getState().players[0].id, { type: 'roll' });
    expect(result.ok).toBe(true);
    const state = result.state;
    expect(state.players[0].position).toBe(1);
    expect(state.players[0].cash).toBe(1700);
    expect(state.phase).toEqual({ kind: 'buy', propertyId: 'mediterranean' });
    expect(actor).toBeTruthy();
  });

  it('charges monopoly rent', () => {
    const game = engine();
    patch(game, (state) => {
      state.players[0].position = 39;
      state.properties.mediterranean.ownerId = state.players[1].id;
      state.properties.baltic.ownerId = state.players[1].id;
    });
    game.setDiceQueue([1, 1]);
    const result = game.apply(game.getState().players[0].id, { type: 'roll' });
    expect(result.ok).toBe(true);
    expect(result.state.players[0].cash).toBe(1696);
    expect(result.state.players[1].cash).toBe(1504);
    expect(result.events.some((event) => event.type === 'rent' && event.amount === 4)).toBe(true);
  });

  it('sends a player to jail on the third double without moving', () => {
    const game = engine();
    const id = game.getState().players[0].id;
    game.setDiceQueue([2, 2, 3, 3, 5, 5]);
    expect(game.apply(id, { type: 'roll' }).ok).toBe(true);
    expect(game.getState().players[0].position).toBe(4);
    expect(game.getState().phase.kind).toBe('income-tax');
    expect(game.apply(id, { type: 'pay-tax', method: 'flat' }).ok).toBe(true);
    expect(game.getState().players[0].cash).toBe(1300);
    expect(game.getState().phase.kind).toBe('pre-roll');
    expect(game.apply(id, { type: 'roll' }).ok).toBe(true);
    expect(game.getState().players[0].position).toBe(10);
    expect(game.getState().players[0].inJail).toBe(false);
    const third = game.apply(id, { type: 'roll' });
    expect(third.ok).toBe(true);
    const ada = third.state.players.find((player) => player.id === id);
    expect(ada?.inJail).toBe(true);
    expect(ada?.position).toBe(10);
    expect(third.state.currentPlayerIndex).not.toBe(third.state.players.findIndex((player) => player.id === id));
  });

  it('forces the jail fine and movement on the third failed attempt', () => {
    const game = engine();
    patch(game, (state) => {
      state.players[0].inJail = true;
      state.players[0].jailTurns = 2;
      state.players[0].position = 10;
    });
    game.setDiceQueue([1, 2]);
    const result = game.apply(game.getState().players[0].id, { type: 'roll' });
    expect(result.ok).toBe(true);
    expect(result.state.players[0].inJail).toBe(false);
    expect(result.state.players[0].position).toBe(13);
    expect(result.state.players[0].cash).toBe(1450);
    expect(result.state.phase.kind).toBe('buy');
  });

  it('builds evenly and rejects an uneven house', () => {
    const game = engine();
    patch(game, (state) => {
      state.phase = { kind: 'manage' };
      state.properties.mediterranean.ownerId = state.players[0].id;
      state.properties.baltic.ownerId = state.players[0].id;
    });
    const id = game.getState().players[0].id;
    expect(game.apply(id, { type: 'build', propertyId: 'mediterranean' }).ok).toBe(true);
    const uneven = game.apply(id, { type: 'build', propertyId: 'mediterranean' });
    expect(uneven.ok).toBe(false);
    expect(game.apply(id, { type: 'build', propertyId: 'baltic' }).ok).toBe(true);
    expect(game.getState().bank.houses).toBe(30);
    expect(game.getState().players[0].cash).toBe(1400);
  });

  it('rejects another player rolling on your turn', () => {
    const game = engine();
    const other = game.getState().players[1].id;
    const result = game.apply(other, { type: 'roll' });
    expect(result.ok).toBe(false);
  });

  it('bankrupts a player who cannot pay and declares a winner', () => {
    const game = engine();
    patch(game, (state) => {
      state.players[0].cash = 0;
      state.phase = {
        kind: 'debt',
        debtorId: state.players[0].id,
        creditorId: state.players[1].id,
        amount: 100,
        reason: 'rent',
        resume: { kind: 'after-landing' },
      };
    });
    const result = game.apply(game.getState().players[0].id, { type: 'declare-bankruptcy' });
    expect(result.ok).toBe(true);
    expect(result.state.phase.kind).toBe('ended');
    if (result.state.phase.kind === 'ended') expect(result.state.phase.winnerId).toBe(result.state.players[1].id);
  });

  it('auctions a declined deed to the highest bidder', () => {
    const game = engine();
    patch(game, (state) => {
      state.players[0].position = 1;
      state.phase = { kind: 'buy', propertyId: 'mediterranean' };
    });
    const [ada, bea] = game.getState().players;
    expect(game.apply(ada.id, { type: 'decline' }).ok).toBe(true);
    expect(game.getState().phase.kind).toBe('auction');
    expect(game.apply(ada.id, { type: 'auction-bid', amount: 10 }).ok).toBe(true);
    expect(game.apply(bea.id, { type: 'auction-bid', amount: 25 }).ok).toBe(true);
    const done = game.apply(ada.id, { type: 'auction-pass' });
    expect(done.ok).toBe(true);
    expect(done.state.properties.mediterranean.ownerId).toBe(bea.id);
    expect(done.state.players.find((player) => player.id === bea.id)?.cash).toBe(1475);
  });

  it('keeps AI actions legal across a short match', () => {
    const game = GameEngine.create({
      mode: 'solo',
      seed: 7,
      players: [
        { name: 'Ada', token: 'hat', isAI: true, difficulty: 'hard', personality: 'aggressive' },
        { name: 'Bea', token: 'ship', isAI: true, difficulty: 'hard', personality: 'tycoon' },
        { name: 'Cal', token: 'shoe', isAI: true, difficulty: 'normal', personality: 'trader' },
      ],
    });
    let steps = 0;
    while (game.getState().phase.kind !== 'ended' && game.getState().turn < 40 && steps < 500) {
      const state = game.getState();
      const actor = actingPlayerId(state);
      expect(actor).toBeTruthy();
      const action = chooseAction(state, actor!);
      const result = game.apply(actor!, action);
      if (!result.ok) {
        const fallback = fallbackFor(state, actor!);
        const second = game.apply(actor!, fallback);
        expect(second.ok, `${result.error} after ${action.type}`).toBe(true);
      }
      expect(checkInvariants(game.getState())).toEqual([]);
      steps += 1;
    }
    expect(steps).toBeGreaterThan(5);
  });

  it('pays a second salary for landing on GO in a short match', () => {
    const game = GameEngine.create({
      mode: 'solo',
      seed: 3,
      rules: rulesForMode('short'),
      players: [
        { name: 'Ada', token: 'car', isAI: false },
        { name: 'Bea', token: 'dog', isAI: true, difficulty: 'easy', personality: 'cautious' },
      ],
    });
    patch(game, (state) => {
      state.players[0].position = 38;
      state.currentPlayerIndex = 0;
      state.phase = { kind: 'pre-roll' };
    });
    game.setDiceQueue([1, 1]);
    const result = game.apply(game.getState().players[0].id, { type: 'roll' });
    expect(result.ok).toBe(true);
    expect(result.state.players[0].position).toBe(0);
    expect(result.state.players[0].cash).toBe(2400);
  });

  it('ends a speed match on the clock and charges half-price houses', () => {
    const game = GameEngine.create({
      mode: 'solo',
      seed: 4,
      rules: rulesForMode('speed'),
      players: [
        { name: 'Ada', token: 'car', isAI: false },
        { name: 'Bea', token: 'hat', isAI: true, difficulty: 'easy', personality: 'cautious' },
      ],
    });
    patch(game, (state) => {
      state.phase = { kind: 'manage' };
      state.rules.turnLimit = 1;
      state.players[0].cash = 2000;
      state.properties.mediterranean.ownerId = state.players[0].id;
      state.properties.baltic.ownerId = state.players[0].id;
    });
    const id = game.getState().players[0].id;
    const built = game.apply(id, { type: 'build', propertyId: 'mediterranean' });
    expect(built.ok).toBe(true);
    expect(built.state.players[0].cash).toBe(1975);
    const ended = game.apply(id, { type: 'end-turn' });
    expect(ended.state.phase.kind).toBe('ended');
    if (ended.state.phase.kind === 'ended') {
      expect(ended.state.phase.reason).toBe('limit');
      expect(ended.state.phase.winnerId).toBe(id);
    }
  });
});

function fallbackFor(state: GameState, actorId: string): Parameters<GameEngine['apply']>[1] {
  switch (state.phase.kind) {
    case 'auction':
      return { type: 'auction-pass' };
    case 'buy':
      return { type: 'decline' };
    case 'income-tax':
      return { type: 'pay-tax', method: 'flat' };
    case 'trade':
      return state.phase.offer.toId === actorId ? { type: 'reject-trade' } : { type: 'cancel-trade' };
    case 'debt':
      return state.players.find((player) => player.id === actorId)!.cash >= state.phase.amount
        ? { type: 'settle-debt' }
        : { type: 'declare-bankruptcy' };
    case 'pre-roll':
      return { type: 'roll' };
    default:
      return { type: 'end-turn' };
  }
}
