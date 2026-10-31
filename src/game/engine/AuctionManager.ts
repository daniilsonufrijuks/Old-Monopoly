import { deedName } from '../board/plates';
import { spaceById } from '../board/spaces';
import type { GameState, Resume } from '../types';
import type { Ctx } from './context';
import { alivePlayers, currentPlayer, log, playerById } from './ops';

export type AuctionDone = (state: GameState, ctx: Ctx, then: Resume) => void;

export function openAuction(state: GameState, ctx: Ctx, propertyId: string, then: Resume): void {
  const start = state.currentPlayerIndex;
  const order: string[] = [];
  for (let step = 0; step < state.players.length; step += 1) {
    const player = state.players[(start + step) % state.players.length];
    if (!player.bankrupt) order.push(player.id);
  }
  if (order.length === 0) return;
  state.phase = {
    kind: 'auction',
    propertyId,
    highBid: 0,
    highBidderId: null,
    activePlayerId: order[0],
    passed: [],
    order,
    deadline: state.rules.auctionSeconds > 0 ? Date.now() + state.rules.auctionSeconds * 1000 : 0,
    then,
  };
  const space = spaceById(propertyId);
  log(state, ctx, `Auction started for ${deedName(state, space.id)}.`);
  ctx.events.push({ type: 'auction', propertyId, status: 'started' });
}

function finish(state: GameState, ctx: Ctx, done: AuctionDone): void {
  if (state.phase.kind !== 'auction') return;
  const phase = state.phase;
  const space = spaceById(phase.propertyId);
  if (phase.highBidderId && phase.highBid > 0) {
    const winner = playerById(state, phase.highBidderId);
    if (winner.cash < phase.highBid) {
      log(state, ctx, `The high bid for ${deedName(state, space.id)} could not be paid. The deed stays with the bank.`);
      ctx.events.push({ type: 'auction', propertyId: phase.propertyId, status: 'unsold' });
    } else {
      winner.cash -= phase.highBid;
      const prop = state.properties[phase.propertyId];
      prop.ownerId = winner.id;
      prop.mortgaged = false;
      prop.houses = 0;
      log(state, ctx, `${winner.name} wins ${deedName(state, space.id)} for $${phase.highBid}.`);
      ctx.events.push({
        type: 'auction',
        propertyId: phase.propertyId,
        status: 'sold',
        winnerId: winner.id,
        amount: phase.highBid,
      });
    }
  } else {
    log(state, ctx, `${deedName(state, space.id)} stays with the bank.`);
    ctx.events.push({ type: 'auction', propertyId: phase.propertyId, status: 'unsold' });
  }
  const then = phase.then;
  done(state, ctx, then);
}

function advance(state: GameState, ctx: Ctx, done: AuctionDone): void {
  if (state.phase.kind !== 'auction') return;
  const phase = state.phase;
  const remaining = phase.order.filter((id) => !phase.passed.includes(id));
  if (remaining.length === 0 || (remaining.length === 1 && remaining[0] === phase.highBidderId)) {
    finish(state, ctx, done);
    return;
  }
  const start = Math.max(0, phase.order.indexOf(phase.activePlayerId));
  for (let step = 1; step <= phase.order.length; step += 1) {
    const id = phase.order[(start + step) % phase.order.length];
    if (!phase.passed.includes(id)) {
      phase.activePlayerId = id;
      return;
    }
  }
  finish(state, ctx, done);
}

export function auctionClose(state: GameState, ctx: Ctx, done: AuctionDone): string | null {
  if (state.phase.kind !== 'auction') return 'There is no auction';
  const phase = state.phase;
  if (!phase.deadline) return 'This auction is not timed';
  if (Date.now() + 250 < phase.deadline) return 'The auction is still open';
  finish(state, ctx, done);
  return null;
}

export function auctionBid(state: GameState, ctx: Ctx, actorId: string, amount: number, done: AuctionDone): string | null {
  if (state.phase.kind !== 'auction') return 'There is no auction';
  const phase = state.phase;
  const open = phase.deadline > 0;
  if (!phase.order.includes(actorId)) return 'You are not in this auction';
  if (phase.passed.includes(actorId)) return 'You are out of this auction';
  if (!open && actorId !== phase.activePlayerId) return 'It is not your bid';
  if (!Number.isInteger(amount) || amount < 1) return 'Enter a whole-dollar bid';
  if (amount <= phase.highBid) return `The bid must be higher than $${phase.highBid}`;
  const bidder = playerById(state, actorId);
  if (bidder.bankrupt) return 'You are bankrupt';
  if (bidder.cash < amount) return 'You cannot bid more cash than you hold';
  phase.highBid = amount;
  phase.highBidderId = actorId;
  if (phase.deadline > 0 && state.rules.auctionSeconds > 0) {
    phase.deadline = Date.now() + state.rules.auctionSeconds * 1000;
  }
  log(state, ctx, `${bidder.name} bids $${amount}.`);
  advance(state, ctx, done);
  return null;
}

export function auctionPass(state: GameState, ctx: Ctx, actorId: string, done: AuctionDone): string | null {
  if (state.phase.kind !== 'auction') return 'There is no auction';
  const phase = state.phase;
  const open = phase.deadline > 0;
  if (!open && actorId !== phase.activePlayerId) return 'It is not your bid';
  if (!phase.order.includes(actorId) || phase.passed.includes(actorId)) return 'You are out of this auction';
  if (!phase.passed.includes(actorId)) phase.passed.push(actorId);
  log(state, ctx, `${playerById(state, actorId).name} passes.`);
  advance(state, ctx, done);
  return null;
}

export function currentBidder(state: GameState): string | null {
  if (state.phase.kind !== 'auction') return null;
  return state.phase.activePlayerId;
}

export function auctionPlayers(state: GameState): string[] {
  return alivePlayers(state).map((player) => player.id);
}

export function landedPlayerId(state: GameState): string {
  return currentPlayer(state).id;
}
