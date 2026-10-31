export type Side = 'bottom' | 'left' | 'top' | 'right';

export function gridCell(index: number): { row: number; col: number } {
  if (index <= 10) return { row: 11, col: 11 - index };
  if (index <= 20) return { row: 11 - (index - 10), col: 1 };
  if (index <= 30) return { row: 1, col: 1 + (index - 20) };
  return { row: 1 + (index - 30), col: 11 };
}

export function sideOf(index: number): Side {
  if (index <= 10) return 'bottom';
  if (index <= 20) return 'left';
  if (index <= 30) return 'top';
  return 'right';
}

export function tokenPoint(index: number, slot: number): { x: number; y: number } {
  const { row, col } = gridCell(index);
  const start = (n: number) => (n === 1 ? 0 : 2 + (n - 2)) / 13;
  const size = (n: number) => ((n === 1 || n === 11 ? 2 : 1) / 13);
  const anchor = sideOf(index) === 'bottom'
    ? { ax: 0.5, ay: 0.68 }
    : sideOf(index) === 'top'
      ? { ax: 0.5, ay: 0.34 }
      : sideOf(index) === 'left'
        ? { ax: 0.32, ay: 0.55 }
        : { ax: 0.68, ay: 0.55 };
  const ox = ((slot % 3) - 1) * 1.3;
  const oy = (Math.floor(slot / 3) - 0.2) * 1.5;
  return {
    x: (start(col) + size(col) * anchor.ax) * 100 + ox,
    y: (start(row) + size(row) * anchor.ay) * 100 + oy,
  };
}
