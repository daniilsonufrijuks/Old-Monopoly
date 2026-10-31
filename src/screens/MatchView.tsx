import { useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_COLOR, spaceById } from '../game/board/spaces';
import { isOwnable } from '../game/board/spaces';
import { actingPlayerId } from '../game/engine/TurnManager';
import { canBuild, canMortgage, canSellBuilding, canUnmortgage, housePrice, netWorth } from '../game/rules/building';
import { describeRules } from '../game/modes';
import { COMPANIES, PropertyMark } from '../components/Marks';
import type { GameAction, GameState } from '../game/types';
import { t } from '../i18n';
import { useSettings } from '../settings/SettingsContext';
import { Board } from '../components/Board';
import { TOKENS, TokenGlyph } from '../components/Tokens';

function money(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

export function MatchView({
  state,
  youId,
  positions,
  dice,
  rolling,
  card,
  busy,
  error,
  note,
  canSave,
  onAction,
  onSave,
  onLeave,
  onDismissCard,
  messages,
  onChat,
}: {
  state: GameState;
  youId: string;
  positions: Record<string, number>;
  dice: [number, number] | null;
  rolling: boolean;
  card: string | null;
  busy: boolean;
  error: string;
  note: string;
  canSave: boolean;
  onAction: (action: GameAction) => void;
  onSave: () => void;
  onLeave: () => void;
  onDismissCard?: () => void;
  messages?: Array<{ name: string; text: string }>;
  onChat?: (text: string) => void;
}) {
  const { settings } = useSettings();
  const tr = (key: string) => t(settings.language, key);
  const [deed, setDeed] = useState<string | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [books, setBooks] = useState(false);
  const [history, setHistory] = useState(false);
  const [chatText, setChatText] = useState('');
  const [localChat, setLocalChat] = useState<Array<{ name: string; text: string }>>([]);
  const [clock, setClock] = useState(Date.now());
  const auctionSent = useRef(false);
  const [bid, setBid] = useState(10);
  const actor = actingPlayerId(state);
  const yours = actor === youId && !busy && state.phase.kind !== 'ended';
  const you = state.players.find((player) => player.id === youId);
  const current = state.players[state.currentPlayerIndex];
  const owned = useMemo(() => Object.values(state.properties).filter((prop) => prop.ownerId === youId), [state.properties, youId]);

  useEffect(() => {
    const onMenu = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === 'roll' && yours && state.phase.kind === 'pre-roll') onAction({ type: 'roll' });
      if (action === 'end-turn' && yours && state.phase.kind === 'manage') onAction({ type: 'end-turn' });
      if (action === 'save') onSave();
    };
    window.addEventListener('monopoly-menu', onMenu);
    return () => window.removeEventListener('monopoly-menu', onMenu);
  }, [onAction, onSave, state.phase.kind, yours]);

  useEffect(() => {
    if (state.phase.kind !== 'auction') {
      auctionSent.current = false;
      return;
    }
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase.kind !== 'auction' || !state.phase.deadline || auctionSent.current) return;
    if (Date.now() + 200 < state.phase.deadline) return;
    auctionSent.current = true;
    onAction({ type: 'auction-close' });
  }, [clock, onAction, state.phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.code === 'Space' && yours && state.phase.kind === 'pre-roll') {
        event.preventDefault();
        onAction({ type: 'roll' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAction, state.phase.kind, yours]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <header className="wood-panel flex items-center justify-between rounded-xl px-4 py-2 text-cream">
        <div>
          <div className="menu-ink font-display text-lg tracking-[0.14em]">Classic Monopoly</div>
          <div className="menu-soft text-sm">{current?.name}'s turn · Turn {state.turn}{state.rules.turnLimit ? ` / ${state.rules.turnLimit}` : ''} · {note}</div>
          <div className="menu-soft text-xs">{describeRules(state.rules)}</div>
        </div>
        <div className="flex gap-2">
          {canSave && <button className="gold-button rounded-md px-3 py-1 text-xs" onClick={onSave}>Save</button>}
          <button className="rounded-md border border-[#e7d3a4] px-3 py-1 text-xs" onClick={onLeave}>Leave table</button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[230px_minmax(0,1fr)_300px] gap-3">
        <aside className="space-y-2 overflow-auto pr-1">
          {state.players.map((player) => {
            const active = player.id === current?.id && state.phase.kind !== 'ended';
            const metal = TOKENS.find((token) => token.id === player.token)?.metal;
            return (
              <article key={player.id} className={`paper-panel rounded-lg p-3 ${active ? 'outline outline-2 outline-[#b8893e]' : ''} ${player.bankrupt ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full border border-[#2a2118]" style={{ background: metal }}><TokenGlyph id={player.token} /></span>
                  <div>
                    <div className="font-display text-sm">{player.name}</div>
                    <div className="paper-muted text-xs">{player.isAI ? `${player.difficulty} ${player.personality}` : player.id === youId ? 'You' : 'Human'}{!player.connected && !player.isAI ? ' · away' : ''}</div>
                  </div>
                </div>
                <div className="mt-2 font-deed text-lg">{player.bankrupt ? 'Bankrupt' : money(player.cash)}</div>
                <div className="paper-muted text-xs">Worth {player.bankrupt ? '—' : money(netWorth(state, player.id))}</div>
                <div className="paper-muted text-xs">
                  {player.inJail ? `In jail · try ${player.jailTurns}` : `Space ${player.position}`}
                  {player.getOutCards.length ? ` · ${player.getOutCards.length} jail card` : ''}
                </div>
              </article>
            );
          })}
        </aside>
        <div className="min-h-0">
          <Board state={state} positions={positions} dice={dice} rolling={rolling} notice={card ?? state.log.at(-1)?.message ?? 'Roll to begin.'} onSelect={setDeed} />
        </div>
        <aside className="paper-panel flex min-h-0 flex-col rounded-xl p-3">
          <h2 className="font-display text-sm tracking-[0.14em]">THE TABLE</h2>
          {error && <p className="mt-2 rounded bg-[#f8d7d2] px-2 py-1 text-sm">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {state.phase.kind === 'pre-roll' && <Action label={you?.inJail ? tr('rollJail') : tr('roll')} disabled={!yours} onClick={() => onAction({ type: 'roll' })} />}
            {state.phase.kind === 'pre-roll' && you?.inJail && <Action label="Pay $50" disabled={!yours || (you?.cash ?? 0) < 50} onClick={() => onAction({ type: 'pay-jail' })} />}
            {state.phase.kind === 'pre-roll' && you?.inJail && <Action label="Use jail card" disabled={!yours || !you?.getOutCards.length} onClick={() => onAction({ type: 'use-jail-card' })} />}
            {state.phase.kind === 'buy' && <Action label={`Buy ${money(priceOf(state.phase.propertyId))}`} disabled={!yours} onClick={() => onAction({ type: 'buy' })} />}
            {state.phase.kind === 'buy' && <Action label={state.rules.auctions ? tr('declineAuction') : tr('decline')} disabled={!yours} onClick={() => onAction({ type: 'decline' })} />}
            {state.phase.kind === 'income-tax' && <Action label={`Pay ${money(state.rules.incomeTax)}`} disabled={!yours} onClick={() => onAction({ type: 'pay-tax', method: 'flat' })} />}
            {state.phase.kind === 'income-tax' && you && <Action label={`Pay 10% (${money(Math.floor(netWorth(state, you.id) * 0.1))})`} disabled={!yours} onClick={() => onAction({ type: 'pay-tax', method: 'percent' })} />}
            {state.phase.kind === 'manage' && <Action label={tr('endTurn')} disabled={!yours} onClick={() => onAction({ type: 'end-turn' })} />}
            {(state.phase.kind === 'manage' || state.phase.kind === 'pre-roll') && <Action label={tr('trade')} disabled={!yours} onClick={() => setTradeOpen(true)} />}
            {state.phase.kind === 'debt' && state.phase.debtorId === youId && <Action label={`Pay ${money(state.phase.amount)}`} disabled={busy || (you?.cash ?? 0) < state.phase.amount} onClick={() => onAction({ type: 'settle-debt' })} />}
            {state.phase.kind === 'debt' && state.phase.debtorId === youId && <Action label={tr('bankrupt')} disabled={busy} onClick={() => onAction({ type: 'declare-bankruptcy' })} />}
            {state.phase.kind === 'trade' && state.phase.offer.toId === youId && <Action label={tr('accept')} disabled={busy} onClick={() => onAction({ type: 'accept-trade' })} />}
            {state.phase.kind === 'trade' && state.phase.offer.toId === youId && <Action label={tr('counter')} disabled={busy} onClick={() => setCounterOpen(true)} />}
            {state.phase.kind === 'trade' && state.phase.offer.toId === youId && <Action label={tr('reject')} disabled={busy} onClick={() => onAction({ type: 'reject-trade' })} />}
            {state.phase.kind === 'trade' && state.phase.offer.fromId === youId && <Action label={tr('cancel')} disabled={busy} onClick={() => onAction({ type: 'cancel-trade' })} />}
          </div>
          {state.phase.kind === 'auction' && (
            <div className="mt-3 rounded-lg bg-[#f6ead2] p-2 text-sm text-ink">
              <div>{tr('auction')}: {spaceById(state.phase.propertyId).name}</div>
              <div>{tr('highBid')} {money(state.phase.highBid)} {state.phase.highBidderId ? `· ${nameOf(state, state.phase.highBidderId)}` : ''}</div>
              <div>{tr('bidding')}{state.phase.deadline ? ` · ${Math.max(0, Math.ceil((state.phase.deadline - clock) / 1000))} ${tr('seconds')}` : ''}</div>
              {!state.phase.passed.includes(youId) && !busy && (
                <div className="mt-2 flex gap-2">
                  <input className="w-20 rounded border px-2" type="number" min={state.phase.highBid + 1} value={bid} onChange={(event) => setBid(Number(event.target.value))} />
                  <Action label={tr('bid')} onClick={() => onAction({ type: 'auction-bid', amount: bid })} />
                  <Action label={tr('pass')} onClick={() => onAction({ type: 'auction-pass' })} />
                </div>
              )}
            </div>
          )}
          {state.phase.kind === 'trade' && (
            <p className="mt-3 text-sm">
              {nameOf(state, state.phase.offer.fromId)} offers {money(state.phase.offer.offerCash)} and {state.phase.offer.offerProperties.length} deeds for {money(state.phase.offer.requestCash)} and {state.phase.offer.requestProperties.length} deeds.
            </p>
          )}
          <div className="mt-3 min-h-0 flex-1 overflow-auto text-sm">
            {owned.map((prop) => {
              const space = spaceById(prop.id);
              const build = canBuild(state, youId, prop.id);
              const sell = canSellBuilding(state, youId, prop.id);
              const mortgage = prop.mortgaged ? canUnmortgage(state, youId, prop.id) : canMortgage(state, youId, prop.id);
              const managing = yours && (state.phase.kind === 'pre-roll' || state.phase.kind === 'manage' || state.phase.kind === 'buy' || state.phase.kind === 'debt' || state.phase.kind === 'income-tax');
              return (
                <div key={prop.id} className="mb-2 border-b border-[#eadcbf] pb-2">
                  <button className="text-left font-deed" onClick={() => setDeed(prop.id)}>{space.name}</button>
                  <div className="text-xs text-[#6b5434]">{prop.mortgaged ? 'Mortgaged' : prop.houses === 5 ? 'Hotel' : prop.houses ? `${prop.houses} houses` : 'Undeveloped'}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {space.kind === 'street' && !prop.mortgaged && <Tiny label="House" title={build ?? 'Build'} disabled={!managing || Boolean(build) || state.phase.kind === 'debt' || state.phase.kind === 'buy'} onClick={() => onAction({ type: 'build', propertyId: prop.id })} />}
                    {space.kind === 'street' && prop.houses > 0 && <Tiny label="Sell" title={sell ?? 'Sell'} disabled={!managing || Boolean(sell)} onClick={() => onAction({ type: 'sell-building', propertyId: prop.id })} />}
                    <Tiny label={prop.mortgaged ? 'Lift' : 'Mortgage'} title={mortgage ?? ''} disabled={!managing || Boolean(mortgage) || (prop.mortgaged && state.phase.kind === 'debt')} onClick={() => onAction(prop.mortgaged ? { type: 'unmortgage', propertyId: prop.id } : { type: 'mortgage', propertyId: prop.id })} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <Tiny label={tr('dashboard')} onClick={() => setBooks((value) => !value)} />
            <Tiny label={tr('history')} onClick={() => setHistory((value) => !value)} />
          </div>
          {books && you && <Books state={state} youId={youId} tr={tr} />}
          <div className="mt-2 max-h-36 overflow-auto border-t border-[#eadcbf] pt-2 text-xs">
            {(history ? [...state.log].reverse() : [...state.log].slice(-12).reverse()).map((entry) => <p key={entry.id} className="mb-1">#{entry.turn} {entry.message}</p>)}
          </div>
          <Chat lines={messages ?? localChat} text={chatText} tr={tr} onText={setChatText} onSend={(text) => {
            if (onChat) onChat(text);
            else setLocalChat((current) => [...current, { name: you?.name ?? 'You', text }].slice(-30));
            setChatText('');
          }} />
        </aside>
      </div>
      {deed && <Deed state={state} propertyId={deed} onClose={() => setDeed(null)} />}
      {tradeOpen && you && <Trade state={state} youId={youId} onClose={() => setTradeOpen(false)} onOffer={(action) => { setTradeOpen(false); onAction(action); }} />}
      {counterOpen && state.phase.kind === 'trade' && <Trade state={state} youId={youId} counter onClose={() => setCounterOpen(false)} onOffer={(action) => { setCounterOpen(false); onAction(action); }} />}
      {card && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30">
          <article className="paper-panel max-w-md rounded-xl p-6 text-center font-deed text-xl">
            {card}
            <div><button className="gold-button mt-4 rounded-md px-4 py-2 text-xs" onClick={onDismissCard}>{tr('ok')}</button></div>
          </article>
        </div>
      )}
      {state.phase.kind === 'ended' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
          <article className="paper-panel max-w-md rounded-xl p-8 text-center">
            <h2 className="font-display text-3xl">{nameOf(state, state.phase.winnerId)} wins</h2>
            <p className="mt-2">{state.phase.reason === 'limit' ? 'The clock ran out. The richest player takes the table.' : 'The last player left at the table takes the game.'}</p>
            <button className="gold-button mt-4 rounded-md px-4 py-2" onClick={onLeave}>Back to the menu</button>
          </article>
        </div>
      )}
    </div>
  );
}

function Action({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button className="gold-button rounded-md px-3 py-2 text-xs" disabled={disabled} onClick={onClick}>{label}</button>;
}

function Tiny({ label, onClick, disabled, title }: { label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return <button className="rounded border border-[#c8b48a] px-2 py-0.5 text-[11px] disabled:opacity-40" title={title} disabled={disabled} onClick={onClick}>{label}</button>;
}

function priceOf(id: string): number {
  const space = spaceById(id);
  return isOwnable(space) ? space.price : 0;
}

function nameOf(state: GameState, id: string): string {
  return state.players.find((player) => player.id === id)?.name ?? 'Bank';
}

function Deed({ state, propertyId, onClose }: { state: GameState; propertyId: string; onClose: () => void }) {
  const space = spaceById(propertyId);
  const prop = state.properties[propertyId];
  const owner = prop?.ownerId ? nameOf(state, prop.ownerId) : 'Bank';
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <article className="paper-panel w-full max-w-sm rounded-xl p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <PropertyMark id={propertyId} className="h-14 w-14 shrink-0" />
          <div>
            {space.kind === 'street' && <div className="mb-2 h-3 rounded" style={{ background: GROUP_COLOR[space.group] }} />}
            <h3 className="font-display text-xl">{space.name}</h3>
            {COMPANIES[propertyId] && <p className="paper-muted text-xs uppercase tracking-[0.14em]">{COMPANIES[propertyId].company}</p>}
          </div>
        </div>
        <p className="paper-muted text-sm">Owner: {owner}{prop?.mortgaged ? ' · mortgaged' : ''}</p>
        {isOwnable(space) && <p className="mt-2">Price {money(space.price)} · Mortgage {money(space.mortgage)}</p>}
        {space.kind === 'street' && (
          <ul className="mt-3 space-y-1 font-deed text-sm">
            {['Rent', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel'].map((label, index) => (
              <li key={label} className="flex justify-between"><span>{label}</span><span>{money(space.rent[index])}</span></li>
            ))}
            <li className="flex justify-between"><span>House</span><span>{money(housePrice(state, space.houseCost))}</span></li>
          </ul>
        )}
        {space.kind === 'railroad' && <p className="mt-3 font-deed text-sm">Rent is $25, $50, $100, or $200 for 1–4 railroads.</p>}
        {space.kind === 'utility' && <p className="mt-3 font-deed text-sm">Rent is 4× the dice if one utility is owned, or 10× if both are owned.</p>}
        <button className="gold-button mt-4 rounded-md px-3 py-2 text-xs" onClick={onClose}>Close</button>
      </article>
    </div>
  );
}

function Books({ state, youId, tr }: { state: GameState; youId: string; tr: (key: string) => string }) {
  const you = state.players.find((player) => player.id === youId);
  let deeds = 0;
  let mortgages = 0;
  for (const prop of Object.values(state.properties)) {
    if (prop.ownerId !== youId) continue;
    const space = spaceById(prop.id);
    if (space.kind !== 'street' && space.kind !== 'railroad' && space.kind !== 'utility') continue;
    if (prop.mortgaged) mortgages += space.mortgage;
    else deeds += space.price;
  }
  const cash = you?.cash ?? 0;
  const risk = cash < 150 ? 'danger' : cash < 400 ? 'watch' : 'safe';
  return (
    <div className="mt-2 rounded-lg bg-[#f6ead2] p-2 text-xs text-ink">
      <div>{tr('worth')} {money(netWorth(state, youId))}</div>
      <div>{tr('portfolio')} {money(deeds)}</div>
      <div>{tr('mortgages')} {money(mortgages)}</div>
      <div>{tr('rentIn')} {money(you?.rentIn ?? 0)} · {tr('rentOut')} {money(you?.rentOut ?? 0)}</div>
      <div>{tr('risk')}: {tr(risk)}</div>
    </div>
  );
}

function Chat({ lines, text, tr, onText, onSend }: { lines: Array<{ name: string; text: string }>; text: string; tr: (key: string) => string; onText: (value: string) => void; onSend: (text: string) => void }) {
  const quick = ['Nice roll', 'Your turn', 'Trade?', 'Ouch', '👍', '🎲'];
  return (
    <div className="mt-2 border-t border-[#eadcbf] pt-2 text-xs">
      <div className="font-display">{tr('chat')}</div>
      <div className="max-h-20 overflow-auto">
        {lines.slice(-8).map((line, index) => <p key={`${line.name}-${index}`}>{line.name}: {line.text}</p>)}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {quick.map((line) => <button key={line} className="rounded border px-1" onClick={() => onSend(line)}>{line}</button>)}
      </div>
      <form className="mt-1 flex gap-1" onSubmit={(event) => { event.preventDefault(); if (text.trim()) onSend(text.trim()); }}>
        <input className="min-w-0 flex-1 rounded border px-1" maxLength={80} value={text} onChange={(event) => onText(event.target.value)} />
        <button className="gold-button rounded px-2 text-[11px]">{tr('send')}</button>
      </form>
    </div>
  );
}

function Trade({ state, youId, counter, onClose, onOffer }: { state: GameState; youId: string; counter?: boolean; onClose: () => void; onOffer: (action: GameAction) => void }) {
  const others = state.players.filter((player) => player.id !== youId && !player.bankrupt);
  const partner = counter && state.phase.kind === 'trade' ? state.phase.offer.fromId : others[0]?.id ?? '';
  const [toId, setToId] = useState(partner);
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerProperties, setOfferProperties] = useState<string[]>([]);
  const [requestProperties, setRequestProperties] = useState<string[]>([]);
  const [rentShareTurns, setRentShareTurns] = useState(0);
  const mine = Object.values(state.properties).filter((prop) => prop.ownerId === youId && prop.houses === 0);
  const theirs = Object.values(state.properties).filter((prop) => prop.ownerId === toId && prop.houses === 0);
  const toggle = (list: string[], id: string, set: (ids: string[]) => void) => set(list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <article className="paper-panel max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl p-5">
        <h3 className="font-display text-xl">Offer a trade</h3>
        <label className="mt-3 block text-sm">With
          <select className="ml-2 rounded border px-2 py-1" value={toId} onChange={(event) => { setToId(event.target.value); setRequestProperties([]); }}>
            {others.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <label>Your cash <input className="w-full rounded border px-2" type="number" min={0} value={offerCash} onChange={(event) => setOfferCash(Number(event.target.value))} /></label>
          <label>Their cash <input className="w-full rounded border px-2" type="number" min={0} value={requestCash} onChange={(event) => setRequestCash(Number(event.target.value))} /></label>
          <label className="col-span-2">Future rent, half of the next collections
            <input className="ml-2 w-16 rounded border px-2" type="number" min={0} max={6} value={rentShareTurns} onChange={(event) => setRentShareTurns(Number(event.target.value))} />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="font-display text-xs">You give</div>
            {mine.map((prop) => <label key={prop.id} className="block"><input type="checkbox" checked={offerProperties.includes(prop.id)} onChange={() => toggle(offerProperties, prop.id, setOfferProperties)} /> {spaceById(prop.id).name}</label>)}
          </div>
          <div>
            <div className="font-display text-xs">You receive</div>
            {theirs.map((prop) => <label key={prop.id} className="block"><input type="checkbox" checked={requestProperties.includes(prop.id)} onChange={() => toggle(requestProperties, prop.id, setRequestProperties)} /> {spaceById(prop.id).name}</label>)}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="gold-button rounded-md px-3 py-2 text-xs" onClick={() => onOffer({ type: counter ? 'counter-trade' : 'propose-trade', toId, offerCash, requestCash, offerProperties, requestProperties, offerCards: 0, requestCards: 0, rentShareTurns })}>Send offer</button>
          <button className="rounded-md border px-3 py-2 text-xs" onClick={onClose}>Cancel</button>
        </div>
      </article>
    </div>
  );
}
