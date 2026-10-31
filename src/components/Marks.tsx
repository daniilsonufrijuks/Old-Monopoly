export type MarkKind = 'seal' | 'anchor' | 'lamp' | 'sun' | 'crown' | 'key' | 'tree' | 'star' | 'rail' | 'bolt' | 'drop';

export interface CompanyMark {
  company: string;
  letter: string;
  kind: MarkKind;
}

export const COMPANIES: Record<string, CompanyMark> = {
  mediterranean: { company: 'Harbor & Co.', letter: 'M', kind: 'anchor' },
  baltic: { company: 'Baltic Wharf', letter: 'B', kind: 'seal' },
  reading: { company: 'Reading Line', letter: 'R', kind: 'rail' },
  oriental: { company: 'Oriental Steam', letter: 'O', kind: 'anchor' },
  vermont: { company: 'Vermont Mills', letter: 'V', kind: 'seal' },
  connecticut: { company: 'Connecticut Trust', letter: 'C', kind: 'lamp' },
  'st-charles': { company: 'St. Charles Lamp', letter: 'S', kind: 'lamp' },
  electric: { company: 'City Electric', letter: 'E', kind: 'bolt' },
  states: { company: 'States Civic', letter: 'S', kind: 'seal' },
  virginia: { company: 'Virginia Gate', letter: 'V', kind: 'lamp' },
  'pennsylvania-rr': { company: 'Penn Rail', letter: 'P', kind: 'rail' },
  'st-james': { company: 'St. James Press', letter: 'J', kind: 'sun' },
  tennessee: { company: 'Tennessee Works', letter: 'T', kind: 'sun' },
  'new-york': { company: 'New York Exchange', letter: 'N', kind: 'crown' },
  kentucky: { company: 'Kentucky Crown', letter: 'K', kind: 'crown' },
  indiana: { company: 'Indiana Foundry', letter: 'I', kind: 'sun' },
  illinois: { company: 'Illinois Central', letter: 'I', kind: 'crown' },
  bo: { company: 'B. & O. Line', letter: 'B', kind: 'rail' },
  atlantic: { company: 'Atlantic Key', letter: 'A', kind: 'key' },
  ventnor: { company: 'Ventnor Shore', letter: 'V', kind: 'key' },
  water: { company: 'Municipal Water', letter: 'W', kind: 'drop' },
  marvin: { company: 'Marvin Gardens', letter: 'M', kind: 'tree' },
  pacific: { company: 'Pacific Star', letter: 'P', kind: 'star' },
  'north-carolina': { company: 'Carolina Pine', letter: 'C', kind: 'tree' },
  pennsylvania: { company: 'Penn Avenue Co.', letter: 'P', kind: 'star' },
  'short-line': { company: 'Short Line', letter: 'S', kind: 'rail' },
  'park-place': { company: 'Park Place Club', letter: 'P', kind: 'star' },
  boardwalk: { company: 'Boardwalk Pier', letter: 'B', kind: 'crown' },
};

export function PropertyMark({ id, className }: { id: string; className?: string }) {
  const mark = COMPANIES[id];
  if (!mark) return null;
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="#fffaf0" stroke="#2a2118" strokeWidth="1.4" />
      <Glyph kind={mark.kind} />
      <text x="16" y="20.5" textAnchor="middle" fontSize="11" fontFamily="Cinzel, serif" fill="#24180f">{mark.letter}</text>
    </svg>
  );
}

function Glyph({ kind }: { kind: MarkKind }) {
  if (kind === 'rail') return <path d="M8 22h16M10 18h12M12 14h8" stroke="#7a1d1d" strokeWidth="1.4" fill="none" />;
  if (kind === 'bolt') return <path d="M18 6l-6 10h5l-2 10 8-12h-5z" fill="#c98412" />;
  if (kind === 'drop') return <path d="M16 6c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#1a5fb4" />;
  if (kind === 'anchor') return <path d="M16 7v12M12 11h8M10 19c2 4 10 4 12 0" stroke="#1a5fb4" strokeWidth="1.3" fill="none" />;
  if (kind === 'lamp') return <path d="M12 8h8l-1 6H13zM16 14v6M13 20h6" stroke="#d948a4" strokeWidth="1.2" fill="none" />;
  if (kind === 'sun') return <circle cx="16" cy="10" r="3" fill="#f7941d" />;
  if (kind === 'crown') return <path d="M8 12l4 3 4-5 4 5 4-3v6H8z" fill="#e23b32" />;
  if (kind === 'key') return <path d="M12 10a4 4 0 1 1 1 7l-1 2h3v2h-2v2H10l2-5a4 4 0 0 1 0-8z" fill="#b8860b" />;
  if (kind === 'tree') return <path d="M16 7l5 8H11zM16 12l6 8H10zM15 20h2v4h-2z" fill="#1f9d55" />;
  if (kind === 'star') return <path d="M16 5l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" fill="#1a5fb4" />;
  return <circle cx="16" cy="9" r="3" fill="none" stroke="#8B5A2B" strokeWidth="1.2" />;
}

export function TableCrest({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M40 16l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill="currentColor" />
      <text x="40" y="62" textAnchor="middle" fontSize="8" fontFamily="Cinzel, serif" fill="currentColor">EST. 1935</text>
    </svg>
  );
}
