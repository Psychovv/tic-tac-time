/** Batalha naval 8×8 — frota curta pro setor. */

export const SIZE = 8;
export const CELLS = SIZE * SIZE;
export const FLEET = [4, 3, 2, 2] as const;
export const COLS = "ABCDEFGH";

export type Ship = { len: number; cells: number[] };
export type Shots = { host: number[]; guest: number[] };
export type ShotView = { cell: number; hit: boolean; sunk: boolean };

export const emptyShots = (): Shots => ({ host: [], guest: [] });

export function parseFleet(raw: string | null): Ship[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as Ship[]) : null;
  } catch {
    return null;
  }
}

export function parseShots(raw: string | null): Shots {
  if (!raw) return emptyShots();
  try {
    const v = JSON.parse(raw);
    return {
      host: Array.isArray(v?.host) ? v.host.map(Number) : [],
      guest: Array.isArray(v?.guest) ? v.guest.map(Number) : [],
    };
  } catch {
    return emptyShots();
  }
}

function sortedEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** Verifica se `cells` forma um segmento ortogonal contíguo do tamanho esperado. */
function isStraight(cells: number[], len: number): boolean {
  if (cells.length !== len) return false;
  if (new Set(cells).size !== len) return false;
  for (const c of cells) {
    if (!Number.isInteger(c) || c < 0 || c >= CELLS) return false;
  }
  const sorted = [...cells].sort((a, b) => a - b);
  const rows = sorted.map((c) => Math.floor(c / SIZE));
  const cols = sorted.map((c) => c % SIZE);
  const sameRow = rows.every((r) => r === rows[0]);
  const sameCol = cols.every((c) => c === cols[0]);
  if (sameRow) {
    for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return false;
    return true;
  }
  if (sameCol) {
    for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + SIZE) return false;
    return true;
  }
  return false;
}

/** Valida frota completa: tamanhos FLEET, bounds, contiguidade, sem overlap. */
export function validateFleet(ships: unknown): ships is Ship[] {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;
  const lengths = ships.map((s) => (s && typeof s === "object" ? Number((s as Ship).len) : NaN));
  if (!sortedEqual(lengths, [...FLEET])) return false;

  const used = new Set<number>();
  for (const s of ships as Ship[]) {
    if (!s || typeof s !== "object") return false;
    if (!Array.isArray(s.cells) || !isStraight(s.cells.map(Number), s.len)) return false;
    for (const c of s.cells) {
      if (used.has(c)) return false;
      used.add(c);
    }
  }
  return true;
}

export function fleetCells(fleet: Ship[]): Set<number> {
  const set = new Set<number>();
  for (const s of fleet) for (const c of s.cells) set.add(c);
  return set;
}

export function cellHit(fleet: Ship[], cell: number): boolean {
  return fleetCells(fleet).has(cell);
}

/** Navio que contém `cell`, ou null. */
export function shipAt(fleet: Ship[], cell: number): Ship | null {
  return fleet.find((s) => s.cells.includes(cell)) ?? null;
}

export function shipSunk(ship: Ship, shots: number[]): boolean {
  return ship.cells.every((c) => shots.includes(c));
}

export function allSunk(fleet: Ship[], shots: number[]): boolean {
  return fleet.every((s) => shipSunk(s, shots));
}

/** Monta a visão pública dos tiros de um jogador sobre a frota inimiga. */
export function shotViews(fleet: Ship[], shots: number[]): ShotView[] {
  return shots.map((cell) => {
    const ship = shipAt(fleet, cell);
    const hit = Boolean(ship);
    return { cell, hit, sunk: hit && ship ? shipSunk(ship, shots) : false };
  });
}

export function cellLabel(i: number): string {
  return `${COLS[i % SIZE]}${Math.floor(i / SIZE) + 1}`;
}
