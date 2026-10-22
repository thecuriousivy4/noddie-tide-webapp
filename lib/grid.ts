// The map grid: 12 columns (A..L) by 8 rows (1..8).
// A cell id is column letter + row number, e.g. "E4".
// Coordinate space: column letter index is x in [i, i+1]; row r is y in [r-1, r].

export const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
export const ROWS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type CellId = string;

export function allCells(): CellId[] {
  const cells: CellId[] = [];
  for (const r of ROWS) for (const c of COLS) cells.push(`${c}${r}`);
  return cells;
}

export function isValidCell(id: string): boolean {
  const m = /^([A-L])([1-8])$/.exec(id);
  return m !== null;
}

/** Column index (A -> 0) and zero-based row index (row 1 -> 0). */
export function cellToIndex(id: CellId): { col: number; row: number } {
  const m = /^([A-L])([1-8])$/.exec(id);
  if (!m) throw new Error(`Invalid cell id: ${id}`);
  return { col: COLS.indexOf(m[1] as (typeof COLS)[number]), row: Number(m[2]) - 1 };
}

/** Top-left grid coordinate of a cell, in grid units. */
export function cellOrigin(id: CellId): { x: number; y: number } {
  const { col, row } = cellToIndex(id);
  return { x: col, y: row };
}

/** Intersection of two cell sets, preserving the order of `a`. */
export function cellOverlap(a: CellId[], b: CellId[]): CellId[] {
  const set = new Set(b);
  return a.filter((c) => set.has(c));
}
