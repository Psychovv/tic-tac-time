"use client";
import { winLine } from "@/lib/game";
import { OMark, XMark, vars } from "./Marks";

type Props = { board: string; you: "X" | "O" | null; canPlay: boolean; onPlay: (i: number) => void };

// Centro de cada casa num viewBox 300x300 (usado para desenhar a linha da vitoria).
const center = (i: number) => [(i % 3) * 100 + 50, Math.floor(i / 3) * 100 + 50];

export default function Board({ board, you, canPlay, onPlay }: Props) {
  const line = winLine(board);
  const wsym = line ? board[line[0]] : null;
  let seg: number[] | null = null;
  if (line) {
    const [x1, y1] = center(line[0]);
    const [x2, y2] = center(line[2]);
    const ex = (x2 - x1) * 0.18, ey = (y2 - y1) * 0.18; // estende um pouco alem das casas
    seg = [x1 - ex, y1 - ey, x2 + ex, y2 + ey];
  }

  return (
    <div role="group" aria-label="Tabuleiro" className={`board${canPlay ? " my-turn" : ""}`}
      style={wsym ? vars({ "--wc": wsym === "X" ? "var(--x)" : "var(--o)" }) : undefined}>
      {[...board].map((v, i) => {
        const win = line?.includes(i);
        return (
          <button key={i} style={vars({ "--i": i })}
            className={`cell${win ? " win" : ""}${line && !win ? " dim" : ""}`}
            disabled={!canPlay || v !== "."} onClick={() => onPlay(i)}
            aria-label={`Casa ${i + 1}: ${v === "." ? "vazia" : v}`}>
            {v === "X" && <XMark className="draw" />}
            {v === "O" && <OMark className="draw" />}
            {v === "." && canPlay && you && <span className="ghost">{you === "X" ? <XMark /> : <OMark />}</span>}
          </button>
        );
      })}
      {seg && (
        <svg className="winline" viewBox="0 0 300 300" aria-hidden="true">
          <line x1={seg[0]} y1={seg[1]} x2={seg[2]} y2={seg[3]} pathLength={1} />
        </svg>
      )}
    </div>
  );
}
