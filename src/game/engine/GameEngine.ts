import type { ActionResult, GameAction, GameState, NewGameConfig } from '../types';
import type { Ctx } from './context';
import { sanitizePlates, type CompanyPlate } from '../board/plates';
import { createInitialState, mulberry32 } from './createGame';
import { checkInvariants } from './invariants';
import { dispatch } from './TurnManager';

export class GameEngine {
  private state: GameState;
  private rng: () => number;
  private diceQueue: number[] = [];

  constructor(state: GameState, seed = Date.now() >>> 0) {
    this.state = structuredClone(state);
    this.rng = mulberry32(seed);
  }

  static create(config: NewGameConfig): GameEngine {
    const seed = config.seed ?? Math.floor(Math.random() * 1_000_000_000);
    return new GameEngine(createInitialState(config, seed), seed);
  }

  getState(): GameState {
    return structuredClone(this.state);
  }

  setPlates(plates: Record<string, CompanyPlate> | unknown): void {
    const next = structuredClone(this.state);
    next.plates = sanitizePlates(plates);
    this.state = next;
  }

  replaceState(state: GameState): void {
    const problems = checkInvariants(state);
    if (problems.length) throw new Error(problems.join('; '));
    this.state = structuredClone(state);
  }

  setDiceQueue(values: number[]): void {
    this.diceQueue = [...values];
  }

  apply(actorId: string, action: GameAction): ActionResult {
    const next = structuredClone(this.state);
    const ctx: Ctx = {
      events: [],
      rollDie: () => this.rollDie(),
      rng: this.rng,
      depth: 0,
      landing: { rentMultiplier: 1, utilityTen: false },
    };
    try {
      const error = dispatch(next, ctx, actorId, action);
      if (error) return { ok: false, error, events: [], state: this.getState() };
      const problems = checkInvariants(next);
      if (problems.length) {
        return {
          ok: false,
          error: `That action was rejected because it would break the rules (${problems[0]}).`,
          events: [],
          state: this.getState(),
        };
      }
      this.state = next;
      return { ok: true, events: ctx.events, state: this.getState() };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed';
      return { ok: false, error: message, events: [], state: this.getState() };
    }
  }

  private rollDie(): number {
    const queued = this.diceQueue.shift();
    if (queued !== undefined) {
      if (queued < 1 || queued > 6) throw new Error('Invalid debug die');
      return queued;
    }
    return 1 + Math.floor(this.rng() * 6);
  }
}

export { createInitialState };
