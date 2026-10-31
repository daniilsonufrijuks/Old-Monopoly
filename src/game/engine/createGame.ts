import { ownableSpaces } from '../board/spaces';
import { CARD_MAP, deckIds } from '../cards/decks';
import type { GameState, NewGameConfig, PlayerState, TokenId } from '../types';
import { CLASSIC_RULES } from '../types';
import { uid } from './ops';

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function withExtraCards(ids: string[], extra: NewGameConfig['extraCards']): string[] {
  const cards = (extra ?? []).slice(0, 4).filter((card) => card.text.trim() && Number.isInteger(card.amount));
  cards.forEach((card, index) => {
    const id = `custom-${index}`;
    CARD_MAP[id] = {
      id,
      deck: 'chance',
      text: card.text.trim().slice(0, 80),
      action: { type: 'cash', amount: Math.max(-500, Math.min(500, card.amount)) },
    };
  });
  return [...ids, ...cards.map((_, index) => `custom-${index}`)];
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

export function createInitialState(config: NewGameConfig, seed = 1): GameState {
  if (config.players.length < 2 || config.players.length > 6) {
    throw new Error('A game needs 2 to 6 players');
  }
  const tokens = new Set<TokenId>();
  const names = new Set<string>();
  for (const player of config.players) {
    if (tokens.has(player.token)) throw new Error('Each player needs a different token');
    tokens.add(player.token);
    const name = player.name.trim();
    if (!name || name.length > 16) throw new Error('Player names must be 1–16 characters');
    if (names.has(name.toLowerCase())) throw new Error('Player names must be unique');
    names.add(name.toLowerCase());
  }
  const rng = mulberry32(seed);
  const rules = { ...CLASSIC_RULES, ...config.rules };
  const players: PlayerState[] = config.players.map((player) => ({
    id: player.id ?? uid('player'),
    name: player.name.trim(),
    token: player.token,
    cash: rules.startingCash,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutCards: [],
    bankrupt: false,
    isAI: player.isAI,
    isHost: player.isHost ?? false,
    difficulty: player.difficulty ?? 'normal',
    personality: player.personality ?? 'cautious',
    connected: true,
    rentIn: 0,
    rentOut: 0,
  }));
  const first = Math.floor(rng() * players.length);
  const ordered = players.slice(first).concat(players.slice(0, first));
  const properties = Object.fromEntries(ownableSpaces().map((space) => [space.id, { id: space.id, ownerId: null, houses: 0, mortgaged: false }]));
  const state: GameState = {
    version: 1,
    id: uid('game'),
    mode: config.mode,
    rules,
    players: ordered,
    currentPlayerIndex: 0,
    properties,
    decks: {
      chance: shuffle(withExtraCards(deckIds('chance'), config.extraCards), rng),
      community: shuffle(deckIds('community'), rng),
      chanceDiscard: [],
      communityDiscard: [],
    },
    phase: { kind: 'pre-roll' },
    doublesCount: 0,
    pendingRollAgain: false,
    turn: 1,
    tradesThisTurn: 0,
    lastDice: null,
    freeParking: 0,
    bank: { houses: 32, hotels: 12 },
    agreements: [],
    log: [],
  };
  state.log.push({
    id: uid('log'),
    turn: 1,
    message: `${ordered[0].name} goes first.`,
  });
  return state;
}
