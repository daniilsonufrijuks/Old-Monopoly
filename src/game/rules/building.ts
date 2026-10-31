import { GROUP_IDS, spaceById, unmortgageCost } from '../board/spaces';
import type { GameState, PlayerState } from '../types';

export function playerById(state: GameState, id: string): PlayerState {
  const player = state.players.find((entry) => entry.id === id);
  if (!player) throw new Error('Player not found');
  return player;
}

export function ownedIds(state: GameState, playerId: string): string[] {
  return Object.values(state.properties)
    .filter((prop) => prop.ownerId === playerId)
    .map((prop) => prop.id);
}

export function canBuild(state: GameState, playerId: string, propertyId: string): string | null {
  const space = spaceById(propertyId);
  const prop = state.properties[propertyId];
  const player = playerById(state, playerId);
  if (space.kind !== 'street') return 'Houses can only be built on streets';
  if (!prop || prop.ownerId !== playerId) return 'You do not own this property';
  if (player.bankrupt) return 'You are bankrupt';
  if (prop.mortgaged) return 'This property is mortgaged';
  if (prop.houses >= 5) return 'This property already has a hotel';
  const group = GROUP_IDS[space.group];
  if (group.some((id) => state.properties[id].ownerId !== playerId)) return 'You need the full color set';
  if (group.some((id) => state.properties[id].mortgaged)) return 'Unmortgage every property in the set first';
  const counts = group.map((id) => state.properties[id].houses);
  if (prop.houses !== Math.min(...counts)) return 'Build evenly across the color set';
  if (prop.houses === 4) {
    if (state.bank.hotels < 1) return 'The bank has no hotels left';
  } else if (state.bank.houses < 1) return 'The bank has no houses left';
  const cost = housePrice(state, space.houseCost);
  if (player.cash < cost) return `You need $${cost}`;
  return null;
}

export function housePrice(state: GameState, listPrice: number): number {
  const factor = state.rules.houseCostFactor === 0.5 ? 0.5 : 1;
  return Math.round(listPrice * factor);
}

export function canSellBuilding(state: GameState, playerId: string, propertyId: string): string | null {
  const space = spaceById(propertyId);
  const prop = state.properties[propertyId];
  if (space.kind !== 'street') return 'This is not a street';
  if (!prop || prop.ownerId !== playerId || prop.houses <= 0) return 'There is nothing to sell';
  const group = GROUP_IDS[space.group];
  const counts = group.map((id) => state.properties[id].houses);
  if (prop.houses !== Math.max(...counts)) return 'Sell evenly across the color set';
  if (prop.houses === 5 && state.bank.houses < 4) return 'The bank does not have four houses to break this hotel';
  return null;
}

export function canMortgage(state: GameState, playerId: string, propertyId: string): string | null {
  const space = spaceById(propertyId);
  const prop = state.properties[propertyId];
  if (space.kind !== 'street' && space.kind !== 'railroad' && space.kind !== 'utility') return 'This cannot be mortgaged';
  if (!prop || prop.ownerId !== playerId) return 'You do not own this property';
  if (prop.mortgaged) return 'Already mortgaged';
  if (space.kind === 'street') {
    const group = GROUP_IDS[space.group];
    if (group.some((id) => state.properties[id].houses > 0)) return 'Sell all buildings on this color set first';
  }
  return null;
}

export function canUnmortgage(state: GameState, playerId: string, propertyId: string): string | null {
  const space = spaceById(propertyId);
  const prop = state.properties[propertyId];
  if (space.kind !== 'street' && space.kind !== 'railroad' && space.kind !== 'utility') return 'This cannot be unmortgaged';
  if (!prop || prop.ownerId !== playerId) return 'You do not own this property';
  if (!prop.mortgaged) return 'This property is not mortgaged';
  const cost = unmortgageCost(space.mortgage);
  if (playerById(state, playerId).cash < cost) return `You need $${cost} to unmortgage`;
  return null;
}

export function netWorth(state: GameState, playerId: string): number {
  const player = playerById(state, playerId);
  let worth = player.cash;
  for (const prop of Object.values(state.properties)) {
    if (prop.ownerId !== playerId) continue;
    const space = spaceById(prop.id);
    if (space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility') {
      worth += space.price;
      if (space.kind === 'street') {
        const buildings = prop.houses === 5 ? 5 : prop.houses;
        worth += buildings * space.houseCost;
      }
    }
  }
  return worth;
}

export function sellableProperty(state: GameState, playerId: string): string | null {
  for (const id of ownedIds(state, playerId)) {
    if (!canSellBuilding(state, playerId, id)) return id;
  }
  return null;
}

export function mortgageableProperty(state: GameState, playerId: string): string | null {
  const ids = ownedIds(state, playerId).sort((a, b) => {
    const sa = spaceById(a);
    const sb = spaceById(b);
    const pa = sa.kind === 'street' ? 1 : 0;
    const pb = sb.kind === 'street' ? 1 : 0;
    return pa - pb;
  });
  for (const id of ids) {
    if (!canMortgage(state, playerId, id)) return id;
  }
  return null;
}
