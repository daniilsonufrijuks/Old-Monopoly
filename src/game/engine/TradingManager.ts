import { spaceById } from '../board/spaces';
import type { GameState, TradeOffer } from '../types';
import type { Ctx } from './context';
import { log, playerById, uid } from './ops';

function mortgageInterest(state: GameState, propertyIds: string[]): number {
  let total = 0;
  for (const id of propertyIds) {
    const prop = state.properties[id];
    if (!prop?.mortgaged) continue;
    const space = spaceById(id);
    if (space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility') {
      total += Math.round(space.mortgage * 0.1);
    }
  }
  return total;
}

export function validateOffer(state: GameState, fromId: string, offer: Omit<TradeOffer, 'id' | 'fromId'>): string | null {
  const from = playerById(state, fromId);
  const to = state.players.find((player) => player.id === offer.toId);
  if (!to || to.bankrupt) return 'That player is not in the game';
  if (to.id === from.id) return 'You cannot trade with yourself';
  if (offer.offerCash < 0 || offer.requestCash < 0 || offer.offerCards < 0 || offer.requestCards < 0) return 'Invalid trade';
  if (!Number.isInteger(offer.offerCash) || !Number.isInteger(offer.requestCash)) return 'Cash amounts must be whole dollars';
  if (offer.offerCash > from.cash) return 'You do not have that much cash';
  if (offer.requestCash > to.cash) return 'They do not have that much cash';
  if (offer.offerCards > from.getOutCards.length) return 'You do not have that many Get Out of Jail Free cards';
  if (offer.requestCards > to.getOutCards.length) return 'They do not have that many Get Out of Jail Free cards';
  const nothing =
    offer.offerCash === 0 &&
    offer.requestCash === 0 &&
    offer.offerProperties.length === 0 &&
    offer.requestProperties.length === 0 &&
    offer.offerCards === 0 &&
    offer.requestCards === 0;
  if (nothing) return 'The trade is empty';
  for (const id of offer.offerProperties) {
    const prop = state.properties[id];
    if (!prop || prop.ownerId !== from.id) return 'You can only offer deeds you own';
    if (prop.houses > 0) return 'Sell the buildings before trading that color set';
  }
  for (const id of offer.requestProperties) {
    const prop = state.properties[id];
    if (!prop || prop.ownerId !== to.id) return 'You can only request deeds they own';
    if (prop.houses > 0) return 'They still have buildings on a requested set';
  }
  const unique = new Set([...offer.offerProperties, ...offer.requestProperties]);
  if (unique.size !== offer.offerProperties.length + offer.requestProperties.length) return 'Duplicate deeds in the trade';
  const fromInterest = mortgageInterest(state, offer.requestProperties);
  const toInterest = mortgageInterest(state, offer.offerProperties);
  if (from.cash - offer.offerCash + offer.requestCash < fromInterest) {
    return 'You cannot pay the 10% interest on the mortgaged deeds you would receive';
  }
  if (to.cash - offer.requestCash + offer.offerCash < toInterest) {
    return 'They cannot pay the 10% interest on the mortgaged deeds they would receive';
  }
  return null;
}

export function applyTrade(state: GameState, ctx: Ctx, offer: TradeOffer): void {
  const from = playerById(state, offer.fromId);
  const to = playerById(state, offer.toId);
  from.cash -= offer.offerCash;
  to.cash += offer.offerCash;
  to.cash -= offer.requestCash;
  from.cash += offer.requestCash;
  for (const id of offer.offerProperties) state.properties[id].ownerId = to.id;
  for (const id of offer.requestProperties) state.properties[id].ownerId = from.id;
  if (offer.offerCards > 0) {
    to.getOutCards.push(...from.getOutCards.splice(0, offer.offerCards));
  }
  if (offer.requestCards > 0) {
    from.getOutCards.push(...to.getOutCards.splice(0, offer.requestCards));
  }
  const fromInterest = mortgageInterest(state, offer.requestProperties);
  const toInterest = mortgageInterest(state, offer.offerProperties);
  from.cash -= fromInterest;
  to.cash -= toInterest;
  if (fromInterest > 0) log(state, ctx, `${from.name} pays $${fromInterest} mortgage interest to the bank.`);
  if (toInterest > 0) log(state, ctx, `${to.name} pays $${toInterest} mortgage interest to the bank.`);
  log(state, ctx, `${from.name} and ${to.name} complete a trade.`);
}

export function makeOfferId(): string {
  return uid('trade');
}
