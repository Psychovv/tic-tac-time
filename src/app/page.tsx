"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import Board from "@/components/Board";
import Confetti from "@/components/Confetti";
import Header, { type Tab } from "@/components/Header";
import { IconAlert, IconBolt, IconBook, IconSearch, IconTrophy, IconUsers } from "@/components/Icons";
import { Logo, OMark, XMark, vars } from "@/components/Marks";

/* eslint-disable @typescript-eslint/no-explicit-any */
const post = (url: string, body: object = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export default function Home() {
  const [hub, setHub] = useState<any>(null);
  const [mid, setMid] = useState<string | null>(null);
  const [m, setM] = useState<any>(null);
  const [nick, setNick] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [errKey, setErrKey] = useState(0);
  const [tab, setTab] = useState<Tab>("jogar");
  const [busy, setBusy] = useState(false);

  // Polling a cada 2s: hub (convites/ranking) e, se estiver numa partida, o estado dela.
  useEffect(() => {
    let on = true;
    const tick = async () => {
      try {
        const h = await fetch("/api/hub", { cache: "no-store" }).then((r) => r.json());
        if (!on) return;
        setHub(h);
        if (h.mine && !mid) setMid(h.mine.id);
        if (mid) {
          const r = await fetch(`/api/matches/${mid}`, { cache: "no-store" });
          if (r.ok && on) setM(await r.json());
        }
      } catch { /* rede instavel: tenta no proximo tick */ }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { on = false; clearInterval(t); };
  }, [mid]);

  // Entrou numa partida (criou, aceitou ou ja tinha uma aberta): leva pra aba Jogar.
  useEffect(() => { if (mid) setTab("jogar"); }, [mid]);

  // Toast de erro some sozinho.
  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => setErr(""), 3500);
    return () => clearTimeout(t);
  }, [err, errKey]);

  const fail = (e?: string) => { setErr(e ?? ""); if (e) setErrKey((k) => k + 1); };
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch { fail("Falha de conexao, tente de novo"); } finally { setBusy(false); } };

  const act = (id: string, body: object) => run(async () => {
    const r = await post(`/api/matches/${id}`, body);
    fail(r.error);
    if (r.id) { setM(r); setMid(id); }
  });
  const leave = () => { setMid(null); setM(null); };
  const search = () => run(async () => { const r = await post("/api/matches"); fail(r.error); if (r.id) setMid(r.id); });
  const cancel = () => run(async () => { await post(`/api/matches/${mid}`, { action: "cancel" }); leave(); });
  const login = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => { const r = await post("/api/login", { nickname: nick, pin }); fail(r.error); if (r.ok) location.reload(); });
  };
  const logout = () => run(async () => { await post("/api/logout"); location.reload(); });

  const toast = err && <div className="toast" role="alert" key={errKey}><IconAlert />{err}</div>;

  if (!hub) return <Splash />;

  if (!hub.me) return (
    <main className="login">
      <form className="card login-card" onSubmit={login}>
        <Logo className="login-logo" />
        <h1 className="title">
          <span className="word" style={vars({ "--i": 0 })}>Tic</span>{" "}
          <span className="word" style={vars({ "--i": 1 })}>Tac</span>{" "}
          <span className="word" style={vars({ "--i": 2 })}><span className="grad">Time</span></span>
        </h1>
        <p className="mute login-sub">O jogo da velha do setor. Desafie a galera e suba no ranking.</p>
        <div className="login-form">
          <label className="sr-only" htmlFor="nick">Apelido</label>
          <input id="nick" className="input" value={nick} onChange={(e) => setNick(e.target.value)}
            placeholder="Como você quer ser chamado?" maxLength={20} autoFocus autoComplete="username" />
          <label className="sr-only" htmlFor="pin">PIN (4 números)</label>
          <input id="pin" className="input" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4}
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="PIN (4 números)" autoComplete="current-password" />
          <button className="btn btn-primary btn-lg" disabled={busy || nick.trim().length < 2 || pin.length !== 4}>Entrar no jogo</button>
        </div>
        {hub.ranking?.length > 0 && (
          <div className="login-top">
            <div className="avatar-stack">
              {hub.ranking.slice(0, 5).map((r: any) => <Avatar key={r.nickname} name={r.nickname} />)}
            </div>
            <span className="mute">{hub.ranking.length >= 10 ? "10+" : hub.ranking.length} jogando no ranking</span>
          </div>
        )}
      </form>
      {toast}
    </main>
  );

  return (
    <>
      <Header tab={tab} onTab={setTab} me={hub.me} live={!!mid} onLogout={logout} />
      <main className="main">
        {tab === "jogar" && (
          mid && m ? <MatchView key={`m-${mid}`} m={m} busy={busy} onMove={(i) => act(mid, { action: "move", cell: i })} onCancel={cancel} onLeave={leave} />
          : mid ? <Splash inline key="loading" />
          : <Lobby key="lobby" hub={hub} busy={busy} onSearch={search} onAccept={(id) => act(id, { action: "accept" })} onRanking={() => setTab("ranking")} />
        )}
        {tab === "ranking" && <RankingView key="ranking" ranking={hub.ranking} me={hub.me.nickname} />}
        {tab === "regras" && <RulesView key="regras" />}
      </main>
      <footer className="footer"><Logo /> Tic Tac Time · feito pra descontrair o setor</footer>
      {toast}
    </>
  );
}

function Splash({ inline }: { inline?: boolean }) {
  return (
    <div className={inline ? "splash inline" : "splash"}>
      <Logo className="spin" />
      <span className="mute">Carregando…</span>
    </div>
  );
}

function Dots() {
  return <span className="dots" aria-hidden="true"><span /><span /><span /></span>;
}

function Lobby({ hub, busy, onSearch, onAccept, onRanking }: {
  hub: any; busy: boolean; onSearch: () => void; onAccept: (id: string) => void; onRanking: () => void;
}) {
  return (
    <div className="view">
      <section className="card hero">
        <div className="hero-deco" aria-hidden="true"><XMark /><OMark /></div>
        <div className="hero-text">
          <span className="eyebrow"><IconBolt /> Partida rápida</span>
          <h1>Bora uma partida, <span className="grad">{hub.me.nickname}</span>?</h1>
          <p className="mute">Crie um desafio e espere alguém aceitar, ou aceite um dos desafios abertos.</p>
        </div>
        <button className="btn btn-primary btn-lg pulse" onClick={onSearch} disabled={busy}><IconSearch /> Procurar partida</button>
      </section>

      <div className="grid-2">
        <section className="card" style={vars({ "--delay": ".08s" })}>
          <div className="card-head">
            <h2 className="card-title"><IconUsers /> Desafios abertos
              {hub.waiting.length > 0 && <span key={hub.waiting.length} className="count bump">{hub.waiting.length}</span>}
            </h2>
            <span className="live">ao vivo</span>
          </div>
          {hub.waiting.length === 0 ? (
            <div className="empty">
              <div className="empty-board">{Array.from({ length: 9 }, (_, i) => <i key={i} style={vars({ "--i": i })} />)}</div>
              <strong>Ninguém procurando agora</strong>
              <span>Puxe uma partida e apareça aqui pra galera!</span>
            </div>
          ) : (
            <div className="list">
              {hub.waiting.map((w: any, i: number) => (
                <div className="row-item" key={w.id} style={vars({ "--i": i })}>
                  <Avatar name={w.host} />
                  <div className="grow"><div className="name">{w.host}</div><div className="sub">quer jogar agora</div></div>
                  <button className="btn btn-accept" disabled={busy} onClick={() => onAccept(w.id)}>Aceitar</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={vars({ "--delay": ".16s" })}>
          <div className="card-head">
            <h2 className="card-title"><IconTrophy /> Top 5</h2>
            <button className="btn btn-ghost btn-sm" onClick={onRanking}>Ver tudo →</button>
          </div>
          <RankList rows={hub.ranking.slice(0, 5)} me={hub.me.nickname} />
        </section>
      </div>
    </div>
  );
}

function RankList({ rows, me, start = 0 }: { rows: any[]; me: string; start?: number }) {
  if (!rows.length) return <div className="empty"><span>Ninguém pontuou ainda. Seja o primeiro!</span></div>;
  return (
    <div className="list">
      {rows.map((r, i) => {
        const pos = start + i + 1;
        return (
          <div key={r.nickname} className={`row-item${r.nickname === me ? " me" : ""}`} style={vars({ "--i": i })}>
            <span className="rank-pos">{pos <= 3 ? ["🥇", "🥈", "🥉"][pos - 1] : pos}</span>
            <Avatar name={r.nickname} />
            <div className="grow">
              <div className="name">{r.nickname}{r.nickname === me && <span className="you-tag">você</span>}</div>
              <div className="sub">{r.wins} {r.wins === 1 ? "vitória" : "vitórias"}</div>
            </div>
            <span className="rank-pts">{r.points}<small> pts</small></span>
          </div>
        );
      })}
    </div>
  );
}

function RankingView({ ranking, me }: { ranking: any[]; me: string }) {
  // Podio na ordem visual 2o, 1o, 3o.
  const podium = [
    { r: ranking[1], pos: 2, medal: "#cbd5e1", delay: ".15s" },
    { r: ranking[0], pos: 1, medal: "#fbbf24", delay: "0s" },
    { r: ranking[2], pos: 3, medal: "#e08a3c", delay: ".3s" },
  ];
  return (
    <div className="view">
      <section className="card">
        <div className="card-head">
          <h2 className="card-title"><IconTrophy /> Ranking · Top 10</h2>
          <span className="mute small">Vitória +3 · Empate +1</span>
        </div>
        {ranking.length === 0 ? <RankList rows={[]} me={me} /> : (
          <div className="podium">
            {podium.map(({ r, pos, medal, delay }) => r ? (
              <div key={pos} className={`podium-col p${pos}${r.nickname === me ? " me" : ""}`} style={vars({ "--medal": medal, "--delay": delay })}>
                {pos === 1 && <span className="crown" aria-hidden="true">👑</span>}
                <Avatar name={r.nickname} />
                <div className="name">{r.nickname}</div>
                <div className="rank-pts">{r.points}<small> pts</small></div>
                <div className="podium-block">{pos}</div>
              </div>
            ) : <div key={pos} />)}
          </div>
        )}
        {ranking.length > 3 && <RankList rows={ranking.slice(3)} me={me} start={3} />}
      </section>
    </div>
  );
}

function RulesView() {
  return (
    <div className="view">
      <section className="card">
        <h2 className="card-title"><IconBook /> Como funciona</h2>
        <ol className="steps">
          <li><div><strong>Procure uma partida.</strong> <span className="mute">Seu desafio aparece no lobby de todo mundo.</span></div></li>
          <li><div><strong>Ou aceite um desafio.</strong> <span className="mute">O primeiro que aceitar leva a vaga.</span></div></li>
          <li><div><strong>Quem criou joga de <span className="X">X</span> e começa.</strong> <span className="mute">Quem aceitou joga de <span className="O">O</span>.</span></div></li>
          <li><div><strong>Feche uma linha, coluna ou diagonal.</strong> <span className="mute">Tabuleiro cheio sem vencedor? Deu velha!</span></div></li>
        </ol>
      </section>
      <section className="card" style={vars({ "--delay": ".08s" })}>
        <h2 className="card-title"><IconTrophy /> Pontuação</h2>
        <div className="points-grid">
          <div className="point-card win" style={vars({ "--delay": ".15s" })}><b>+3</b><span>Vitória</span></div>
          <div className="point-card draw" style={vars({ "--delay": ".25s" })}><b>+1</b><span>Empate</span></div>
          <div className="point-card lose" style={vars({ "--delay": ".35s" })}><b>0</b><span>Derrota</span></div>
        </div>
      </section>
    </div>
  );
}

function Player({ name, sym, active, you, right, winner }: {
  name: string | null; sym: "X" | "O"; active: boolean; you: boolean; right?: boolean; winner: boolean;
}) {
  const cls = ["player", `p${sym.toLowerCase()}`, active && "active", right && "right", !name && "waiting", winner && "winner"].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <span className="player-sym">{sym === "X" ? <XMark /> : <OMark />}</span>
      <div className="grow">
        <div className="name">{name ?? "Aguardando…"}</div>
        {you && <span className="you-tag">você</span>}
      </div>
    </div>
  );
}

function MatchView({ m, busy, onMove, onCancel, onLeave }: {
  m: any; busy: boolean; onMove: (i: number) => void; onCancel: () => void; onLeave: () => void;
}) {
  const mine = m.you === m.turn;
  const playing = m.status === "playing";
  const done = m.status === "done";
  const outcome: "win" | "lose" | "draw" | null = done ? (m.winner === "draw" ? "draw" : m.winner === m.you ? "win" : "lose") : null;

  return (
    <div className="view">
      <section className="card match">
        <div className="players">
          <Player name={m.host} sym="X" active={playing && m.turn === "X"} you={m.you === "X"} winner={done && m.winner === "X"} />
          <span className="vs">VS</span>
          <Player name={m.guest} sym="O" active={playing && m.turn === "O"} you={m.you === "O"} winner={done && m.winner === "O"} right />
        </div>

        {m.status === "waiting" ? (
          <div className="waiting">
            <div className="radar"><span className="radar-sweep" /><i /><Logo /></div>
            <strong>Procurando adversário<Dots /></strong>
            <span className="mute">Seu desafio está visível no lobby de todo mundo.</span>
            <button className="btn" onClick={onCancel} disabled={busy}>Cancelar</button>
          </div>
        ) : (
          <>
            <Board board={m.board} you={m.you} canPlay={playing && mine && !busy} onPlay={onMove} />
            {playing && (
              <div key={m.turn} className={`status ${mine ? "mine" : "theirs"}`} aria-live="polite">
                {mine
                  ? <>Sua vez <span className="status-sym">{m.you === "X" ? <XMark /> : <OMark />}</span></>
                  : <>Vez do adversário <Dots /></>}
              </div>
            )}
            {outcome && (
              <div className={`result ${outcome}`} aria-live="polite">
                <h2>{outcome === "win" ? "Você venceu!" : outcome === "lose" ? "Não foi dessa vez" : "Deu velha!"}</h2>
                <span className={`pts ${outcome}`}>{outcome === "win" ? "+3 pontos" : outcome === "draw" ? "+1 ponto" : "0 pontos"}</span>
                <button className="btn btn-primary" onClick={onLeave}>Voltar ao lobby</button>
              </div>
            )}
          </>
        )}
      </section>
      {outcome === "win" && <Confetti />}
    </div>
  );
}
