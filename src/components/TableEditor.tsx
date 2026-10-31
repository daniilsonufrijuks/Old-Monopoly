import { useState } from 'react';
import { GROUP_COLOR, GROUP_ORDER, isOwnable, ownableSpaces } from '../game/board/spaces';
import { FIRM_CATALOG, MARK_KINDS, type CompanyPlate, type MarkKind } from '../game/board/plates';
import { COMPANIES, PropertyMark } from './Marks';

export function TableEditor({
  plates,
  onChange,
}: {
  plates: Record<string, CompanyPlate>;
  onChange: (plates: Record<string, CompanyPlate>) => void;
}) {
  const squares = ownableSpaces();
  const [selected, setSelected] = useState(squares[0]?.id ?? 'mediterranean');
  const [draft, setDraft] = useState<CompanyPlate>({ name: '', shortName: '', company: '', letter: 'A', kind: 'seal' });
  const space = squares.find((entry) => entry.id === selected) ?? squares[0];
  const placed = plates[selected];
  const classic = COMPANIES[selected];

  function place(plate: CompanyPlate) {
    const name = plate.name.trim().slice(0, 22);
    if (!name || !space) return;
    onChange({
      ...plates,
      [space.id]: {
        name,
        shortName: (plate.shortName.trim() || name).slice(0, 12),
        company: (plate.company.trim() || name).slice(0, 28),
        letter: (plate.letter.trim() || name[0] || 'A').slice(0, 1).toUpperCase(),
        kind: plate.kind,
      },
    });
  }

  function remove(id: string) {
    const next = { ...plates };
    delete next[id];
    onChange(next);
  }

  return (
    <div className="grid gap-3 text-sm text-ink">
      <p className="text-xs text-[#6b5434]">Place a firm on a square, or remove it to restore the classic deed. The price, rent, and color of that square stay the same.</p>
      <div className="grid max-h-52 grid-cols-2 gap-1 overflow-auto pr-1">
        {squares.map((entry) => {
          const firm = plates[entry.id];
          const swatch = entry.kind === 'street' ? GROUP_COLOR[entry.group] : entry.kind === 'railroad' ? '#4e301d' : '#1a5fb4';
          return (
            <button key={entry.id} type="button" className={`flex items-center gap-2 rounded border px-2 py-1 text-left ${entry.id === selected ? 'border-[#b8893e] bg-[#f6ead2]' : 'border-[#eadcbf]'}`} onClick={() => setSelected(entry.id)}>
              <i className="h-3 w-3 shrink-0 rounded-sm" style={{ background: swatch }} />
              <span className="min-w-0 truncate">{firm?.name ?? entry.shortName}</span>
            </button>
          );
        })}
      </div>
      {space && isOwnable(space) && (
        <div className="rounded-lg bg-[#f6ead2] p-3">
          <div className="mb-2 flex items-center gap-2">
            <PropertyMark id={space.id} plate={placed} className="h-10 w-10" />
            <div>
              <div className="font-display">{placed?.name ?? space.name}</div>
              <div className="text-xs text-[#6b5434]">{classic?.company ?? 'Classic deed'} · ${space.price}{placed ? ' · custom firm' : ''}</div>
            </div>
          </div>
          {placed && <button type="button" className="mb-2 rounded border border-[#7a1d1d] px-2 py-1 text-xs text-[#7a1d1d]" onClick={() => remove(space.id)}>Remove this firm</button>}
          <div className="mb-2 flex flex-wrap gap-1">
            {FIRM_CATALOG.map((firm) => (
              <button key={firm.name} type="button" className="rounded border border-[#c8b48a] bg-[#fffaf0] px-2 py-1 text-xs" onClick={() => place(firm)}>{firm.name}</button>
            ))}
          </div>
          <div className="grid gap-2">
            <input className="rounded border px-2 py-1" placeholder="Your company name" maxLength={22} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value, shortName: draft.shortName || event.target.value.slice(0, 12), letter: draft.letter || event.target.value.slice(0, 1).toUpperCase() })} />
            <div className="flex gap-2">
              <input className="w-28 rounded border px-2 py-1" placeholder="Short" maxLength={12} value={draft.shortName} onChange={(event) => setDraft({ ...draft, shortName: event.target.value })} />
              <input className="w-14 rounded border px-2 py-1" placeholder="A" maxLength={1} value={draft.letter} onChange={(event) => setDraft({ ...draft, letter: event.target.value.toUpperCase() })} />
              <select className="rounded border px-2 py-1" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as MarkKind })}>
                {MARK_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
            </div>
            <button type="button" className="gold-button rounded-md px-3 py-2 text-xs" onClick={() => place({ ...draft, company: draft.company || draft.name })}>Add this company</button>
          </div>
          <p className="mt-2 text-[11px] text-[#6b5434]">Color groups stay in order: {GROUP_ORDER.join(', ')}.</p>
        </div>
      )}
    </div>
  );
}
