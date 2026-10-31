import { GROUP_IDS, RAILROAD_IDS, UTILITY_IDS, spaceById } from '../board/spaces';
import type { GameState } from '../types';

export function streetRent(state: GameState, propertyId: string): number {
  const space = spaceById(propertyId);
  const prop = state.properties[propertyId];
  if (space.kind !== 'street' || !prop?.ownerId || prop.mortgaged) return 0;
  if (prop.houses > 0) return space.rent[prop.houses];
  const ids = GROUP_IDS[space.group];
  const monopoly = ids.every((id) => {
    const owned = state.properties[id];
    return owned.ownerId === prop.ownerId && !owned.mortgaged;
  });
  return space.rent[0] * (monopoly ? 2 : 1);
}

export function railroadRent(state: GameState, propertyId: string, multiplier = 1): number {
  const prop = state.properties[propertyId];
  if (!prop?.ownerId || prop.mortgaged) return 0;
  const count = RAILROAD_IDS.filter((id) => {
    const owned = state.properties[id];
    return owned.ownerId === prop.ownerId && !owned.mortgaged;
  }).length;
  const table = [0, 25, 50, 100, 200];
  return (table[count] ?? 0) * multiplier;
}

export function utilityMultiplier(state: GameState, ownerId: string, forceTen: boolean): number {
  if (forceTen) return 10;
  const count = UTILITY_IDS.filter((id) => {
    const owned = state.properties[id];
    return owned.ownerId === ownerId && !owned.mortgaged;
  }).length;
  return count >= 2 ? 10 : 4;
}

export function rentOwed(
  state: GameState,
  propertyId: string,
  diceTotal: number,
  options: { multiplier?: number; utilityTen?: boolean } = {},
): number {
  const space = spaceById(propertyId);
  const prop = state.properties[propertyId];
  if (!prop?.ownerId || prop.mortgaged) return 0;
  if (space.kind === 'street') return streetRent(state, propertyId) * (options.multiplier ?? 1);
  if (space.kind === 'railroad') return railroadRent(state, propertyId, options.multiplier ?? 1);
  if (space.kind === 'utility') {
    return diceTotal * utilityMultiplier(state, prop.ownerId, options.utilityTen ?? false);
  }
  return 0;
}
