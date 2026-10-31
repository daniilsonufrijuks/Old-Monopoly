export const TOKEN_IDS = [
  'car',
  'dog',
  'hat',
  'ship',
  'shoe',
  'thimble',
  'cannon',
  'wheelbarrow',
] as const;

export type TokenId = (typeof TOKEN_IDS)[number];
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Personality = 'cautious' | 'aggressive' | 'trader' | 'tycoon' | 'opportunist';
export type ColorGroup =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkblue';

export type GameModeId = 'classic' | 'short' | 'speed' | 'tycoon' | 'friendly' | 'cutthroat';

export interface GameRules {
  modeId: GameModeId;
  startingCash: number;
  goSalary: number;
  /** Landing exactly on GO pays the salary a second time. */
  landOnGoDouble: boolean;
  /** 0 plays until one player remains. Otherwise the richest player wins after this many completed turns. */
  turnLimit: number;
  /** 1 is full price. 0.5 is the Speed table. */
  houseCostFactor: number;
  freeParkingPot: boolean;
  auctions: boolean;
  incomeTax: number;
  luxuryTax: number;
  /** When true, Income Tax may be paid as a flat fee or 10% of net worth. */
  incomeTaxChoice: boolean;
  maxJailTurns: number;
  /** Seconds of real-time bidding. 0 keeps a turn-based auction. */
  auctionSeconds: number;
  /** How the host treats a disconnected human on their turn. */
  disconnectMode: 'wait' | 'autoplay';
}

export const CLASSIC_RULES: GameRules = {
  modeId: 'classic',
  startingCash: 1500,
  goSalary: 200,
  landOnGoDouble: false,
  turnLimit: 0,
  houseCostFactor: 1,
  freeParkingPot: false,
  auctions: true,
  incomeTax: 200,
  luxuryTax: 75,
  incomeTaxChoice: true,
  maxJailTurns: 3,
  auctionSeconds: 20,
  disconnectMode: 'autoplay',
};

export type CardAction =
  | { type: 'cash'; amount: number }
  | { type: 'advance'; space: number }
  | { type: 'advance-nearest'; target: 'railroad' | 'utility' }
  | { type: 'go-back'; spaces: number }
  | { type: 'jail' }
  | { type: 'jail-card' }
  | { type: 'repairs'; perHouse: number; perHotel: number }
  | { type: 'pay-each'; amount: number }
  | { type: 'collect-each'; amount: number };

export interface CardDef {
  id: string;
  deck: 'chance' | 'community';
  text: string;
  action: CardAction;
}

export interface GetOutCard {
  deck: 'chance' | 'community';
  cardId: string;
}

export interface PlayerState {
  id: string;
  name: string;
  token: TokenId;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutCards: GetOutCard[];
  bankrupt: boolean;
  isAI: boolean;
  isHost: boolean;
  difficulty: Difficulty;
  personality: Personality;
  connected: boolean;
  rentIn: number;
  rentOut: number;
}

export interface PropertyState {
  id: string;
  ownerId: string | null;
  /** 0–4 houses, 5 = hotel. */
  houses: number;
  mortgaged: boolean;
}

export interface Payment {
  toId: string | 'bank';
  amount: number;
  reason: string;
}

export type Resume =
  | { kind: 'after-landing' }
  | { kind: 'leave-jail-move'; playerId: string; steps: number }
  | { kind: 'payments'; fromId: string; queue: Payment[]; index: number; then: Resume }
  | {
      kind: 'collect';
      beneficiaryId: string;
      amount: number;
      debtorIds: string[];
      index: number;
      reason: string;
      then: Resume;
    }
  | { kind: 'auction-queue'; propertyIds: string[]; index: number; then: Resume }
  | { kind: 'mortgage-interest'; playerId: string; amount: number; then: Resume };

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  offerCash: number;
  requestCash: number;
  offerProperties: string[];
  requestProperties: string[];
  offerCards: number;
  requestCards: number;
  /** How many future rent collections the new owner shares, at half. */
  rentShareTurns: number;
}

export interface RentAgreement {
  ownerId: string;
  payeeId: string;
  turnsLeft: number;
}

export type Phase =
  | { kind: 'pre-roll' }
  | { kind: 'buy'; propertyId: string }
  | { kind: 'income-tax' }
  | {
      kind: 'auction';
      propertyId: string;
      highBid: number;
      highBidderId: string | null;
      activePlayerId: string;
      passed: string[];
      order: string[];
      /** Epoch ms. 0 means the auction is turn-based. */
      deadline: number;
      then: Resume;
    }
  | {
      kind: 'debt';
      debtorId: string;
      creditorId: string | 'bank';
      amount: number;
      reason: string;
      resume: Resume;
    }
  | { kind: 'trade'; offer: TradeOffer; returnKind: 'pre-roll' | 'manage' }
  | { kind: 'manage' }
  | { kind: 'ended'; winnerId: string; reason?: 'survival' | 'limit' };

export interface LogEntry {
  id: string;
  turn: number;
  message: string;
}

export interface GameState {
  version: 1;
  id: string;
  mode: 'solo' | 'lan';
  rules: GameRules;
  players: PlayerState[];
  currentPlayerIndex: number;
  properties: Record<string, PropertyState>;
  decks: {
    chance: string[];
    community: string[];
    chanceDiscard: string[];
    communityDiscard: string[];
  };
  phase: Phase;
  doublesCount: number;
  pendingRollAgain: boolean;
  turn: number;
  tradesThisTurn: number;
  lastDice: [number, number] | null;
  freeParking: number;
  bank: { houses: number; hotels: number };
  agreements: RentAgreement[];
  log: LogEntry[];
}

export type GameAction =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'pay-tax'; method: 'flat' | 'percent' }
  | { type: 'auction-bid'; amount: number }
  | { type: 'auction-pass' }
  | { type: 'auction-close' }
  | { type: 'end-turn' }
  | { type: 'pay-jail' }
  | { type: 'use-jail-card' }
  | { type: 'build'; propertyId: string }
  | { type: 'sell-building'; propertyId: string }
  | { type: 'mortgage'; propertyId: string }
  | { type: 'unmortgage'; propertyId: string }
  | {
      type: 'propose-trade';
      toId: string;
      offerCash: number;
      requestCash: number;
      offerProperties: string[];
      requestProperties: string[];
      offerCards: number;
      requestCards: number;
      rentShareTurns?: number;
    }
  | {
      type: 'counter-trade';
      offerCash: number;
      requestCash: number;
      offerProperties: string[];
      requestProperties: string[];
      offerCards: number;
      requestCards: number;
      rentShareTurns?: number;
    }
  | { type: 'accept-trade' }
  | { type: 'reject-trade' }
  | { type: 'cancel-trade' }
  | { type: 'settle-debt' }
  | { type: 'declare-bankruptcy' };

export type GameEvent =
  | { type: 'log'; message: string }
  | { type: 'dice'; dice: [number, number]; doubles: boolean; reason: 'turn' | 'utility' }
  | { type: 'move'; playerId: string; from: number; to: number; path: number[]; direct: boolean }
  | { type: 'cash'; playerId: string; delta: number; reason: string; counterparty: string | 'bank' }
  | { type: 'card'; cardId: string; deck: 'chance' | 'community'; text: string }
  | { type: 'jail'; playerId: string; reason: string }
  | { type: 'purchase'; playerId: string; propertyId: string; price: number }
  | { type: 'rent'; fromId: string; toId: string; propertyId: string; amount: number }
  | { type: 'build'; playerId: string; propertyId: string; houses: number }
  | { type: 'mortgage'; playerId: string; propertyId: string; mortgaged: boolean }
  | { type: 'bankrupt'; playerId: string; creditorId: string | 'bank' }
  | { type: 'win'; playerId: string }
  | { type: 'turn'; playerId: string }
  | { type: 'auction'; propertyId: string; status: 'started' | 'sold' | 'unsold'; winnerId?: string; amount?: number };

export interface ActionResult {
  ok: boolean;
  error?: string;
  events: GameEvent[];
  state: GameState;
}

export interface NewPlayerConfig {
  id?: string;
  name: string;
  token: TokenId;
  isAI: boolean;
  isHost?: boolean;
  difficulty?: Difficulty;
  personality?: Personality;
}

export interface NewGameConfig {
  players: NewPlayerConfig[];
  rules?: Partial<GameRules>;
  mode: 'solo' | 'lan';
  seed?: number;
  extraCards?: Array<{ text: string; amount: number }>;
}
