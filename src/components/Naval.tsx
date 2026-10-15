"use client";
import { useEffect, useMemo, useState } from "react";
import Confetti from "./Confetti";
import { COLS, FLEET, SIZE, type Ship, type ShotView } from "@/lib/naval";

/* eslint-disable @typescript-eslint/no-explicit-any */

function Dots() {
  return <span className="dots" aria-hidden="true"><span /><span /><span /></span>;
}

function shipCells(start: number, len: number, horizontal: boolean): number[] | null {
  const cells: number[] = [];
  const row = Math.floor(start / SIZE);
  const col = start % SIZE;
  for (let i = 0; i < len; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    cells.push(r * SIZE + c);
  }
  return cells;
}

function overlaps(fleet: Ship[], cells: number[], skipIdx?: number): boolean {
  const used = new Set<number>();
  fleet.forEach((s, i) => {
    if (i === skipIdx) return;
    for (const c of s.cells) used.add(c);
  });
  return cells.some((c) => used.has(c));
}

function GridShell({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div className={`naval-grid${className ? ` ${className}` : ""}`} role="grid" aria-label={label}>
      <div className="naval-corner" />
      {COLS.split("").map((c) => <div key={`c${c}`} className="naval-label">{c}</div>)}
      {children}
    </div>
  );
}

function PlaceBoard({
  fleet, preview, selected, onCell, onHover,
}: {
  fleet: Ship[];
  preview: number[] | null;
  selected: number | null;
  onCell: (i: number) => void;
  onHover: (i: number | null) => void;
}) {
  const occupied = useMemo(() => {
    const map = new Map<number, number>();
    fleet.forEach((s, si) => s.cells.forEach((c) => map.set(c, si)));
    return map;
  }, [fleet]);
  const previewSet = new Set(preview ?? []);
  const previewOk = preview && !overlaps(fleet, preview, selected ?? undefined);

  return (
    <GridShell label="Seu mar — posicionar frota">
      {Array.from({ length: SIZE }, (_, row) => (
        <div key={`row-${row}`} className="naval-row-contents" style={{ display: "contents" }}>
          <div className="naval-label">{row + 1}</div>
          {Array.from({ length: SIZE }, (_, col) => {
            const i = row * SIZE + col;
            const shipIdx = occupied.get(i);
            const inPreview = previewSet.has(i);
            const cls = [
              "naval-cell",
              shipIdx !== undefined && "ship",
              selected !== null && shipIdx === selected && "selected",
              inPreview && (previewOk ? "preview-ok" : "preview-bad"),
            ].filter(Boolean).join(" ");
            return (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => onCell(i)}
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
                aria-label={`${COLS[col]}${row + 1}`}
              />
            );
          })}
        </div>
      ))}
    </GridShell>
  );
}

function BattleBoard({
  title, own, shots, fleet, canFire, busy, reveal, onFire,
}: {
  title: string;
  own: boolean;
  shots: ShotView[];
  fleet: Ship[] | null;
  canFire?: boolean;
  busy?: boolean;
  reveal?: Ship[] | null;
  onFire?: (i: number) => void;
}) {
  const shotMap = useMemo(() => {
    const map = new Map<number, ShotView>();
    for (const s of shots) map.set(s.cell, s);
    return map;
  }, [shots]);
  const fleetSet = useMemo(() => {
    const set = new Set<number>();
    for (const s of fleet ?? []) for (const c of s.cells) set.add(c);
    for (const s of reveal ?? []) for (const c of s.cells) set.add(c);
    return set;
  }, [fleet, reveal]);

  return (
    <div className="naval-board-wrap">
      <div className="naval-board-title">{title}</div>
      <GridShell label={title} className={canFire ? "fireable" : undefined}>
        {Array.from({ length: SIZE }, (_, row) => (
          <div key={`row-${row}`} style={{ display: "contents" }}>
            <div className="naval-label">{row + 1}</div>
            {Array.from({ length: SIZE }, (_, col) => {
              const i = row * SIZE + col;
              const shot = shotMap.get(i);
              const hasShip = fleetSet.has(i);
              const cls = [
                "naval-cell",
                own && hasShip && "ship",
                !own && reveal && hasShip && !shot?.hit && "ship-reveal",
                shot?.hit && (shot.sunk ? "sunk" : "hit"),
                shot && !shot.hit && "miss",
                canFire && !shot && "target",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  disabled={!canFire || busy || !!shot}
                  onClick={() => onFire?.(i)}
                  aria-label={`${COLS[col]}${row + 1}${shot ? (shot.hit ? " acerto" : " água") : ""}`}
                />
              );
            })}
          </div>
        ))}
      </GridShell>
    </div>
  );
}

function PlacePhase({ busy, onPlace }: { busy: boolean; onPlace: (ships: Ship[]) => void }) {
  const [fleet, setFleet] = useState<Ship[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [horizontal, setHorizontal] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const nextLen = fleet.length < FLEET.length ? FLEET[fleet.length] : null;

  const preview = useMemo(() => {
    if (hover === null) return null;
    if (selected !== null) {
      const ship = fleet[selected];
      return shipCells(hover, ship.len, horizontal);
    }
    if (nextLen !== null) return shipCells(hover, nextLen, horizontal);
    return null;
  }, [hover, selected, horizontal, fleet, nextLen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") setHorizontal((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const placeAt = (i: number) => {
    if (selected !== null) {
      const ship = fleet[selected];
      const cells = shipCells(i, ship.len, horizontal);
      if (!cells || overlaps(fleet, cells, selected)) return;
      setFleet((f) => f.map((s, idx) => (idx === selected ? { ...s, cells } : s)));
      setSelected(null);
      return;
    }
    if (nextLen === null) return;
    const cells = shipCells(i, nextLen, horizontal);
    if (!cells || overlaps(fleet, cells)) return;
    setFleet((f) => [...f, { len: nextLen, cells }]);
  };

  const ready = fleet.length === FLEET.length;

  return (
    <div className="naval-place">
      <p className="mute small center">Posicione a frota (4 · 3 · 2 · 2). Clique no mar para colocar. <kbd>R</kbd> gira.</p>
      <div className="naval-toolbar">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHorizontal((h) => !h)}>
          {horizontal ? "Horizontal" : "Vertical"} · girar
        </button>
        {fleet.length > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setFleet([]); setSelected(null); }}>
            Limpar
          </button>
        )}
      </div>
      <div className="naval-ships">
        {[...FLEET].map((len, slot) => {
          const ship = fleet[slot];
          const isNext = !ship && fleet.length === slot;
          const isSel = selected === slot;
          return (
            <button
              key={`${len}-${slot}`}
              type="button"
              className={`naval-ship-chip${ship ? " placed" : ""}${isNext ? " next" : ""}${isSel ? " selected" : ""}`}
              disabled={!ship}
              onClick={() => ship && setSelected(isSel ? null : slot)}
            >
              <span className="naval-ship-bars">{Array.from({ length: len }, (_, j) => <i key={j} />)}</span>
              {ship ? (isSel ? "mover" : `${len}`) : isNext ? "agora" : `${len}`}
            </button>
          );
        })}
      </div>
      <PlaceBoard fleet={fleet} preview={preview} selected={selected} onCell={placeAt} onHover={setHover} />
      <button className="btn btn-primary" disabled={!ready || busy} onClick={() => onPlace(fleet)}>
        Pronto — confirmar frota
      </button>
    </div>
  );
}

export default function NavalMatch({ m, busy, onPlace, onFire, onLeave, onRematch }: {
  m: any;
  busy: boolean;
  onPlace: (ships: Ship[]) => void;
  onFire: (cell: number) => void;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const playing = m.status === "playing";
  const done = m.status === "done";
  const outcome: "win" | "lose" | "draw" | null = done
    ? (m.winner === "draw" ? "draw" : m.winner === m.you ? "win" : "lose")
    : null;

  const mine = m.you === m.turn;
  const myHits = (m.myShots as ShotView[] | undefined)?.filter((s) => s.hit).length ?? 0;
  const oppHits = (m.oppShots as ShotView[] | undefined)?.filter((s) => s.hit).length ?? 0;
  const hostHits = m.you === "X" ? myHits : oppHits;
  const guestHits = m.you === "O" ? myHits : oppHits;

  return (
    <>
      <div className="players">
        <div className={`player${done && m.winner === "X" ? " winner" : ""}`}>
          <span className="player-sym rps-score">{hostHits}</span>
          <div className="grow">
            <div className="name">{m.host}</div>
            {m.you === "X" && <span className="you-tag">você</span>}
          </div>
        </div>
        <span className="vs">VS</span>
        <div className={`player right${done && m.winner === "O" ? " winner" : ""}`}>
          <span className="player-sym rps-score">{guestHits}</span>
          <div className="grow">
            <div className="name">{m.guest ?? "Aguardando…"}</div>
            {m.you === "O" && <span className="you-tag">você</span>}
          </div>
        </div>
      </div>

      <div className="rps-meta">Batalha naval · 8×8 · células atingidas</div>

      {playing && m.phase === "place" && (
        m.myReady ? (
          <div className="waiting naval-wait">
            <strong>Frota posicionada</strong>
            <span className="mute">Aguardando o adversário<Dots /></span>
            <span className="mute small">{m.oppReady ? "Adversário pronto ✓" : "Adversário ainda posicionando…"}</span>
          </div>
        ) : (
          <PlacePhase busy={busy} onPlace={onPlace} />
        )
      )}

      {((playing && m.phase === "battle") || done) && (
        <>
          <div className="naval-battle">
            <BattleBoard title="Seu mar" own fleet={m.myFleet} shots={m.oppShots ?? []} />
            <BattleBoard
              title="Mar inimigo"
              own={false}
              fleet={null}
              shots={m.myShots ?? []}
              reveal={done ? m.oppFleet : null}
              canFire={playing && m.phase === "battle" && mine}
              busy={busy}
              onFire={onFire}
            />
          </div>
          {playing && m.phase === "battle" && (
            <div key={m.turn} className={`status ${mine ? "mine" : "theirs"}`} aria-live="polite">
              {mine ? "Sua vez — atire no mar inimigo" : <>Vez do adversário <Dots /></>}
            </div>
          )}
        </>
      )}

      {outcome && (
        <div className={`result ${outcome}`} aria-live="polite">
          <h2>{outcome === "win" ? "Você venceu!" : outcome === "lose" ? "Não foi dessa vez" : "Partida encerrada"}</h2>
          <span className={`pts ${outcome}`}>{outcome === "win" ? "+3 pontos" : "0 pontos"}</span>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button className="btn" onClick={onLeave}>Sair</button>
            <button className="btn btn-primary" disabled={busy} onClick={onRematch}>Revanche</button>
          </div>
        </div>
      )}
      {outcome === "win" && <Confetti />}
    </>
  );
}
