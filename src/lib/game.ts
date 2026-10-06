const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function result(b: string): "X" | "O" | "draw" | null {
  for (const [a, c, d] of LINES)
    if (b[a] !== "." && b[a] === b[c] && b[a] === b[d]) return b[a] as "X" | "O";
  return b.includes(".") ? null : "draw";
}
