import type { TokenId } from '../game/types';

export const TOKENS: Array<{ id: TokenId; label: string; metal: string }> = [
  { id: 'car', label: 'Car', metal: '#c5ccd1' },
  { id: 'dog', label: 'Dog', metal: '#d9a441' },
  { id: 'hat', label: 'Top Hat', metal: '#f2f2f2' },
  { id: 'ship', label: 'Ship', metal: '#8ec6d8' },
  { id: 'shoe', label: 'Shoe', metal: '#e07a4c' },
  { id: 'thimble', label: 'Thimble', metal: '#d5d8dc' },
  { id: 'cannon', label: 'Cannon', metal: '#6d7278' },
  { id: 'wheelbarrow', label: 'Barrow', metal: '#c47b4a' },
];

export function TokenGlyph({ id, metal }: { id: TokenId; metal?: string }) {
  const fill = metal ?? TOKENS.find((token) => token.id === id)?.metal ?? '#ddd';
  const common = { fill, stroke: '#2a2118', strokeWidth: 1.4 };
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {id === 'car' && <path {...common} d="M4 18h24l-2-6H8L4 18zm2 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm16 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />}
      {id === 'dog' && <path {...common} d="M7 20c0-6 4-10 8-10 2 0 3 2 4 2 3 0 6-3 6-3v6c2 1 2 4 1 6-2 4-6 5-10 5-5 0-9-2-9-6z" />}
      {id === 'hat' && <path {...common} d="M6 20h20v3H6zm3-3h14l-2-7H11z" />}
      {id === 'ship' && <path {...common} d="M4 20h24l-3 5H7zm8-12h2v12h-2zm2 0h10l-3 6H14z" />}
      {id === 'shoe' && <path {...common} d="M8 14c4-6 8-6 8-2 3 0 8 2 8 6v4H8c-2 0-4-2-4-4 2 0 3-1 4-4z" />}
      {id === 'thimble' && <path {...common} d="M11 22h10l1-8c0-4-2-8-6-8s-6 4-6 8z" />}
      {id === 'cannon' && <path {...common} d="M6 16h16l2-3H8zm16 2h4v3h-4zM8 21h10a4 4 0 0 1-8 0z" />}
      {id === 'wheelbarrow' && <path {...common} d="M5 12h4l8 8H9zM20 20a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 12l-3 4" />}
    </svg>
  );
}
