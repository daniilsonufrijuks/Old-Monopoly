import { describe, expect, it } from 'vitest';
import { chooseAction } from '../src/game/ai/AIController';
import { GameEngine } from '../src/game/engine/GameEngine';
import { actingPlayerId } from '../src/game/engine/TurnManager';
import { checkInvariants } from '../src/game/engine/invariants';
import type { GameAction, GameState, TokenId } from '../src/game/types';

const tokens: TokenId[] = ['car', 'dog', 'hat', 'ship', 'shoe', 'thimble'];

function fallback(state: GameState, actorId: string): GameAction {
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

describe('full AI matches', () => {
  it('plays several games without illegal states', () => {
    let finished = 0;
    for (let seed = 1; seed <= 6; seed += 1) {
      const game = GameEngine.create({
        mode: 'solo',
        seed,
        players: [
          { name: 'Ada', token: tokens[0], isAI: true, difficulty: 'hard', personality: 'aggressive' },
          { name: 'Bea', token: tokens[1], isAI: true, difficulty: 'hard', personality: 'tycoon' },
          { name: 'Cal', token: tokens[2], isAI: true, difficulty: 'normal', personality: 'trader' },
        ],
      });
      let steps = 0;
      let stuck = 0;
      let last = '';
      while (game.getState().phase.kind !== 'ended' && game.getState().turn < 280 && steps < 4000) {
        const state = game.getState();
        const actor = actingPlayerId(state);
        if (!actor) break;
        const action = chooseAction(state, actor);
        let result = game.apply(actor, action);
        if (!result.ok) {
          result = game.apply(actor, fallback(state, actor));
          if (!result.ok) throw new Error(`seed ${seed} ${action.type}: ${result.error}`);
        }
        const problems = checkInvariants(game.getState());
        if (problems.length) throw new Error(`seed ${seed} ${problems.join(',')}`);
        const signature = `${game.getState().turn}:${game.getState().phase.kind}:${game.getState().currentPlayerIndex}:${action.type}`;
        stuck = signature === last ? stuck + 1 : 0;
        if (stuck > 12) throw new Error(`seed ${seed} stalled on ${signature}`);
        last = signature;
        steps += 1;
      }
      if (game.getState().phase.kind === 'ended') finished += 1;
    }
    expect(finished).toBeGreaterThan(0);
  });
});
