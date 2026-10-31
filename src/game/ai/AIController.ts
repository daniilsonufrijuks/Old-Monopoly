import { GROUP_IDS, spaceById } from '../board/spaces';
import type { Difficulty, GameAction, GameState, Personality, PlayerState } from '../types';
import { actingPlayerId } from '../engine/TurnManager';
import { canBuild, canMortgage, mortgageableProperty, netWorth, ownedIds, sellableProperty } from '../rules/building';

function reserve(state: GameState, player: PlayerState): number {
  const base = player.difficulty === 'easy' ? 450 : player.difficulty === 'normal' ? 220 : 120;
  let value = base;
  if (player.personality === 'cautious') value += 180;
  if (player.personality === 'aggressive') value = Math.floor(value * 0.45);
  if (player.personality === 'tycoon') value = Math.floor(value * 0.75);
  if (player.difficulty === 'hard') {
    const monopolies = Object.values(GROUP_IDS).filter((group) => {
      const owner = state.properties[group[0]].ownerId;
      return owner && owner !== player.id && group.every((id) => state.properties[id].ownerId === owner);
    }).length;
    value += monopolies * 70;
  }
  return value;
}

function completesSet(state: GameState, playerId: string, propertyId: string): boolean {
  const space = spaceById(propertyId);
  if (space.kind !== 'street') return false;
  const group = GROUP_IDS[space.group];
  const owned = group.filter((id) => state.properties[id].ownerId === playerId).length;
  return owned === group.length - 1 && state.properties[propertyId].ownerId !== playerId;
}

function blocksSet(state: GameState, playerId: string, propertyId: string): boolean {
  const space = spaceById(propertyId);
  if (space.kind !== 'street') return false;
  const group = GROUP_IDS[space.group];
  const owners = new Set(group.filter((id) => id !== propertyId).map((id) => state.properties[id].ownerId).filter(Boolean));
  return owners.size === 1 && !owners.has(playerId) && group.filter((id) => state.properties[id].ownerId && state.properties[id].ownerId !== playerId).length === group.length - 1;
}

function desiredPrice(state: GameState, player: PlayerState, propertyId: string): number {
  const space = spaceById(propertyId);
  if (space.kind !== 'street' && space.kind !== 'railroad' && space.kind !== 'utility') return 0;
  let value = space.price;
  if (completesSet(state, player.id, propertyId)) value += space.price * (player.difficulty === 'hard' ? 2 : 1.2);
  if (blocksSet(state, player.id, propertyId) && (player.difficulty === 'hard' || player.personality === 'opportunist')) {
    value += space.price * 0.8;
  }
  if (space.kind === 'railroad' || space.kind === 'utility') value += player.difficulty === 'easy' ? 0 : 40;
  if (player.difficulty === 'easy') value *= 0.72;
  if (player.difficulty === 'hard') value *= 1.12;
  if (player.personality === 'cautious') value *= 0.82;
  if (player.personality === 'aggressive') value *= 1.28;
  if (player.personality === 'tycoon' && space.kind === 'street') value *= 1.15;
  return Math.floor(value);
}

function wantsToBuy(state: GameState, player: PlayerState, propertyId: string): boolean {
  const space = spaceById(propertyId);
  if (space.kind !== 'street' && space.kind !== 'railroad' && space.kind !== 'utility') return false;
  if (player.cash < space.price) return false;
  const keep = reserve(state, player);
  if (completesSet(state, player.id, propertyId)) return player.cash >= space.price;
  if (player.personality === 'aggressive') return player.cash - space.price >= 40;
  if (player.difficulty === 'easy') return space.price <= 160 && player.cash - space.price >= keep;
  const goodDeal = desiredPrice(state, player, propertyId) >= space.price;
  return player.cash - space.price >= (goodDeal ? Math.floor(keep * 0.45) : keep);
}

function sacrifice(state: GameState, player: PlayerState): string | null {
  const ids = ownedIds(state, player.id).filter((id) => !canMortgage(state, player.id, id));
  ids.sort((a, b) => {
    const score = (id: string) => {
      const space = spaceById(id);
      const partial = space.kind === 'street' ? GROUP_IDS[space.group].filter((gid) => state.properties[gid].ownerId === player.id).length : 0;
      return partial * 1000 + (space.kind === 'street' ? space.price : 0);
    };
    return score(a) - score(b);
  });
  return ids[0] ?? null;
}

function bestBuild(state: GameState, player: PlayerState): string | null {
  const floor = player.difficulty === 'easy' ? 700 : player.personality === 'tycoon' ? Math.floor(reserve(state, player) * 0.45) : reserve(state, player);
  if (player.difficulty === 'easy' && player.cash < 800) return null;
  let best: string | null = null;
  let bestGain = 0;
  for (const id of ownedIds(state, player.id)) {
    if (canBuild(state, player.id, id)) continue;
    const space = spaceById(id);
    if (space.kind !== 'street') continue;
    if (player.cash - space.houseCost < floor) continue;
    const prop = state.properties[id];
    const gain = space.rent[Math.min(5, prop.houses + 1)] - space.rent[prop.houses];
    if (gain > bestGain) {
      bestGain = gain;
      best = id;
    }
  }
  return best;
}

function maybeTrade(state: GameState, player: PlayerState): GameAction | null {
  if (state.tradesThisTurn > 0) return null;
  if (player.personality !== 'trader' && player.personality !== 'opportunist' && player.difficulty !== 'hard') return null;
  for (const group of Object.values(GROUP_IDS)) {
    const owned = group.filter((id) => state.properties[id].ownerId === player.id);
    if (owned.length !== group.length - 1) continue;
    const missing = group.find((id) => state.properties[id].ownerId !== player.id);
    if (!missing) continue;
    const ownerId = state.properties[missing].ownerId;
    if (!ownerId) continue;
    const owner = state.players.find((entry) => entry.id === ownerId);
    if (!owner || owner.bankrupt) continue;
    if (state.properties[missing].houses > 0) continue;
    const space = spaceById(missing);
    if (space.kind !== 'street') continue;
    const offerCash = Math.min(player.cash - Math.min(80, reserve(state, player)), Math.floor(space.price * 1.35));
    if (offerCash < space.price || offerCash <= 0) continue;
    return {
      type: 'propose-trade',
      toId: ownerId,
      offerCash,
      requestCash: 0,
      offerProperties: [],
      requestProperties: [missing],
      offerCards: 0,
      requestCards: 0,
    };
  }
  return null;
}

function respondTrade(state: GameState, player: PlayerState): GameAction {
  if (state.phase.kind !== 'trade') return { type: 'reject-trade' };
  const offer = state.phase.offer;
  if (offer.toId !== player.id) return { type: 'reject-trade' };
  const cashDelta = offer.offerCash - offer.requestCash;
  let score = cashDelta;
  for (const id of offer.offerProperties) score += desiredPrice(state, player, id);
  for (const id of offer.requestProperties) {
    const space = spaceById(id);
    score -= desiredPrice(state, player, id) * (player.personality === 'trader' ? 0.9 : 1.15);
    if (space.kind === 'street' && GROUP_IDS[space.group].every((gid) => state.properties[gid].ownerId === player.id)) {
      score -= space.price * 4;
    }
  }
  score += offer.offerCards * 40;
  score -= offer.requestCards * 40;
  if (offer.requestProperties.some((id) => completesSet(state, player.id, id) || ownedIds(state, player.id).includes(id) && completesSet(state, offer.fromId, id))) {
    score -= 400;
  }
  const accept = player.difficulty === 'easy' ? score >= 80 : score >= (player.personality === 'trader' ? 10 : 25);
  return accept ? { type: 'accept-trade' } : { type: 'reject-trade' };
}

function bidAmount(state: GameState, player: PlayerState): number | null {
  if (state.phase.kind !== 'auction') return null;
  const value = desiredPrice(state, player, state.phase.propertyId);
  const keep = player.personality === 'aggressive' ? 30 : Math.min(reserve(state, player), 180);
  const max = Math.min(player.cash - keep, Math.floor(value * (player.difficulty === 'hard' ? 1.05 : 0.95)));
  if (max <= state.phase.highBid) return null;
  const gap = max - state.phase.highBid;
  const step = player.difficulty === 'easy' ? 5 : player.difficulty === 'normal' ? Math.max(5, Math.ceil(gap / 4)) : Math.max(10, Math.ceil(gap / 2));
  return Math.min(max, state.phase.highBid + step);
}

export function chooseAction(state: GameState, playerId: string): GameAction {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return { type: 'end-turn' };
  const phase = state.phase;

  if (phase.kind === 'auction') {
    if (phase.activePlayerId !== playerId) return { type: 'auction-pass' };
    const amount = bidAmount(state, player);
    return amount ? { type: 'auction-bid', amount } : { type: 'auction-pass' };
  }

  if (phase.kind === 'debt') {
    if (phase.debtorId !== playerId) return { type: 'end-turn' };
    const sell = sellableProperty(state, playerId);
    if (sell) return { type: 'sell-building', propertyId: sell };
    const mortgage = mortgageableProperty(state, playerId);
    if (mortgage) return { type: 'mortgage', propertyId: mortgage };
    if (player.cash >= phase.amount) return { type: 'settle-debt' };
    return { type: 'declare-bankruptcy' };
  }

  if (phase.kind === 'trade') return respondTrade(state, player);

  if (phase.kind === 'income-tax') {
    const percent = Math.floor(netWorth(state, playerId) * 0.1);
    return { type: 'pay-tax', method: percent < state.rules.incomeTax ? 'percent' : 'flat' };
  }

  if (phase.kind === 'buy') {
    if (wantsToBuy(state, player, phase.propertyId)) return { type: 'buy' };
    const space = spaceById(phase.propertyId);
    const attractive = completesSet(state, player.id, phase.propertyId) || player.difficulty === 'hard';
    if (attractive && (space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility') && player.cash < space.price) {
      const deed = sacrifice(state, player);
      if (deed && player.difficulty !== 'easy') return { type: 'mortgage', propertyId: deed };
    }
    return { type: 'decline' };
  }

  if (phase.kind === 'pre-roll') {
    if (player.inJail) {
      if (player.getOutCards.length > 0 && (player.difficulty !== 'easy' || player.jailTurns > 0)) return { type: 'use-jail-card' };
      if (player.cash >= 50 && player.jailTurns >= 1 && player.difficulty === 'hard' && player.cash > reserve(state, player)) {
        return { type: 'pay-jail' };
      }
      if (player.cash >= 50 && player.jailTurns >= state.rules.maxJailTurns - 1 && player.difficulty !== 'easy') return { type: 'pay-jail' };
    }
    const build = bestBuild(state, player);
    if (build && player.difficulty !== 'easy') return { type: 'build', propertyId: build };
    const trade = !player.inJail ? maybeTrade(state, player) : null;
    if (trade) return trade;
    return { type: 'roll' };
  }

  if (phase.kind === 'manage') {
    const build = bestBuild(state, player);
    if (build) return { type: 'build', propertyId: build };
    const trade = maybeTrade(state, player);
    if (trade) return trade;
    return { type: 'end-turn' };
  }

  return { type: 'end-turn' };
}

export function fallbackAction(state: GameState, actorId: string): GameAction {
  switch (state.phase.kind) {
    case 'auction':
      return { type: 'auction-pass' };
    case 'buy':
      return { type: 'decline' };
    case 'income-tax':
      return { type: 'pay-tax', method: 'flat' };
    case 'trade':
      return state.phase.offer.toId === actorId ? { type: 'reject-trade' } : { type: 'cancel-trade' };
    case 'debt': {
      const player = state.players.find((entry) => entry.id === actorId);
      return player && player.cash >= state.phase.amount ? { type: 'settle-debt' } : { type: 'declare-bankruptcy' };
    }
    case 'pre-roll':
      return { type: 'roll' };
    default:
      return { type: 'end-turn' };
  }
}

export function isAiTurn(state: GameState): boolean {
  const actor = actingPlayerId(state);
  if (!actor || state.phase.kind === 'ended') return false;
  return Boolean(state.players.find((player) => player.id === actor)?.isAI);
}

export function describeDifficulty(difficulty: Difficulty): string {
  if (difficulty === 'easy') return 'Buys cautiously and rarely develops.';
  if (difficulty === 'hard') return 'Builds monopolies, bids to win, and keeps a cash reserve.';
  return 'Buys with a plan and develops complete color sets.';
}

export function describePersonality(personality: Personality): string {
  switch (personality) {
    case 'cautious':
      return 'Holds cash and avoids risky auctions.';
    case 'aggressive':
      return 'Buys almost anything and bids high.';
    case 'trader':
      return 'Offers deals to finish color sets.';
    case 'tycoon':
      return 'Pushes houses and hotels early.';
    case 'opportunist':
      return 'Blocks opponents who are one deed from a set.';
  }
}
