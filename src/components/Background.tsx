import { OMark, XMark, vars } from "./Marks";

// Fundo animado: grade em movimento + X/O flutuando. Posicoes fixas (sem random) para nao quebrar a hidratacao.
const SHAPES = [
  { t: "x", x: "5%", y: "16%", s: 90, d: 14, delay: 0 },
  { t: "o", x: "86%", y: "12%", s: 120, d: 18, delay: -4 },
  { t: "o", x: "10%", y: "74%", s: 70, d: 16, delay: -8 },
  { t: "x", x: "80%", y: "70%", s: 100, d: 20, delay: -2 },
  { t: "x", x: "46%", y: "90%", s: 56, d: 15, delay: -6 },
  { t: "o", x: "55%", y: "6%", s: 48, d: 13, delay: -10 },
];

export default function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-grid" />
      {SHAPES.map((s, i) => (
        <div key={i} className="bg-shape"
          style={vars({ left: s.x, top: s.y, "--s": `${s.s}px`, "--d": `${s.d}s`, "--delay": `${s.delay}s` })}>
          {s.t === "x" ? <XMark /> : <OMark />}
        </div>
      ))}
    </div>
  );
}
