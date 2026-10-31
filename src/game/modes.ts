import { CLASSIC_RULES, type GameModeId, type GameRules } from './types';

export interface GameMode {
  id: GameModeId;
  name: string;
  blurb: string;
  rules: Partial<GameRules>;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'The traditional table. $1,500, auctions, and play until one player remains.',
    rules: {},
  },
  {
    id: 'short',
    name: 'Short Match',
    blurb: 'More cash, double salary for landing on GO, and a winner after 40 turns.',
    rules: { startingCash: 2000, landOnGoDouble: true, turnLimit: 40, auctions: true, freeParkingPot: false },
  },
  {
    id: 'speed',
    name: 'Speed',
    blurb: 'Houses and hotels cost half. The richest player wins after 28 turns.',
    rules: { houseCostFactor: 0.5, turnLimit: 28, auctions: true, freeParkingPot: false },
  },
  {
    id: 'tycoon',
    name: 'Tycoon',
    blurb: '$2,500, a $300 salary, a double landing on GO, and taxes feed Free Parking.',
    rules: { startingCash: 2500, goSalary: 300, landOnGoDouble: true, freeParkingPot: true, auctions: true, turnLimit: 0 },
  },
  {
    id: 'friendly',
    name: 'Friendly',
    blurb: 'No auctions, a lighter tax bill, and the Free Parking pot.',
    rules: { startingCash: 1800, auctions: false, freeParkingPot: true, incomeTax: 100, luxuryTax: 50, incomeTaxChoice: true, turnLimit: 0 },
  },
  {
    id: 'cutthroat',
    name: 'Cutthroat',
    blurb: '$1,000, flat taxes, forced auctions, and a 48-turn clock.',
    rules: { startingCash: 1000, auctions: true, freeParkingPot: false, incomeTaxChoice: false, luxuryTax: 100, turnLimit: 48, landOnGoDouble: false },
  },
];

const MODE_IDS = new Set<string>(GAME_MODES.map((mode) => mode.id));

export function isGameMode(value: unknown): value is GameModeId {
  return typeof value === 'string' && MODE_IDS.has(value);
}

export function modeById(id: GameModeId): GameMode {
  return GAME_MODES.find((mode) => mode.id === id) ?? GAME_MODES[0];
}

export function rulesForMode(id: GameModeId): GameRules {
  return normalizeRules({ ...CLASSIC_RULES, ...modeById(id).rules, modeId: id });
}

export function tableRules(input: {
  gameMode: GameModeId;
  startingCash: number;
  freeParkingPot: boolean;
  auctions: boolean;
  incomeTaxChoice: boolean;
  disconnectMode: GameRules['disconnectMode'];
}): GameRules {
  const rules = rulesForMode(input.gameMode);
  if (input.gameMode !== 'classic') return { ...rules, disconnectMode: input.disconnectMode };
  return {
    ...rules,
    startingCash: input.startingCash,
    freeParkingPot: input.freeParkingPot,
    auctions: input.auctions,
    incomeTaxChoice: input.incomeTaxChoice,
    disconnectMode: input.disconnectMode,
  };
}

export function normalizeRules(rules: Partial<GameRules> | undefined): GameRules {
  const modeId = isGameMode(rules?.modeId) ? rules.modeId : 'classic';
  const factor = rules?.houseCostFactor === 0.5 ? 0.5 : 1;
  const turnLimit = Number.isInteger(rules?.turnLimit) ? Math.min(200, Math.max(0, rules?.turnLimit ?? 0)) : 0;
  return {
    ...CLASSIC_RULES,
    ...rules,
    modeId,
    houseCostFactor: factor,
    turnLimit,
    landOnGoDouble: Boolean(rules?.landOnGoDouble),
    goSalary: positiveInt(rules?.goSalary, CLASSIC_RULES.goSalary, 100, 500),
    startingCash: positiveInt(rules?.startingCash, CLASSIC_RULES.startingCash, 500, 3000),
    incomeTax: positiveInt(rules?.incomeTax, CLASSIC_RULES.incomeTax, 0, 500),
    luxuryTax: positiveInt(rules?.luxuryTax, CLASSIC_RULES.luxuryTax, 0, 500),
  };
}

function positiveInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value as number));
}

export function rulesPatch(rules: GameRules) {
  return {
    modeId: rules.modeId,
    startingCash: rules.startingCash,
    goSalary: rules.goSalary,
    landOnGoDouble: rules.landOnGoDouble,
    turnLimit: rules.turnLimit,
    houseCostFactor: rules.houseCostFactor === 0.5 ? 0.5 as const : 1 as const,
    freeParkingPot: rules.freeParkingPot,
    auctions: rules.auctions,
    incomeTax: rules.incomeTax,
    luxuryTax: rules.luxuryTax,
    incomeTaxChoice: rules.incomeTaxChoice,
  };
}

export function describeRules(rules: GameRules): string {
  const clock = rules.turnLimit > 0 ? `Ends after ${rules.turnLimit} turns` : 'Last player standing';
  const houses = rules.houseCostFactor < 1 ? 'Half-price houses' : 'Full-price houses';
  const go = rules.landOnGoDouble ? `Land on GO pays $${rules.goSalary * 2}` : `GO pays $${rules.goSalary}`;
  return `${modeById(rules.modeId).name} · $${rules.startingCash} · ${go} · ${houses} · ${clock}`;
}
