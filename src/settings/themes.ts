export const THEME_IDS = ['classic', 'deco', 'midnight', 'garden', 'parlor'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeOption {
  id: ThemeId;
  name: string;
  note: string;
  swatch: [string, string, string];
}

export const THEMES: ThemeOption[] = [
  { id: 'classic', name: 'Walnut Table', note: 'Cream board, walnut, and brass.', swatch: ['#6a4328', '#f3e4c4', '#b8893e'] },
  { id: 'deco', name: 'Art Deco', note: 'Black lacquer, ivory, and gold.', swatch: ['#1b1a17', '#f4efe2', '#d4af37'] },
  { id: 'midnight', name: 'Midnight Club', note: 'Navy felt and a pale board.', swatch: ['#121a2b', '#e7eef6', '#d6b25e'] },
  { id: 'garden', name: 'Garden Felt', note: 'Green baize and warm paper.', swatch: ['#1d4634', '#f6edd8', '#d7b56d'] },
  { id: 'parlor', name: 'Rosewood Parlor', note: 'Burgundy wood and rose gold.', swatch: ['#4a2030', '#f8efe6', '#c98b7b'] },
];

export function isTheme(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}
