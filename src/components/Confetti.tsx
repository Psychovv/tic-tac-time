"use client";
import { useMemo } from "react";
import { vars } from "./Marks";

const COLORS = ["#ff9f43", "#ff6b6b", "#38bdf8", "#818cf8", "#34d399", "#fbbf24"];

// Chuva de confete em CSS puro (so roda no cliente, apos a vitoria).
export default function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 90 }, (_, i) => vars({
    "--x": `${Math.random() * 100}%`,
    "--w": `${6 + Math.random() * 6}px`,
    "--c": COLORS[i % COLORS.length],
    "--d": `${2.4 + Math.random() * 2}s`,
    "--delay": `${Math.random() * 0.8}s`,
    "--dx": `${(Math.random() - 0.5) * 240}px`,
    "--r": `${(Math.random() - 0.5) * 1440}deg`,
  })), []);
  return <div className="confetti" aria-hidden="true">{pieces.map((s, i) => <i key={i} style={s} />)}</div>;
}
