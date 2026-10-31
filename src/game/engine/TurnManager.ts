import { CARD_MAP } from '../cards/decks';
import { deedName } from '../board/plates';
import { isOwnable, spaceById, spaceByIndex } from '../board/spaces';
import { netWorth } from '../rules/building';
import { rentOwed } from '../rules/rent';
import type { CardDef, GameAction, GameState, Resume } from '../types';
import { auctionBid, auctionClose, auctionPass, openAuction } from './AuctionManager';
import type { Ctx } from './context';
import { declareBankruptcy } from './EconomyManager';
import { credit, currentPlayer, declareScoreWinner, declareWinner, ended, log, nextAliveIndex, playerById, transfer } from './ops';
import { buildHouse, mortgageProperty, sellBuilding, unmortgageProperty } from './PropertyManager';
import { applyTrade, makeOfferId, validateOffer } from './TradingManager';

const RAILROAD_INDEXES = [5, 15, 25, 35];
const UTILITY_INDEXES = [12, 28];

export function actingPlayerId(state: GameState): string | null {
  switch (state.phase.kind) {
    case 'ended':
      return null;
    case 'debt':
      return state.phase.debtorId;
    case 'auction':
      return state.phase.activePlayerId;
    case 'trade':
      return state.phase.offer.toId;
    default:
      return currentPlayer(state).id;
  }
}

function guardDepth(ctx: Ctx): void {
  ctx.depth += 1;
  if (ctx.depth > 32) throw new Error('Resolution chain exceeded the safety limit');
}

function endTurn(state: GameState, ctx: Ctx): void {
  if (state.phase.kind === 'ended') return;
  state.pendingRollAgain = false;
  state.doublesCount = 0;
  state.tradesThisTurn = 0;
  if (declareWinner(state, ctx)) return;
  state.currentPlayerIndex = nextAliveIndex(state, state.currentPlayerIndex);
  state.turn += 1;
  if ((state.rules.turnLimit ?? 0) > 0 && state.turn > state.rules.turnLimit) {
    declareScoreWinner(state, ctx);
    return;
  }
  state.phase = { kind: 'pre-roll' };
  const player = currentPlayer(state);
  ctx.events.push({ type: 'turn', playerId: player.id });
  log(state, ctx, `${player.name}'s turn.`);
}

function afterLanding(state: GameState, ctx: Ctx): void {
  if (state.phase.kind === 'ended') return;
  const player = currentPlayer(state);
  if (player.bankrupt) {
    endTurn(state, ctx);
    return;
  }
  if (state.pendingRollAgain) {
    state.phase = { kind: 'pre-roll' };
    log(state, ctx, `${player.name} rolled doubles and rolls again.`);
    return;
  }
  state.phase = { kind: 'manage' };
}

function continueResume(state: GameState, ctx: Ctx, resume: Resume): void {
  if (ended(state)) return;
  guardDepth(ctx);
  switch (resume.kind) {
    case 'after-landing':
      afterLanding(state, ctx);
      return;
    case 'leave-jail-move': {
      const player = playerById(state, resume.playerId);
      if (player.bankrupt) {
        endTurn(state, ctx);
        return;
      }
      player.inJail = false;
      player.jailTurns = 0;
      state.pendingRollAgain = false;
      state.doublesCount = 0;
      executeMove(state, ctx, player.id, resume.steps);
      return;
    }
    case 'payments':
      runPayments(state, ctx, resume);
      return;
    case 'collect':
      runCollect(state, ctx, resume);
      return;
    case 'auction-queue': {
      if (resume.index >= resume.propertyIds.length) {
        continueResume(state, ctx, resume.then);
        return;
      }
      const propertyId = resume.propertyIds[resume.index];
      openAuction(state, ctx, propertyId, {
        kind: 'auction-queue',
        propertyIds: resume.propertyIds,
        index: resume.index + 1,
        then: resume.then,
      });
      return;
    }
    case 'mortgage-interest': {
      chargeOrDebt(state, ctx, resume.playerId, 'bank', resume.amount, 'Mortgage interest', resume.then);
      return;
    }
    default:
      return;
  }
}

function chargeOrDebt(
  state: GameState,
  ctx: Ctx,
  fromId: string,
  toId: string | 'bank',
  amount: number,
  reason: string,
  then: Resume,
): void {
  if (ended(state)) return;
  const from = playerById(state, fromId);
  if (from.bankrupt || amount <= 0) {
    continueResume(state, ctx, then);
    return;
  }
  if (from.cash >= amount) {
    transfer(state, ctx, fromId, toId, amount, reason);
    continueResume(state, ctx, then);
    return;
  }
  state.phase = { kind: 'debt', debtorId: fromId, creditorId: toId, amount, reason, resume: then };
  log(state, ctx, `${from.name} owes $${amount} for ${reason} and must raise funds or go bankrupt.`);
}

function runPayments(state: GameState, ctx: Ctx, resume: Extract<Resume, { kind: 'payments' }>): void {
  let index = resume.index;
  const from = playerById(state, resume.fromId);
  if (from.bankrupt) {
    continueResume(state, ctx, resume.then);
    return;
  }
  while (index < resume.queue.length) {
    const payment = resume.queue[index];
    if (from.cash < payment.amount) {
      state.phase = {
        kind: 'debt',
        debtorId: from.id,
        creditorId: payment.toId,
        amount: payment.amount,
        reason: payment.reason,
        resume: { ...resume, index: index + 1 },
      };
      log(state, ctx, `${from.name} owes $${payment.amount} for ${payment.reason} and must raise funds or go bankrupt.`);
      return;
    }
    transfer(state, ctx, from.id, payment.toId, payment.amount, payment.reason);
    index += 1;
  }
  continueResume(state, ctx, resume.then);
}

function runCollect(state: GameState, ctx: Ctx, resume: Extract<Resume, { kind: 'collect' }>): void {
  if (resume.index >= resume.debtorIds.length) {
    continueResume(state, ctx, resume.then);
    return;
  }
  const debtorId = resume.debtorIds[resume.index];
  const next: Resume = { ...resume, index: resume.index + 1 };
  chargeOrDebt(state, ctx, debtorId, resume.beneficiaryId, resume.amount, resume.reason, next);
}

function sendToJail(state: GameState, ctx: Ctx, playerId: string, reason: string): void {
  const player = playerById(state, playerId);
  const from = player.position;
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  state.doublesCount = 0;
  state.pendingRollAgain = false;
  ctx.events.push({ type: 'move', playerId, from, to: 10, path: [], direct: true });
  ctx.events.push({ type: 'jail', playerId, reason });
  log(state, ctx, `${player.name} goes to Jail. ${reason}.`);
  endTurn(state, ctx);
}

function moveAlong(state: GameState, ctx: Ctx, playerId: string, path: number[], payGo: boolean): void {
  const player = playerById(state, playerId);
  if (path.length === 0) {
    resolveSpace(state, ctx, playerId);
    return;
  }
  const from = player.position;
  player.position = path[path.length - 1];
  ctx.events.push({ type: 'move', playerId, from, to: player.position, path, direct: false });
  if (payGo && path.includes(0)) credit(state, ctx, playerId, state.rules.goSalary, 'Passed GO');
  resolveSpace(state, ctx, playerId);
}

function executeMove(state: GameState, ctx: Ctx, playerId: string, steps: number): void {
  const player = playerById(state, playerId);
  const path: number[] = [];
  for (let step = 1; step <= steps; step += 1) path.push((player.position + step) % 40);
  moveAlong(state, ctx, playerId, path, true);
}

function moveForwardTo(
  state: GameState,
  ctx: Ctx,
  playerId: string,
  target: number,
  landing: { rentMultiplier: number; utilityTen: boolean },
): void {
  const player = playerById(state, playerId);
  const path: number[] = [];
  let pos = player.position;
  while (pos !== target && path.length < 40) {
    pos = (pos + 1) % 40;
    path.push(pos);
  }
  ctx.landing = landing;
  if (target === 0 && path.length === 0) {
    credit(state, ctx, playerId, state.rules.goSalary, 'Passed GO');
    resolveSpace(state, ctx, playerId);
    return;
  }
  moveAlong(state, ctx, playerId, path, true);
}

function moveBackward(state: GameState, ctx: Ctx, playerId: string, spaces: number): void {
  const player = playerById(state, playerId);
  const path: number[] = [];
  let pos = player.position;
  for (let step = 0; step < spaces; step += 1) {
    pos = (pos + 39) % 40;
    path.push(pos);
  }
  ctx.landing = { rentMultiplier: 1, utilityTen: false };
  moveAlong(state, ctx, playerId, path, false);
}

function nearestForward(from: number, targets: number[]): number {
  let best = targets[0];
  let bestDist = 40;
  for (const target of targets) {
    const dist = (target - from + 40) % 40;
    if (dist > 0 && dist < bestDist) {
      bestDist = dist;
      best = target;
    }
  }
  return best;
}

function shuffle(ids: string[], rng: () => number): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

function drawCard(state: GameState, ctx: Ctx, playerId: string, deck: 'chance' | 'community'): void {
  const pile = deck === 'chance' ? state.decks.chance : state.decks.community;
  const discard = deck === 'chance' ? state.decks.chanceDiscard : state.decks.communityDiscard;
  if (pile.length === 0) {
    if (discard.length === 0) {
      log(state, ctx, `The ${deck === 'chance' ? 'Chance' : 'Community Chest'} deck is empty.`);
      afterLanding(state, ctx);
      return;
    }
    pile.push(...shuffle(discard, ctx.rng));
    discard.length = 0;
  }
  const cardId = pile.shift();
  if (!cardId) {
    afterLanding(state, ctx);
    return;
  }
  const card = CARD_MAP[cardId];
  ctx.events.push({ type: 'card', cardId, deck, text: card.text });
  log(state, ctx, card.text);
  if (card.action.type !== 'jail-card') discard.push(cardId);
  applyCard(state, ctx, playerId, card);
}

function applyCard(state: GameState, ctx: Ctx, playerId: string, card: CardDef): void {
  const player = playerById(state, playerId);
  const action = card.action;
  switch (action.type) {
    case 'cash':
      if (action.amount >= 0) {
        credit(state, ctx, playerId, action.amount, card.text);
        afterLanding(state, ctx);
      } else {
        chargeOrDebt(state, ctx, playerId, 'bank', -action.amount, card.text, { kind: 'after-landing' });
      }
      return;
    case 'advance':
      moveForwardTo(state, ctx, playerId, action.space, { rentMultiplier: 1, utilityTen: false });
      return;
    case 'advance-nearest':
      if (action.target === 'railroad') {
        const target = nearestForward(player.position, RAILROAD_INDEXES);
        moveForwardTo(state, ctx, playerId, target, { rentMultiplier: 2, utilityTen: false });
      } else {
        const target = nearestForward(player.position, UTILITY_INDEXES);
        moveForwardTo(state, ctx, playerId, target, { rentMultiplier: 1, utilityTen: true });
      }
      return;
    case 'go-back':
      moveBackward(state, ctx, playerId, action.spaces);
      return;
    case 'jail':
      sendToJail(state, ctx, playerId, card.text);
      return;
    case 'jail-card':
      player.getOutCards.push({ deck: card.deck, cardId: card.id });
      log(state, ctx, `${player.name} keeps a Get Out of Jail Free card.`);
      afterLanding(state, ctx);
      return;
    case 'repairs': {
      let houses = 0;
      let hotels = 0;
      for (const prop of Object.values(state.properties)) {
        if (prop.ownerId !== playerId) continue;
        if (prop.houses === 5) hotels += 1;
        else houses += prop.houses;
      }
      const amount = houses * action.perHouse + hotels * action.perHotel;
      chargeOrDebt(state, ctx, playerId, 'bank', amount, card.text, { kind: 'after-landing' });
      return;
    }
    case 'pay-each': {
      const queue = state.players
        .filter((entry) => !entry.bankrupt && entry.id !== playerId)
        .map((entry) => ({ toId: entry.id, amount: action.amount, reason: card.text }));
      runPayments(state, ctx, { kind: 'payments', fromId: playerId, queue, index: 0, then: { kind: 'after-landing' } });
      return;
    }
    case 'collect-each': {
      const debtorIds = state.players.filter((entry) => !entry.bankrupt && entry.id !== playerId).map((entry) => entry.id);
      runCollect(state, ctx, {
        kind: 'collect',
        beneficiaryId: playerId,
        amount: action.amount,
        debtorIds,
        index: 0,
        reason: card.text,
        then: { kind: 'after-landing' },
      });
      return;
    }
    default:
      afterLanding(state, ctx);
  }
}

function resolveSpace(state: GameState, ctx: Ctx, playerId: string): void {
  if (ended(state)) return;
  guardDepth(ctx);
  const landing = ctx.landing;
  ctx.landing = { rentMultiplier: 1, utilityTen: false };
  const player = playerById(state, playerId);
  if (player.bankrupt) {
    afterLanding(state, ctx);
    return;
  }
  const space = spaceByIndex(player.position);
  if (space.kind === 'go') {
    if (state.rules.landOnGoDouble) credit(state, ctx, playerId, state.rules.goSalary, 'Landed on GO');
    else log(state, ctx, `${player.name} lands on GO.`);
    afterLanding(state, ctx);
    return;
  }
  if (space.kind === 'jail') {
    log(state, ctx, `${player.name} is just visiting Jail.`);
    afterLanding(state, ctx);
    return;
  }
  if (space.kind === 'free-parking') {
    if (state.rules.freeParkingPot && state.freeParking > 0) {
      const pot = state.freeParking;
      state.freeParking = 0;
      credit(state, ctx, playerId, pot, 'Free Parking');
    } else {
      log(state, ctx, `${player.name} lands on Free Parking.`);
    }
    afterLanding(state, ctx);
    return;
  }
  if (space.kind === 'go-to-jail') {
    sendToJail(state, ctx, playerId, 'Go To Jail');
    return;
  }
  if (space.kind === 'chance' || space.kind === 'community') {
    drawCard(state, ctx, playerId, space.kind === 'chance' ? 'chance' : 'community');
    return;
  }
  if (space.kind === 'tax') {
    if (space.taxId === 'income' && state.rules.incomeTaxChoice) {
      state.phase = { kind: 'income-tax' };
      log(state, ctx, `${player.name} must pay Income Tax: $${state.rules.incomeTax} or 10% of net worth.`);
      return;
    }
    const amount = space.taxId === 'luxury' ? state.rules.luxuryTax : state.rules.incomeTax;
    const reason = space.taxId === 'luxury' ? 'Luxury Tax' : 'Income Tax';
    chargeOrDebt(state, ctx, playerId, 'bank', amount, reason, { kind: 'after-landing' });
    return;
  }
  if (!isOwnable(space)) {
    afterLanding(state, ctx);
    return;
  }
  const owned = state.properties[space.id];
  if (!owned.ownerId) {
    state.phase = { kind: 'buy', propertyId: space.id };
    log(state, ctx, `${player.name} may buy ${deedName(state, space.id)} for $${space.price}.`);
    return;
  }
  if (owned.ownerId === playerId) {
    log(state, ctx, `${player.name} lands on ${deedName(state, space.id)}, which they already own.`);
    afterLanding(state, ctx);
    return;
  }
  if (owned.mortgaged) {
    log(state, ctx, `${deedName(state, space.id)} is mortgaged. No rent is due.`);
    afterLanding(state, ctx);
    return;
  }
  let diceTotal = (state.lastDice?.[0] ?? 0) + (state.lastDice?.[1] ?? 0);
  if (space.kind === 'utility' && landing.utilityTen) {
    const first = ctx.rollDie();
    const second = ctx.rollDie();
    diceTotal = first + second;
    ctx.events.push({ type: 'dice', dice: [first, second], doubles: first === second, reason: 'utility' });
    log(state, ctx, `${player.name} rolls ${first} and ${second} for the utility.`);
  }
  const amount = rentOwed(state, space.id, diceTotal, {
    multiplier: landing.rentMultiplier,
    utilityTen: landing.utilityTen,
  });
  if (amount <= 0) {
    log(state, ctx, `No rent is due for ${deedName(state, space.id)}.`);
    afterLanding(state, ctx);
    return;
  }
  ctx.events.push({ type: 'rent', fromId: playerId, toId: owned.ownerId, propertyId: space.id, amount });
  chargeOrDebt(state, ctx, playerId, owned.ownerId, amount, `rent at ${deedName(state, space.id)}`, { kind: 'after-landing' });
}

function rollInJail(state: GameState, ctx: Ctx, playerId: string): void {
  const player = playerById(state, playerId);
  const first = ctx.rollDie();
  const second = ctx.rollDie();
  const total = first + second;
  state.lastDice = [first, second];
  ctx.events.push({ type: 'dice', dice: [first, second], doubles: first === second, reason: 'turn' });
  log(state, ctx, `${player.name} rolls ${first} and ${second} in Jail.`);
  if (first === second) {
    player.inJail = false;
    player.jailTurns = 0;
    state.doublesCount = 0;
    state.pendingRollAgain = false;
    log(state, ctx, `${player.name} rolls doubles and leaves Jail.`);
    executeMove(state, ctx, playerId, total);
    return;
  }
  if (player.jailTurns >= state.rules.maxJailTurns - 1) {
    player.jailTurns += 1;
    log(state, ctx, `${player.name} fails the third attempt and must pay $50 to leave.`);
    chargeOrDebt(state, ctx, playerId, 'bank', 50, 'Jail fine', {
      kind: 'leave-jail-move',
      playerId,
      steps: total,
    });
    return;
  }
  player.jailTurns += 1;
  log(state, ctx, `${player.name} does not roll doubles and stays in Jail.`);
  endTurn(state, ctx);
}

function rollDice(state: GameState, ctx: Ctx, actorId: string): string | null {
  if (state.phase.kind !== 'pre-roll') return 'You cannot roll right now';
  if (currentPlayer(state).id !== actorId) return 'It is not your turn';
  const player = currentPlayer(state);
  if (player.inJail) {
    rollInJail(state, ctx, actorId);
    return null;
  }
  const first = ctx.rollDie();
  const second = ctx.rollDie();
  state.lastDice = [first, second];
  const doubles = first === second;
  ctx.events.push({ type: 'dice', dice: [first, second], doubles, reason: 'turn' });
  log(state, ctx, `${player.name} rolls ${first} and ${second}.`);
  if (doubles) {
    state.doublesCount += 1;
    if (state.doublesCount >= 3) {
      log(state, ctx, `${player.name} rolls three doubles in a row.`);
      sendToJail(state, ctx, actorId, 'Three doubles');
      return null;
    }
    state.pendingRollAgain = true;
  } else {
    state.pendingRollAgain = false;
    state.doublesCount = 0;
  }
  executeMove(state, ctx, actorId, first + second);
  return null;
}

function moneyPhase(state: GameState, actorId: string): boolean {
  if (state.phase.kind === 'debt') return state.phase.debtorId === actorId;
  if (state.phase.kind === 'pre-roll' || state.phase.kind === 'manage' || state.phase.kind === 'buy' || state.phase.kind === 'income-tax') {
    return currentPlayer(state).id === actorId;
  }
  return false;
}

function doneAuction(state: GameState, ctx: Ctx, then: Resume): void {
  continueResume(state, ctx, then);
}

export function dispatch(state: GameState, ctx: Ctx, actorId: string, action: GameAction): string | null {
  if (state.phase.kind === 'ended') return 'The game is over';
  const player = state.players.find((entry) => entry.id === actorId);
  if (!player || player.bankrupt) return 'You cannot act';

  switch (action.type) {
    case 'roll':
      return rollDice(state, ctx, actorId);
    case 'buy': {
      if (state.phase.kind !== 'buy') return 'There is nothing to buy';
      if (currentPlayer(state).id !== actorId) return 'It is not your turn';
      const propertyId = state.phase.propertyId;
      const space = spaceById(propertyId);
      if (space.kind !== 'street' && space.kind !== 'railroad' && space.kind !== 'utility') return 'This cannot be bought';
      if (state.properties[propertyId].ownerId) return 'This deed is already owned';
      if (player.cash < space.price) return 'You cannot afford this deed. Mortgage something or decline.';
      player.cash -= space.price;
      state.properties[propertyId].ownerId = player.id;
      state.properties[propertyId].mortgaged = false;
      ctx.events.push({ type: 'purchase', playerId: player.id, propertyId, price: space.price });
      log(state, ctx, `${player.name} buys ${deedName(state, space.id)} for $${space.price}.`);
      afterLanding(state, ctx);
      return null;
    }
    case 'decline': {
      if (state.phase.kind !== 'buy') return 'There is nothing to decline';
      if (currentPlayer(state).id !== actorId) return 'It is not your turn';
      const propertyId = state.phase.propertyId;
      log(state, ctx, `${player.name} declines ${deedName(state, propertyId)}.`);
      if (!state.rules.auctions) {
        afterLanding(state, ctx);
        return null;
      }
      openAuction(state, ctx, propertyId, { kind: 'after-landing' });
      return null;
    }
    case 'pay-tax': {
      if (state.phase.kind !== 'income-tax') return 'No tax decision is pending';
      if (currentPlayer(state).id !== actorId) return 'It is not your turn';
      const amount = action.method === 'flat' ? state.rules.incomeTax : Math.floor(netWorth(state, actorId) * 0.1);
      log(state, ctx, `${player.name} chooses to pay $${amount} income tax.`);
      chargeOrDebt(state, ctx, actorId, 'bank', amount, 'Income Tax', { kind: 'after-landing' });
      return null;
    }
    case 'auction-bid':
      return auctionBid(state, ctx, actorId, action.amount, doneAuction);
    case 'auction-pass':
      return auctionPass(state, ctx, actorId, doneAuction);
    case 'auction-close':
      return auctionClose(state, ctx, doneAuction);
    case 'end-turn':
      if (state.phase.kind !== 'manage') return 'You still have to finish the turn';
      if (currentPlayer(state).id !== actorId) return 'It is not your turn';
      if (state.pendingRollAgain) return 'You must roll again';
      endTurn(state, ctx);
      return null;
    case 'pay-jail':
      if (state.phase.kind !== 'pre-roll') return 'You cannot pay the fine right now';
      if (currentPlayer(state).id !== actorId) return 'It is not your turn';
      if (!player.inJail) return 'You are not in Jail';
      if (player.cash < 50) return 'You need $50 to leave Jail';
      transfer(state, ctx, actorId, 'bank', 50, 'Jail fine');
      player.inJail = false;
      player.jailTurns = 0;
      state.doublesCount = 0;
      log(state, ctx, `${player.name} pays $50 and will roll to leave Jail.`);
      return null;
    case 'use-jail-card': {
      if (state.phase.kind !== 'pre-roll') return 'You cannot use that card right now';
      if (currentPlayer(state).id !== actorId) return 'It is not your turn';
      if (!player.inJail) return 'You are not in Jail';
      if (player.getOutCards.length === 0) return 'You do not have a Get Out of Jail Free card';
      const card = player.getOutCards.pop();
      if (card) {
        const discard = card.deck === 'chance' ? state.decks.chanceDiscard : state.decks.communityDiscard;
        discard.push(card.cardId);
      }
      player.inJail = false;
      player.jailTurns = 0;
      state.doublesCount = 0;
      log(state, ctx, `${player.name} uses a Get Out of Jail Free card and will roll.`);
      return null;
    }
    case 'build':
      if (state.phase.kind !== 'pre-roll' && state.phase.kind !== 'manage') return 'You cannot build right now';
      if (currentPlayer(state).id !== actorId) return 'It is not your turn';
      return buildHouse(state, ctx, actorId, action.propertyId);
    case 'sell-building':
      if (!moneyPhase(state, actorId)) return 'You cannot sell buildings right now';
      return sellBuilding(state, ctx, actorId, action.propertyId);
    case 'mortgage':
      if (!moneyPhase(state, actorId)) return 'You cannot mortgage right now';
      return mortgageProperty(state, ctx, actorId, action.propertyId);
    case 'unmortgage':
      if (state.phase.kind === 'debt') return 'Pay your debt before unmortgaging';
      if (!moneyPhase(state, actorId)) return 'You cannot unmortgage right now';
      return unmortgageProperty(state, ctx, actorId, action.propertyId);
    case 'propose-trade': {
      if (state.phase.kind !== 'pre-roll' && state.phase.kind !== 'manage') return 'You cannot trade right now';
      if (currentPlayer(state).id !== actorId) return 'It is not your turn';
      if (state.tradesThisTurn >= 3) return 'No more trades this turn';
      const draft = {
        toId: action.toId,
        offerCash: action.offerCash,
        requestCash: action.requestCash,
        offerProperties: action.offerProperties,
        requestProperties: action.requestProperties,
        offerCards: action.offerCards,
        requestCards: action.requestCards,
        rentShareTurns: action.rentShareTurns ?? 0,
      };
      const error = validateOffer(state, actorId, draft);
      if (error) return error;
      const returnKind = state.phase.kind;
      state.tradesThisTurn += 1;
      state.phase = { kind: 'trade', returnKind, offer: { ...draft, id: makeOfferId(), fromId: actorId } };
      log(state, ctx, `${player.name} offers a trade to ${playerById(state, action.toId).name}.`);
      return null;
    }
    case 'counter-trade': {
      if (state.phase.kind !== 'trade') return 'There is no trade to counter';
      if (state.phase.offer.toId !== actorId) return 'This trade is not for you';
      const previous = state.phase.offer;
      const draft = {
        toId: previous.fromId,
        offerCash: action.offerCash,
        requestCash: action.requestCash,
        offerProperties: action.offerProperties,
        requestProperties: action.requestProperties,
        offerCards: action.offerCards,
        requestCards: action.requestCards,
        rentShareTurns: action.rentShareTurns ?? 0,
      };
      const error = validateOffer(state, actorId, draft);
      if (error) return error;
      state.phase = {
        kind: 'trade',
        returnKind: state.phase.returnKind,
        offer: { ...draft, id: makeOfferId(), fromId: actorId },
      };
      log(state, ctx, `${player.name} counters the trade.`);
      return null;
    }
    case 'accept-trade': {
      if (state.phase.kind !== 'trade') return 'There is no trade to accept';
      if (state.phase.offer.toId !== actorId) return 'This trade is not for you';
      const offer = state.phase.offer;
      const returnKind = state.phase.returnKind;
      const error = validateOffer(state, offer.fromId, offer);
      if (error) return error;
      applyTrade(state, ctx, offer);
      state.phase = { kind: returnKind };
      return null;
    }
    case 'reject-trade':
    case 'cancel-trade': {
      if (state.phase.kind !== 'trade') return 'There is no trade pending';
      const offer = state.phase.offer;
      if (action.type === 'reject-trade' && offer.toId !== actorId) return 'This trade is not for you';
      if (action.type === 'cancel-trade' && offer.fromId !== actorId) return 'Only the player who offered can cancel';
      const returnKind = state.phase.returnKind;
      state.phase = { kind: returnKind };
      log(state, ctx, action.type === 'reject-trade' ? `${player.name} rejects the trade.` : `${player.name} cancels the trade.`);
      return null;
    }
    case 'settle-debt': {
      if (state.phase.kind !== 'debt') return 'You do not owe a debt';
      if (state.phase.debtorId !== actorId) return 'This debt belongs to another player';
      if (player.cash < state.phase.amount) return 'You still do not have enough cash';
      const phase = state.phase;
      transfer(state, ctx, actorId, phase.creditorId, phase.amount, phase.reason);
      continueResume(state, ctx, phase.resume);
      return null;
    }
    case 'declare-bankruptcy':
      return declareBankruptcy(state, ctx, actorId, continueResume);
    default:
      return 'Unknown action';
  }
}
