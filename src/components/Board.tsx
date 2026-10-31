import { motion } from 'framer-motion';
import { GROUP_COLOR, GROUP_IDS, isOwnable, spaceById, type SpaceDef } from '../game/board/spaces';
import { SPACES } from '../game/board/spaces';
import type { GameState } from '../game/types';
import { PropertyMark } from './Marks';
import { modeById } from '../game/modes';
import { TOKENS, TokenGlyph } from './Tokens';
import { gridCell, sideOf, tokenPoint } from './geometry';

const PIPS: Record<number, string[]> = {
  1: ['pip-1'],
  2: ['pip-2a', 'pip-2b'],
  3: ['pip-2a', 'pip-3', 'pip-2b'],
  4: ['pip-4a', 'pip-4b', 'pip-4c', 'pip-4d'],
  5: ['pip-4a', 'pip-4b', 'pip-5', 'pip-4c', 'pip-4d'],
  6: ['pip-4a', 'pip-4b', 'pip-6a', 'pip-6b', 'pip-4c', 'pip-4d'],
};

export function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div className={`die ${rolling ? 'rolling' : ''}`} aria-label={`Die showing ${value || 'nothing'}`}>
      {(PIPS[value] ?? []).map((pip) => <span key={pip} className={pip} />)}
    </div>
  );
}

function SpaceCell({ space, state, onSelect }: { space: SpaceDef; state: GameState; onSelect: (id: string) => void }) {
  const side = sideOf(space.index);
  const owned = isOwnable(space) ? state.properties[space.id] : undefined;
  const owner = owned?.ownerId ? state.players.find((player) => player.id === owned.ownerId) : undefined;
  const metal = owner ? TOKENS.find((token) => token.id === owner.token)?.metal : undefined;
  const color = space.kind === 'street' ? GROUP_COLOR[space.group] : undefined;
  return (
    <button
      type="button"
      className={`space ${side} ${space.index % 10 === 0 ? 'corner' : ''} ${owner ? 'owned' : ''}`}
      style={{ ...gridCellStyle(space.index), ['--group' as string]: color, ['--owner' as string]: metal }}
      onClick={() => onSelect(space.id)}
    >
      {color && <i className="bar" />}
      <PropertyMark id={space.id} className="mark" />
      <span className="label">{space.kind === 'go' ? `GO +$${state.rules.goSalary}` : space.shortName}</span>
      {doubledRent(state, space) && <span className="set-flag">×2</span>}
      {owned && owned.houses > 0 && <span key={`${space.id}-${owned.houses}`} className="houses">{owned.houses === 5 ? 'HOTEL' : '●'.repeat(owned.houses)}</span>}
      {isOwnable(space) && !owned?.ownerId && <span className="price">${space.price}</span>}
      {owned?.mortgaged && <span className="price">MORT</span>}
    </button>
  );
}

function gridCellStyle(index: number): { gridRow: number; gridColumn: number } {
  const cell = gridCell(index);
  return { gridRow: cell.row, gridColumn: cell.col };
}

export function Board({
  state,
  positions,
  dice,
  rolling,
  notice,
  onSelect,
}: {
  state: GameState;
  positions: Record<string, number>;
  dice: [number, number] | null;
  rolling: boolean;
  notice: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="board">
      {SPACES.map((space) => <SpaceCell key={space.id} space={space} state={state} onSelect={onSelect} />)}
      <div className="board-center">
        <div className="board-medallion" aria-hidden="true" />
        <div className="board-title font-display text-4xl tracking-[0.2em]">MONOPOLY</div>
        <div className="board-sub font-deed text-xs uppercase tracking-[0.28em]">{modeById(state.rules.modeId ?? 'classic').name} table</div>
        <div className="flex gap-3 pointer-events-none">
          <Die value={dice?.[0] ?? 0} rolling={rolling} />
          <Die value={dice?.[1] ?? 0} rolling={rolling} />
        </div>
        <p className="board-sub max-w-[240px] text-center font-deed text-sm">{notice}</p>
        {state.rules.freeParkingPot && <p className="board-sub font-deed text-xs">Free Parking ${state.freeParking}</p>}
      </div>
      {state.players.map((player, index) => {
        const point = tokenPoint(positions[player.id] ?? player.position, index);
        const metal = TOKENS.find((token) => token.id === player.token)?.metal ?? '#ddd';
        if (player.bankrupt) return null;
        return (
          <motion.div
            key={player.id}
            className={`token ${player.id === state.players[state.currentPlayerIndex]?.id ? 'current' : ''}`}
            style={{ ['--metal' as string]: metal }}
            animate={{ left: `${point.x}%`, top: `${point.y}%` }}
            transition={{ duration: rolling ? 0.05 : 0.18 }}
            title={player.name}
          >
            <TokenGlyph id={player.token} metal={metal} />
          </motion.div>
        );
      })}
    </div>
  );
}

function doubledRent(state: GameState, space: SpaceDef): boolean {
  if (space.kind !== 'street') return false;
  const owned = state.properties[space.id];
  if (!owned?.ownerId || owned.mortgaged || owned.houses > 0) return false;
  return GROUP_IDS[space.group].every((id) => {
    const prop = state.properties[id];
    return prop.ownerId === owned.ownerId && !prop.mortgaged && prop.houses === 0;
  });
}

export function spaceTitle(id: string): string {
  return spaceById(id).name;
}
