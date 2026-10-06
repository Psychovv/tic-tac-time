// Marcas X / O em SVG. Com className="draw" elas se "desenham" ao montar (ver globals.css).
// Os gradientes #gx / #go sao definidos uma vez em layout.tsx.
type P = { className?: string };

export function XMark({ className = "" }: P) {
  return (
    <svg viewBox="0 0 100 100" className={`mark mark-x ${className}`} aria-hidden="true">
      <line x1="24" y1="24" x2="76" y2="76" pathLength={1} />
      <line x1="76" y1="24" x2="24" y2="76" pathLength={1} />
    </svg>
  );
}

export function OMark({ className = "" }: P) {
  return (
    <svg viewBox="0 0 100 100" className={`mark mark-o ${className}`} aria-hidden="true">
      <circle cx="50" cy="50" r="27" pathLength={1} transform="rotate(-90 50 50)" />
    </svg>
  );
}

export function Logo({ className = "" }: P) {
  return (
    <span className={`logo ${className}`} aria-hidden="true">
      <XMark />
      <OMark />
    </span>
  );
}

/** Permite passar CSS custom properties (--x) no style sem brigar com o TS. */
export const vars = (o: Record<string, string | number>) => o as React.CSSProperties;
