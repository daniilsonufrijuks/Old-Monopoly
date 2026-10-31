import { isOwnable, spaceById } from './spaces';

export const MARK_KINDS = ['seal', 'anchor', 'lamp', 'sun', 'crown', 'key', 'tree', 'star', 'rail', 'bolt', 'drop'] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export interface CompanyPlate {
  name: string;
  shortName: string;
  company: string;
  letter: string;
  kind: MarkKind;
}

export const FIRM_CATALOG: CompanyPlate[] = [
  { name: 'Northline', shortName: 'Northline', company: 'Northline Rail', letter: 'N', kind: 'rail' },
  { name: 'Glassworks', shortName: 'Glass', company: 'Glass & Co.', letter: 'G', kind: 'sun' },
  { name: 'Copper Kettle', shortName: 'Kettle', company: 'Copper Kettle', letter: 'C', kind: 'crown' },
  { name: 'Lantern Press', shortName: 'Lantern', company: 'Lantern Press', letter: 'L', kind: 'lamp' },
  { name: 'Oak & Ivy', shortName: 'Oak', company: 'Oak & Ivy', letter: 'O', kind: 'tree' },
  { name: 'Star Ferry', shortName: 'Ferry', company: 'Star Ferry', letter: 'S', kind: 'anchor' },
  { name: 'Crown Exchange', shortName: 'Crown', company: 'Crown Exchange', letter: 'C', kind: 'crown' },
  { name: 'Keystone', shortName: 'Keystone', company: 'Keystone Bank', letter: 'K', kind: 'key' },
  { name: 'Pinecrest', shortName: 'Pine', company: 'Pinecrest', letter: 'P', kind: 'tree' },
  { name: 'Volt Works', shortName: 'Volt', company: 'Volt & Co.', letter: 'V', kind: 'bolt' },
  { name: 'Wellspring', shortName: 'Well', company: 'Wellspring', letter: 'W', kind: 'drop' },
  { name: 'Pier House', shortName: 'Pier', company: 'Pier House', letter: 'P', kind: 'anchor' },
  { name: 'Atlas Foundry', shortName: 'Atlas', company: 'Atlas Foundry', letter: 'A', kind: 'seal' },
  { name: 'Marlowe Club', shortName: 'Marlowe', company: 'Marlowe Club', letter: 'M', kind: 'star' },
  { name: 'Westwind', shortName: 'Westwind', company: 'Westwind', letter: 'W', kind: 'sun' },
  { name: 'Goldfinch', shortName: 'Finch', company: 'Goldfinch', letter: 'G', kind: 'star' },
];

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

export function sanitizePlates(input: unknown): Record<string, CompanyPlate> {
  if (!input || typeof input !== 'object') return {};
  const plates: Record<string, CompanyPlate> = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    let space;
    try {
      space = spaceById(id);
    } catch {
      continue;
    }
    if (!isOwnable(space) || !raw || typeof raw !== 'object') continue;
    const row = raw as Partial<CompanyPlate>;
    const name = clean(row.name, 22);
    if (!name) continue;
    const kind = MARK_KINDS.includes(row.kind as MarkKind) ? row.kind as MarkKind : 'seal';
    const letter = (clean(row.letter, 2) || name[0] || 'C').slice(0, 1).toUpperCase();
    plates[id] = {
      name,
      shortName: clean(row.shortName, 12) || name.slice(0, 12),
      company: clean(row.company, 28) || name,
      letter,
      kind,
    };
  }
  return plates;
}

export function deedName(state: { plates?: Record<string, CompanyPlate> } | undefined, id: string): string {
  const plate = state?.plates?.[id];
  if (plate?.name) return plate.name;
  return spaceById(id).name;
}
