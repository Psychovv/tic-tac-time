const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function result(b: string): "X" | "O" | "draw" | null {
  for (const [a, c, d] of LINES)
    if (b[a] !== "." && b[a] === b[c] && b[a] === b[d]) return b[a] as "X" | "O";
  return b.includes(".") ? null : "draw";
}

/** Casas da linha vencedora (para destacar na UI), ou null. */
export function winLine(b: string): number[] | null {
  for (const l of LINES)
    if (b[l[0]] !== "." && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return l;
  return null;
}

/* ---------- Pedra, papel e tesoura ---------- */
export type Move = "R" | "P" | "S";
export const MOVES: Move[] = ["R", "P", "S"];
export const BEST_OF = [1, 3, 5] as const;

const BEATS: Record<Move, Move> = { R: "S", S: "P", P: "R" };

/** Resultado de uma rodada: "X" (host), "O" (convidado) ou "draw". */
export function rpsRound(h: Move, g: Move): "X" | "O" | "draw" {
  if (h === g) return "draw";
  return BEATS[h] === g ? "X" : "O";
}

/** Vitorias necessarias para ganhar uma melhor de N. */
export const winsNeeded = (bestOf: number) => Math.ceil(bestOf / 2);
