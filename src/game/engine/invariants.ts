import { GROUP_IDS, ownableSpaces, spaceById } from '../board/spaces';
import { CARD_MAP, deckIds } from '../cards/decks';
import type { GameState } from '../types';

export function checkInvariants(state: GameState): string[] {
  const errors: string[] = [];
  if (state.version !== 1) errors.push('unsupported version');
  if (state.players.length < 2 || state.players.length > 6) errors.push('player count');
  if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= state.players.length) errors.push('turn index');
  const ids = new Set<string>();
  for (const player of state.players) {
    if (ids.has(player.id)) errors.push('duplicate player');
    ids.add(player.id);
    if (player.position < 0 || player.position > 39) errors.push('position');
    if (!Number.isInteger(player.cash) || player.cash < 0) errors.push(`negative cash for ${player.name}`);
    if (player.jailTurns < 0 || player.jailTurns > 4) errors.push('jail turns');
  }
  let houses = state.bank.houses;
  let hotels = state.bank.hotels;
  if (houses < 0 || hotels < 0) errors.push('bank supply');
  const ownable = new Set(ownableSpaces().map((space) => space.id));
  if (Object.keys(state.properties).length !== ownable.size) errors.push('property count');
  for (const [id, prop] of Object.entries(state.properties)) {
    if (!ownable.has(id) || prop.id !== id) errors.push('property id');
    if (prop.houses < 0 || prop.houses > 5) errors.push('houses');
    if (prop.mortgaged && prop.houses > 0) errors.push('mortgaged buildings');
    if (prop.ownerId && !ids.has(prop.ownerId)) errors.push('owner');
    if (prop.houses === 5) hotels += 1;
    else houses += prop.houses;
    const space = spaceById(id);
    if ((space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility') && prop.ownerId) {
      const owner = state.players.find((player) => player.id === prop.ownerId);
      if (owner?.bankrupt && state.phase.kind !== 'auction') {
        // Bankrupt players transfer deeds before the game continues.
        errors.push('bankrupt owner');
      }
    }
  }
  if (houses !== 32) errors.push(`house supply ${houses}`);
  if (hotels !== 12) errors.push(`hotel supply ${hotels}`);
  for (const group of Object.values(GROUP_IDS)) {
    const counts = group.map((id) => state.properties[id].houses);
    if (Math.max(...counts) - Math.min(...counts) > 1) errors.push('uneven buildings');
  }
  for (const deck of ['chance', 'community'] as const) {
    const expected = deckIds(deck);
    const pile = deck === 'chance' ? state.decks.chance : state.decks.community;
    const discard = deck === 'chance' ? state.decks.chanceDiscard : state.decks.communityDiscard;
    const held = state.players.flatMap((player) => player.getOutCards.filter((card) => card.deck === deck).map((card) => card.cardId));
    const all = [...pile, ...discard, ...held];
    if (all.length !== expected.length || new Set(all).size !== expected.length) errors.push(`${deck} deck`);
    if (all.some((id) => !CARD_MAP[id] || CARD_MAP[id].deck !== deck)) errors.push(`${deck} card`);
  }
  if (state.phase.kind === 'auction') {
    const auction = state.phase;
    if (!state.properties[auction.propertyId]) errors.push('auction property');
    if (auction.highBidderId && auction.highBid > 0) {
      const bidder = state.players.find((player) => player.id === auction.highBidderId);
      if (!bidder) errors.push('bidder');
      else if (bidder.cash < auction.highBid) errors.push('bid exceeds cash');
    }
  }
  if (state.phase.kind === 'debt') {
    if (!Number.isInteger(state.phase.amount) || state.phase.amount <= 0) errors.push('debt amount');
    if (!ids.has(state.phase.debtorId)) errors.push('debtor');
  }
  if (state.freeParking < 0 || !Number.isInteger(state.freeParking)) errors.push('pot');
  return errors;
}
