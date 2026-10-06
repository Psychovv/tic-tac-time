"use client";
import { useEffect, useState } from "react";
import Confetti from "./Confetti";
import { MOVES, winsNeeded, type Move } from "@/lib/game";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Last = { n: number; h: Move; g: Move; w: "X" | "O" | "draw" };

export const EMOJI: Record<Move, string> = { R: "✊", P: "✋", S: "✌️" };
const NAME: Record<Move, string> = { R: "Pedra", P: "Papel", S: "Tesoura" };

export const gameLabel = (game: string, bestOf: number) =>
  game === "rps" ? `Pedra, papel e tesoura · melhor de ${bestOf}` : "Jogo da velha";

function Dots() {
  return <span className="dots" aria-hidden="true"><span /><span /><span /></span>;
}

function RpsPlayer({ name, score, you, winner, right }: {
  name: string | null; score: number; you: boolean; winner: boolean; right?: boolean;
}) {
  const cls = ["player", right && "right", !name && "waiting", winner && "winner"].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <span key={score} className={`player-sym rps-score${score > 0 ? " bump" : ""}`}>{score}</span>
      <div className="grow">
        <div className="name">{name ?? "Aguardando…"}</div>
        {you && <span className="you-tag">você</span>}
      </div>
    </div>
  );
}

function Hand({ move, side, mode, label }: {
  move: Move | null; side: "l" | "r"; mode: "idle" | "shake" | "show"; label?: string;
}) {
  // Durante o balanco a mao e sempre um punho; a jogada real do adversario so aparece ao revelar.
  const emoji = EMOJI[mode === "shake" ? "R" : move ?? "R"];
  return (
    <div className="rps-hand-wrap">
      <div className={`rps-hand ${side} ${mode}${label ? ` ${label}` : ""}`}>
        <span className="hand-flip"><span key={`${mode}-${move}`} className="hand-move">{emoji}</span></span>
      </div>
    </div>
  );
}

export default function RpsMatch({ m, busy, onPick, onLeave, onRematch }: {
  m: any; busy: boolean; onPick: (move: Move) => void; onLeave: () => void; onRematch: () => void;
}) {
  // `seen`: ultima rodada cuja revelacao ja foi exibida. Ao montar (ex.: recarregou a pagina)
  // nao reexibe rodadas antigas. Quando m.round passa de `seen`, toca a animacao.
  const [seen, setSeen] = useState<number>(m.round);
  const [reveal, setReveal] = useState<Last | null>(null);
  const [phase, setPhase] = useState<"shake" | "show">("shake");

  useEffect(() => {
    if (reveal || !m.last || m.last.n <= seen) return;
    setReveal(m.last);
    setPhase("shake");
  }, [m.last?.n, reveal, seen]);

  useEffect(() => {
    if (!reveal) return;
    const t1 = setTimeout(() => setPhase("show"), 1700); // 3 balancos de .55s
    const t2 = setTimeout(() => { setSeen(reveal.n); setReveal(null); }, 3700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reveal]);

  const pending = m.round > seen; // ha uma revelacao a exibir (inclui o frame antes do efeito rodar)
  const showing = !!reveal && phase === "show";
  const lastW: Last["w"] | undefined = (reveal ?? m.last)?.w;
  // Enquanto a revelacao nao termina de mostrar, o ponto da rodada ainda nao entra no placar.
  const hold = pending && !showing;
  const hostScore = m.hostScore - (hold && lastW === "X" ? 1 : 0);
  const guestScore = m.guestScore - (hold && lastW === "O" ? 1 : 0);

  const playing = m.status === "playing" && !pending;
  const done = m.status === "done" && !pending;
  const outcome: "win" | "lose" | "draw" | null = done
    ? (m.winner === "draw" ? "draw" : m.winner === m.you ? "win" : "lose") : null;
  const need = winsNeeded(m.bestOf);

  // Maos: host a esquerda, convidado a direita (mesma ordem do placar).
  const youSide = m.you === "X" ? "l" : "r";
  let hostMove: Move | null = null, guestMove: Move | null = null;
  let mode: "idle" | "shake" | "show" = "idle";
  let hostRes = "", guestRes = "";
  if (reveal) {
    mode = phase;
    if (phase === "show") {
      hostMove = reveal.h; guestMove = reveal.g;
      hostRes = reveal.w === "draw" ? "tie" : reveal.w === "X" ? "win" : "lose";
      guestRes = reveal.w === "draw" ? "tie" : reveal.w === "O" ? "win" : "lose";
    }
  } else if (m.myMove) {
    // Sua jogada travada aparece so no seu lado; a do adversario continua escondida.
    if (youSide === "l") hostMove = m.myMove; else guestMove = m.myMove;
  }

  const roundMsg = showing && reveal
    ? (reveal.w === "draw" ? "Empate! Joguem de novo"
      : reveal.w === m.you ? "Você levou a rodada!" : "O adversário levou a rodada")
    : null;

  return (
    <>
      <div className="players">
        <RpsPlayer name={m.host} score={hostScore} you={m.you === "X"} winner={done && m.winner === "X"} />
        <span className="vs">VS</span>
        <RpsPlayer name={m.guest} score={guestScore} you={m.you === "O"} winner={done && m.winner === "O"} right />
      </div>

      <div className="rps-meta">
        {outcome ? "Fim de jogo" : `Rodada ${seen + 1}`} · melhor de {m.bestOf} · primeiro a {need}
      </div>

      <div className="rps-arena" aria-live="polite">
        <Hand move={hostMove} side="l" mode={mode} label={hostRes} />
        <Hand move={guestMove} side="r" mode={mode} label={guestRes} />
      </div>

      {reveal && (
        <div key={phase} className={`status ${showing ? (reveal.w === "draw" ? "theirs" : reveal.w === m.you ? "mine" : "theirs") : "theirs"}`} aria-live="polite">
          {showing ? roundMsg : <>Pedra, papel, tesoura<Dots /></>}
        </div>
      )}

      {playing && !reveal && (
        <>
          <div className="rps-picks" role="group" aria-label="Escolha sua jogada">
            {MOVES.map((mv) => (
              <button key={mv} className={`rps-pick${m.myMove === mv ? " chosen" : ""}`}
                disabled={busy || !!m.myMove} onClick={() => onPick(mv)} aria-label={NAME[mv]}>
                <span className="emo">{EMOJI[mv]}</span>
                <span>{NAME[mv]}</span>
              </button>
            ))}
          </div>
          <div key={m.myMove ?? "pick"} className={`status ${m.myMove ? "theirs" : "mine"}`} aria-live="polite">
            {m.myMove ? <>Aguardando o adversário<Dots /></> : "Escolha sua jogada"}
          </div>
          <span className="mute small">{m.oppPicked ? "Adversário já escolheu ✓" : "Adversário ainda está pensando…"}</span>
        </>
      )}

      {outcome && (
        <div className={`result ${outcome}`} aria-live="polite">
          <h2>{outcome === "win" ? "Você venceu!" : outcome === "lose" ? "Não foi dessa vez" : "Partida encerrada"}</h2>
          <span className={`pts ${outcome}`}>{outcome === "win" ? "+1 ponto" : "0 pontos"}</span>
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
