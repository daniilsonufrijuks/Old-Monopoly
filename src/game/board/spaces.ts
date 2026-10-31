import type { ColorGroup } from '../types';

export interface StreetSpace {
  index: number;
  id: string;
  name: string;
  shortName: string;
  kind: 'street';
  group: ColorGroup;
  price: number;
  rent: [number, number, number, number, number, number];
  houseCost: number;
  mortgage: number;
}

export interface RailroadSpace {
  index: number;
  id: string;
  name: string;
  shortName: string;
  kind: 'railroad';
  price: 200;
  mortgage: 100;
}

export interface UtilitySpace {
  index: number;
  id: string;
  name: string;
  shortName: string;
  kind: 'utility';
  price: 150;
  mortgage: 75;
}

export interface SpecialSpace {
  index: number;
  id: string;
  name: string;
  shortName: string;
  kind: 'go' | 'jail' | 'free-parking' | 'go-to-jail' | 'chance' | 'community' | 'tax';
  tax?: number;
  taxId?: 'income' | 'luxury';
}

export type SpaceDef = StreetSpace | RailroadSpace | UtilitySpace | SpecialSpace;

export const GROUP_COLOR: Record<ColorGroup, string> = {
  brown: '#8B5A2B',
  lightblue: '#A9DFF5',
  pink: '#D948A4',
  orange: '#F7941D',
  red: '#E23B32',
  yellow: '#FFE14A',
  green: '#1F9D55',
  darkblue: '#1A5FB4',
};

export const GROUP_ORDER: ColorGroup[] = [
  'brown',
  'lightblue',
  'pink',
  'orange',
  'red',
  'yellow',
  'green',
  'darkblue',
];

const street = (
  index: number,
  id: string,
  name: string,
  shortName: string,
  group: ColorGroup,
  price: number,
  rent: [number, number, number, number, number, number],
  houseCost: number,
): StreetSpace => ({
  index,
  id,
  name,
  shortName,
  kind: 'street',
  group,
  price,
  rent,
  houseCost,
  mortgage: price / 2,
});

export const SPACES: SpaceDef[] = [
  { index: 0, id: 'go', name: 'GO', shortName: 'GO', kind: 'go' },
  street(1, 'mediterranean', 'Mediterranean Avenue', 'Med. Ave', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { index: 2, id: 'cc-1', name: 'Community Chest', shortName: 'Comm. Chest', kind: 'community' },
  street(3, 'baltic', 'Baltic Avenue', 'Baltic', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { index: 4, id: 'income-tax', name: 'Income Tax', shortName: 'Income Tax', kind: 'tax', tax: 200, taxId: 'income' },
  { index: 5, id: 'reading', name: 'Reading Railroad', shortName: 'Reading RR', kind: 'railroad', price: 200, mortgage: 100 },
  street(6, 'oriental', 'Oriental Avenue', 'Oriental', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  { index: 7, id: 'chance-1', name: 'Chance', shortName: 'Chance', kind: 'chance' },
  street(8, 'vermont', 'Vermont Avenue', 'Vermont', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  street(9, 'connecticut', 'Connecticut Avenue', 'Connecticut', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50),
  { index: 10, id: 'jail', name: 'Jail / Just Visiting', shortName: 'Jail', kind: 'jail' },
  street(11, 'st-charles', 'St. Charles Place', 'St. Charles', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  { index: 12, id: 'electric', name: 'Electric Company', shortName: 'Electric Co.', kind: 'utility', price: 150, mortgage: 75 },
  street(13, 'states', 'States Avenue', 'States', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  street(14, 'virginia', 'Virginia Avenue', 'Virginia', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { index: 15, id: 'pennsylvania-rr', name: 'Pennsylvania Railroad', shortName: 'Penn. RR', kind: 'railroad', price: 200, mortgage: 100 },
  street(16, 'st-james', 'St. James Place', 'St. James', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { index: 17, id: 'cc-2', name: 'Community Chest', shortName: 'Comm. Chest', kind: 'community' },
  street(18, 'tennessee', 'Tennessee Avenue', 'Tennessee', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  street(19, 'new-york', 'New York Avenue', 'New York', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { index: 20, id: 'free-parking', name: 'Free Parking', shortName: 'Free Parking', kind: 'free-parking' },
  street(21, 'kentucky', 'Kentucky Avenue', 'Kentucky', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { index: 22, id: 'chance-2', name: 'Chance', shortName: 'Chance', kind: 'chance' },
  street(23, 'indiana', 'Indiana Avenue', 'Indiana', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  street(24, 'illinois', 'Illinois Avenue', 'Illinois', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { index: 25, id: 'bo', name: 'B. & O. Railroad', shortName: 'B&O RR', kind: 'railroad', price: 200, mortgage: 100 },
  street(26, 'atlantic', 'Atlantic Avenue', 'Atlantic', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  street(27, 'ventnor', 'Ventnor Avenue', 'Ventnor', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  { index: 28, id: 'water', name: 'Water Works', shortName: 'Water Works', kind: 'utility', price: 150, mortgage: 75 },
  street(29, 'marvin', 'Marvin Gardens', 'Marvin Gardens', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { index: 30, id: 'go-to-jail', name: 'Go To Jail', shortName: 'Go To Jail', kind: 'go-to-jail' },
  street(31, 'pacific', 'Pacific Avenue', 'Pacific', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  street(32, 'north-carolina', 'North Carolina Avenue', 'N. Carolina', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { index: 33, id: 'cc-3', name: 'Community Chest', shortName: 'Comm. Chest', kind: 'community' },
  street(34, 'pennsylvania', 'Pennsylvania Avenue', 'Pennsylvania', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { index: 35, id: 'short-line', name: 'Short Line', shortName: 'Short Line', kind: 'railroad', price: 200, mortgage: 100 },
  { index: 36, id: 'chance-3', name: 'Chance', shortName: 'Chance', kind: 'chance' },
  street(37, 'park-place', 'Park Place', 'Park Place', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { index: 38, id: 'luxury-tax', name: 'Luxury Tax', shortName: 'Luxury Tax', kind: 'tax', tax: 75, taxId: 'luxury' },
  street(39, 'boardwalk', 'Boardwalk', 'Boardwalk', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

export const RAILROAD_IDS = ['reading', 'pennsylvania-rr', 'bo', 'short-line'] as const;
export const UTILITY_IDS = ['electric', 'water'] as const;

export const GROUP_IDS: Record<ColorGroup, string[]> = {
  brown: ['mediterranean', 'baltic'],
  lightblue: ['oriental', 'vermont', 'connecticut'],
  pink: ['st-charles', 'states', 'virginia'],
  orange: ['st-james', 'tennessee', 'new-york'],
  red: ['kentucky', 'indiana', 'illinois'],
  yellow: ['atlantic', 'ventnor', 'marvin'],
  green: ['pacific', 'north-carolina', 'pennsylvania'],
  darkblue: ['park-place', 'boardwalk'],
};

const byId = new Map(SPACES.map((space) => [space.id, space]));
const byIndex = new Map(SPACES.map((space) => [space.index, space]));

export function spaceById(id: string): SpaceDef {
  const space = byId.get(id);
  if (!space) throw new Error(`Unknown space ${id}`);
  return space;
}

export function spaceByIndex(index: number): SpaceDef {
  const space = byIndex.get(index);
  if (!space) throw new Error(`Unknown index ${index}`);
  return space;
}

export function isOwnable(space: SpaceDef): space is StreetSpace | RailroadSpace | UtilitySpace {
  return space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility';
}

export function ownableSpaces(): Array<StreetSpace | RailroadSpace | UtilitySpace> {
  return SPACES.filter(isOwnable);
}

export function mortgageValue(space: StreetSpace | RailroadSpace | UtilitySpace): number {
  return space.mortgage;
}

export function unmortgageCost(mortgage: number): number {
  return Math.round(mortgage * 1.1);
}

export function groupIdsFor(space: SpaceDef): string[] {
  if (space.kind === 'street') return GROUP_IDS[space.group];
  if (space.kind === 'railroad') return [...RAILROAD_IDS];
  if (space.kind === 'utility') return [...UTILITY_IDS];
  return [];
}
