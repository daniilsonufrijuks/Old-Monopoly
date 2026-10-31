import { spaceById, unmortgageCost } from '../board/spaces';
import { canBuild, canMortgage, canSellBuilding, canUnmortgage, housePrice } from '../rules/building';
import type { GameState } from '../types';
import type { Ctx } from './context';
import { log, playerById } from './ops';

export function buildHouse(state: GameState, ctx: Ctx, playerId: string, propertyId: string): string | null {
  const error = canBuild(state, playerId, propertyId);
  if (error) return error;
  const space = spaceById(propertyId);
  if (space.kind !== 'street') return 'Houses can only be built on streets';
  const prop = state.properties[propertyId];
  const player = playerById(state, playerId);
  const cost = housePrice(state, space.houseCost);
  player.cash -= cost;
  if (prop.houses === 4) {
    prop.houses = 5;
    state.bank.hotels -= 1;
    state.bank.houses += 4;
    log(state, ctx, `${player.name} builds a hotel on ${space.name}.`);
  } else {
    prop.houses += 1;
    state.bank.houses -= 1;
    log(state, ctx, `${player.name} builds a house on ${space.name} (${prop.houses}).`);
  }
  ctx.events.push({ type: 'build', playerId, propertyId, houses: prop.houses });
  return null;
}

export function sellBuilding(state: GameState, ctx: Ctx, playerId: string, propertyId: string): string | null {
  const error = canSellBuilding(state, playerId, propertyId);
  if (error) return error;
  const space = spaceById(propertyId);
  if (space.kind !== 'street') return 'This is not a street';
  const prop = state.properties[propertyId];
  const player = playerById(state, playerId);
  const refund = Math.round(housePrice(state, space.houseCost) / 2);
  player.cash += refund;
  if (prop.houses === 5) {
    prop.houses = 4;
    state.bank.hotels += 1;
    state.bank.houses -= 4;
    log(state, ctx, `${player.name} sells the hotel on ${space.name} for $${refund}.`);
  } else {
    prop.houses -= 1;
    state.bank.houses += 1;
    log(state, ctx, `${player.name} sells a house on ${space.name} for $${refund}.`);
  }
  ctx.events.push({ type: 'build', playerId, propertyId, houses: prop.houses });
  return null;
}

export function mortgageProperty(state: GameState, ctx: Ctx, playerId: string, propertyId: string): string | null {
  const error = canMortgage(state, playerId, propertyId);
  if (error) return error;
  const space = spaceById(propertyId);
  if (space.kind !== 'street' && space.kind !== 'railroad' && space.kind !== 'utility') return 'Cannot mortgage this';
  const prop = state.properties[propertyId];
  const player = playerById(state, playerId);
  prop.mortgaged = true;
  player.cash += space.mortgage;
  ctx.events.push({ type: 'mortgage', playerId, propertyId, mortgaged: true });
  log(state, ctx, `${player.name} mortgages ${space.name} for $${space.mortgage}.`);
  return null;
}

export function unmortgageProperty(state: GameState, ctx: Ctx, playerId: string, propertyId: string): string | null {
  const error = canUnmortgage(state, playerId, propertyId);
  if (error) return error;
  const space = spaceById(propertyId);
  if (space.kind !== 'street' && space.kind !== 'railroad' && space.kind !== 'utility') return 'Cannot unmortgage this';
  const prop = state.properties[propertyId];
  const player = playerById(state, playerId);
  const cost = unmortgageCost(space.mortgage);
  player.cash -= cost;
  prop.mortgaged = false;
  ctx.events.push({ type: 'mortgage', playerId, propertyId, mortgaged: false });
  log(state, ctx, `${player.name} unmortgages ${space.name} for $${cost}.`);
  return null;
}

export function liquidateBuildings(state: GameState, ctx: Ctx, playerId: string): void {
  const player = playerById(state, playerId);
  for (const prop of Object.values(state.properties)) {
    if (prop.ownerId !== playerId || prop.houses <= 0) continue;
    const space = spaceById(prop.id);
    if (space.kind !== 'street') continue;
    const refund = (prop.houses === 5 ? 1 : prop.houses) * (space.houseCost / 2);
    if (prop.houses === 5) state.bank.hotels += 1;
    else state.bank.houses += prop.houses;
    prop.houses = 0;
    player.cash += refund;
    log(state, ctx, `${player.name} returns the buildings on ${space.name} to the bank for $${refund}.`);
  }
}
