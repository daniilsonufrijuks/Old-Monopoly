import { spaceById } from '../board/spaces';
import { mortgageableProperty, sellableProperty } from '../rules/building';
import type { GameState, Resume } from '../types';
import type { Ctx } from './context';
import { liquidateBuildings } from './PropertyManager';
import { alivePlayers, declareWinner, log, playerById } from './ops';

function returnJailCard(state: GameState, deck: 'chance' | 'community', cardId: string): void {
  const pile = deck === 'chance' ? state.decks.chanceDiscard : state.decks.communityDiscard;
  pile.push(cardId);
}

function interestFor(state: GameState, propertyIds: string[]): number {
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

export function declareBankruptcy(
  state: GameState,
  ctx: Ctx,
  actorId: string,
  continueResume: (state: GameState, ctx: Ctx, resume: Resume) => void,
): string | null {
  if (state.phase.kind !== 'debt') return 'You are not settling a debt';
  if (actorId !== state.phase.debtorId) return 'This debt belongs to another player';
  const phase = state.phase;
  const debtor = playerById(state, phase.debtorId);
  if (debtor.cash >= phase.amount) return 'You have enough cash to pay';
  if (sellableProperty(state, debtor.id) || mortgageableProperty(state, debtor.id)) {
    return 'Sell buildings or mortgage deeds before going bankrupt';
  }

  const resume = phase.resume;
  const creditorId = phase.creditorId;
  liquidateBuildings(state, ctx, debtor.id);
  const cash = debtor.cash;
  const propertyIds = Object.values(state.properties)
    .filter((prop) => prop.ownerId === debtor.id)
    .map((prop) => prop.id);
  const cards = [...debtor.getOutCards];
  debtor.cash = 0;
  debtor.getOutCards = [];
  debtor.bankrupt = true;
  debtor.inJail = false;
  debtor.jailTurns = 0;

  ctx.events.push({ type: 'bankrupt', playerId: debtor.id, creditorId });
  log(state, ctx, `${debtor.name} goes bankrupt${creditorId === 'bank' ? ' to the bank' : ` to ${playerById(state, creditorId).name}`}.`);

  if (creditorId !== 'bank') {
    const creditor = playerById(state, creditorId);
    creditor.cash += cash;
    creditor.getOutCards.push(...cards);
    for (const id of propertyIds) state.properties[id].ownerId = creditor.id;
    if (cash > 0) log(state, ctx, `${creditor.name} receives $${cash} from the bankruptcy.`);
    if (declareWinner(state, ctx)) return null;
    const interest = interestFor(state, propertyIds);
    if (interest > 0) {
      state.phase = {
        kind: 'debt',
        debtorId: creditor.id,
        creditorId: 'bank',
        amount: interest,
        reason: 'Mortgage interest',
        resume,
      };
      if (creditor.cash >= interest) {
        creditor.cash -= interest;
        log(state, ctx, `${creditor.name} pays $${interest} mortgage interest to the bank.`);
        if (state.phase.kind === 'debt') continueResume(state, ctx, resume);
      } else {
        log(state, ctx, `${creditor.name} owes $${interest} in mortgage interest and must raise funds.`);
      }
      return null;
    }
    continueResume(state, ctx, resume);
    return null;
  }

  for (const card of cards) returnJailCard(state, card.deck, card.cardId);
  for (const id of propertyIds) {
    const prop = state.properties[id];
    prop.ownerId = null;
    prop.mortgaged = false;
    prop.houses = 0;
  }
  if (declareWinner(state, ctx)) return null;
  if (state.rules.auctions && propertyIds.length > 0) {
    continueResume(state, ctx, { kind: 'auction-queue', propertyIds, index: 0, then: resume });
    return null;
  }
  continueResume(state, ctx, resume);
  return null;
}

export function aliveCount(state: GameState): number {
  return alivePlayers(state).length;
}
