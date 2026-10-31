import type { GameEvent } from '../types';

export interface Ctx {
  events: GameEvent[];
  rollDie: () => number;
  rng: () => number;
  depth: number;
  landing: { rentMultiplier: number; utilityTen: boolean };
}
