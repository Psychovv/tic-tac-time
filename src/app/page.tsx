"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import Board from "@/components/Board";
import Confetti from "@/components/Confetti";
import Header, { type Tab } from "@/components/Header";
import {
  IconAlert, IconBolt, IconBook, IconSearch, IconTrophy, IconUsers,
  IconSettings, IconUpload, IconTrash, IconLink, IconCopy, IconCheck,
  IconSwords, IconShare, IconClose
} from "@/components/Icons";
import { Logo, OMark, XMark, vars } from "@/components/Marks";
import RpsMatch, { EMOJI, gameLabel } from "@/components/Rps";
import { BEST_OF, type Move } from "@/lib/game";

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
  const [hasInvite, setHasInvite] = useState(false);
  // Jogo e formato escolhidos no lobby (valem para procurar, criar link e desafiar jogador).
  const [setup, setSetup] = useState<{ game: "ttt" | "rps"; bestOf: number }>({ game: "ttt", bestOf: 3 });
  const fast = m?.game === "rps" && m?.status === "playing";

  // Detecta parâmetro de convite na URL
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("join")) {
      setHasInvite(true);
    }
  }, []);

  // Polling a cada 2s (1s em partida de pedra, papel e tesoura): hub (convites/ranking) e, se estiver numa partida, o estado dela.
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
          if (r.ok && on) {
            setM(await r.json());
          } else if (r.status === 404 && on) {
            setMid(null);
            setM(null);
            fail("Partida finalizada ou cancelada");
          }
        }
      } catch { /* rede instavel: tenta no proximo tick */ }
    };
    tick();
    const t = setInterval(tick, fast ? 1000 : 2000);
    return () => { on = false; clearInterval(t); };
  }, [mid, fast]);

  // Se tem ?join= na URL e o usuário está logado, entra na partida automaticamente
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join");
    if (!joinId) return;

    if (hub?.me) {
      if (mid !== joinId) {
        run(async () => {
          const r = await post(`/api/matches/${joinId}`, { action: "accept" });
          if (r.error) {
            fail(r.error);
          } else {
            setMid(joinId);
            setM(r);
            setTab("jogar");
          }
          window.history.replaceState({}, "", window.location.pathname);
        });
      } else {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [hub?.me]);

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
    if (r.id) {
      if (r.id !== id) {
        setMid(r.id);
        setM(null);
      } else {
        setM(r);
        setMid(id);
      }
    } else if (body && (body as any).action === "decline") {
      // Se recusou o desafio, atualiza o hub
      const h = await fetch("/api/hub", { cache: "no-store" }).then((res) => res.json());
      setHub(h);
    }
  });

  const leave = () => { setMid(null); setM(null); };
  const search = () => run(async () => { const r = await post("/api/matches", setup); fail(r.error); if (r.id) setMid(r.id); });
  const createLink = () => run(async () => {
    const r = await post("/api/matches", { isPrivate: true, ...setup });
    fail(r.error);
    if (r.id) { setMid(r.id); setTab("jogar"); }
  });
  const challenge = (targetNickname: string) => run(async () => {
    const r = await post("/api/matches", { targetNickname, isPrivate: true, ...setup });
    fail(r.error);
    if (r.id) { setMid(r.id); setTab("jogar"); }
  });
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
        <p className="mute login-sub">O jogo da velha. Desafie a galera e suba no ranking.</p>

        {hasInvite && (
          <div className="invite-notice">
            <IconLink />
            <span>Você recebeu um convite para jogar! Crie ou digite seu apelido abaixo para entrar.</span>
          </div>
        )}

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
              {hub.ranking.slice(0, 5).map((r: any) => <Avatar key={r.nickname} name={r.nickname} photo={r.photo} />)}
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
        {hub.challenges?.length > 0 && !mid && (
          <div className="challenge-banner-list">
            {hub.challenges.map((c: any) => (
              <div key={c.id} className="card challenge-banner">
                <div className="challenge-banner-info">
                  <Avatar name={c.host} photo={c.photo} />
                  <div>
                    <div className="challenge-banner-title">
                      <strong>@{c.host}</strong> desafiou você para uma partida!
                    </div>
                    <div className="mute small">Duelo ao vivo · {gameLabel(c.game, c.bestOf)}</div>
                  </div>
                </div>
                <div className="challenge-banner-actions">
                  <button className="btn btn-accept btn-sm" disabled={busy} onClick={() => act(c.id, { action: "accept" })}>
                    Aceitar
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(c.id, { action: "decline" })}>
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "jogar" && (
          mid && m ? <MatchView key={`m-${mid}`} m={m} busy={busy} onMove={(i) => act(mid, { action: "move", cell: i })} onPick={(mv) => act(mid, { action: "pick", move: mv })} onCancel={cancel} onLeave={leave} onRematch={() => act(mid, { action: "rematch" })} />
          : mid ? <Splash inline key="loading" />
          : <Lobby key="lobby" hub={hub} busy={busy} setup={setup} onSetup={setSetup} onSearch={search} onCreateLink={createLink} onChallenge={challenge} onAccept={(id) => act(id, { action: "accept" })} onRanking={() => setTab("ranking")} />
        )}
        {tab === "ranking" && <RankingView key="ranking" me={hub.me.nickname} onChallenge={challenge} />}
        {tab === "settings" && <SettingsView key="settings" me={hub.me} onUpdate={() => location.reload()} onLogout={logout} />}
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

type Setup = { game: "ttt" | "rps"; bestOf: number };

// Escolha do jogo (e do "melhor de" no caso de pedra, papel e tesoura) antes de criar a partida.
function GameSetup({ setup, onChange }: { setup: Setup; onChange: (s: Setup) => void }) {
  return (
    <div className="setup">
      <div className="seg" role="group" aria-label="Jogo">
        <button type="button" className={`seg-btn${setup.game === "ttt" ? " active" : ""}`} onClick={() => onChange({ ...setup, game: "ttt" })}>
          Jogo da velha
        </button>
        <button type="button" className={`seg-btn${setup.game === "rps" ? " active" : ""}`} onClick={() => onChange({ ...setup, game: "rps" })}>
          {EMOJI.R}{EMOJI.P}{EMOJI.S} Pedra, papel e tesoura
        </button>
      </div>
      {setup.game === "rps" && (
        <div className="seg" role="group" aria-label="Melhor de">
          {BEST_OF.map((n) => (
            <button key={n} type="button" className={`seg-btn${setup.bestOf === n ? " active" : ""}`} onClick={() => onChange({ ...setup, bestOf: n })}>
              Melhor de {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Lobby({ hub, busy, setup, onSetup, onSearch, onCreateLink, onChallenge, onAccept, onRanking }: {
  hub: any;
  busy: boolean;
  setup: Setup;
  onSetup: (s: Setup) => void;
  onSearch: () => void;
  onCreateLink: () => void;
  onChallenge: (nickname: string) => void;
  onAccept: (id: string) => void;
  onRanking: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [customNick, setCustomNick] = useState("");

  const handleChallengeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customNick.trim();
    if (!trimmed) return;
    setShowModal(false);
    setCustomNick("");
    onChallenge(trimmed);
  };

  return (
    <div className="view">
      <section className="card hero">
        <div className="hero-deco" aria-hidden="true"><XMark /><OMark /></div>
        <div className="hero-text">
          <span className="eyebrow"><IconBolt /> Partida rápida</span>
          <h1>Bora uma partida, <span className="grad">{hub.me.nickname}</span>?</h1>
          <p className="mute">Escolha o jogo, depois crie um link de desafio, desafie um jogador diretamente ou procure uma partida aberta.</p>
          <GameSetup setup={setup} onChange={onSetup} />
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary pulse" onClick={onSearch} disabled={busy}>
            <IconSearch /> Procurar partida
          </button>
          <button className="btn btn-link-challenge" onClick={onCreateLink} disabled={busy}>
            <IconLink /> Criar link de desafio
          </button>
          <button className="btn btn-ghost" onClick={() => setShowModal(true)} disabled={busy}>
            <IconSwords /> Desafiar jogador
          </button>
        </div>
      </section>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title"><IconSwords /> Desafiar jogador</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><IconClose /></button>
            </div>
            <form onSubmit={handleChallengeSubmit} className="modal-body">
              <p className="mute small">Digite o apelido exato do colega que você quer desafiar:</p>
              <input
                className="input"
                value={customNick}
                onChange={(e) => setCustomNick(e.target.value)}
                placeholder="Ex: Carlos, Ana, Leo..."
                maxLength={20}
                autoFocus
              />
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={busy || !customNick.trim()}>Desafiar</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <Avatar name={w.host} photo={w.photo} />
                  <div className="grow"><div className="name">{w.host}</div><div className="sub">quer jogar · {gameLabel(w.game, w.bestOf)}</div></div>
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
          <RankList rows={hub.ranking.slice(0, 5)} me={hub.me.nickname} onChallenge={onChallenge} />
        </section>
      </div>
    </div>
  );
}

function RankList({ rows, me, start = 0, onChallenge }: { rows: any[]; me: string; start?: number; onChallenge?: (nickname: string) => void }) {
  if (!rows.length) return <div className="empty"><span>Ninguém pontuou ainda. Seja o primeiro!</span></div>;
  return (
    <div className="list">
      {rows.map((r, i) => {
        const pos = start + i + 1;
        const isMe = r.nickname === me;
        return (
          <div key={r.nickname} className={`row-item${isMe ? " me" : ""}`} style={vars({ "--i": i })}>
            <span className="rank-pos">{pos <= 3 ? ["🥇", "🥈", "🥉"][pos - 1] : pos}</span>
            <Avatar name={r.nickname} photo={r.photo} />
            <div className="grow">
              <div className="name">{r.nickname}{isMe && <span className="you-tag">você</span>}</div>
              <div className="sub">{r.wins} {r.wins === 1 ? "vitória" : "vitórias"}</div>
            </div>
            {!isMe && onChallenge && (
              <button
                className="btn-challenge-action"
                onClick={() => onChallenge(r.nickname)}
                title={`Desafiar ${r.nickname}`}
              >
                <IconSwords /> <span className="btn-challenge-text">Desafiar</span>
              </button>
            )}
            <span className="rank-pts">{r.points}<small> pts</small></span>
          </div>
        );
      })}
    </div>
  );
}

function RankingView({ me, onChallenge }: { me: string; onChallenge?: (nickname: string) => void }) {
  const [data, setData] = useState<{ranking: any[], history: any[]} | null>(null);
  useEffect(() => {
    fetch("/api/ranking").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <Splash />;
  const { ranking, history } = data;

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
          <h2 className="card-title"><IconTrophy /> Ranking Geral</h2>
          <span className="mute small">Velha: Vitória +3 · Empate 0 · Pedra, papel e tesoura: Vitória +1</span>
        </div>
        {ranking.length === 0 ? <RankList rows={[]} me={me} onChallenge={onChallenge} /> : (
          <div className="podium">
            {podium.map(({ r, pos, medal, delay }) => r ? (
              <div key={pos} className={`podium-col p${pos}${r.nickname === me ? " me" : ""}`} style={vars({ "--medal": medal, "--delay": delay })}>
                {pos === 1 && <span className="crown" aria-hidden="true">👑</span>}
                <Avatar name={r.nickname} photo={r.photo} />
                <div className="name">{r.nickname}</div>
                <div className="rank-pts">{r.points}<small> pts</small></div>
                {r.nickname !== me && onChallenge && (
                  <button
                    className="btn-challenge-action"
                    onClick={() => onChallenge(r.nickname)}
                    title={`Desafiar ${r.nickname}`}
                    style={{ marginTop: "4px" }}
                  >
                    <IconSwords /> <span className="btn-challenge-text">Desafiar</span>
                  </button>
                )}
                <div className="podium-block">{pos}</div>
              </div>
            ) : <div key={pos} />)}
          </div>
        )}
        {ranking.length > 3 && <RankList rows={ranking.slice(3)} me={me} start={3} onChallenge={onChallenge} />}
      </section>

      <section className="card" style={vars({ "--delay": ".1s" })}>
        <div className="card-head">
          <h2 className="card-title"><IconBook /> Seu Histórico</h2>
        </div>
        {!history.length ? <div className="empty"><span>Você ainda não jogou nenhuma partida.</span></div> : (
          <div className="list">
            {history.map((h: any, i: number) => {
              const won = h.winner === h.you;
              const draw = h.winner === "draw";
              return (
                <div key={h.id} className="row-item" style={vars({ "--i": i })}>
                  <div className="grow">
                    <div className="name">{h.host} <span className="mute">vs</span> {h.guest}</div>
                    <div className="sub">{gameLabel(h.game, h.bestOf)} · {new Date(h.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={`pts ${draw ? "draw" : won ? "win" : "lose"}`}>
                    {draw ? "Empate" : won ? "Vitória" : "Derrota"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
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
          <li><div><strong>Ou crie um link de desafio.</strong> <span className="mute">Envie no WhatsApp/Slack para jogar com um amigo.</span></div></li>
          <li><div><strong>Ou desafie diretamente pelo ranking.</strong> <span className="mute">Seu colega recebe uma notificação na hora para aceitar.</span></div></li>
          <li><div><strong>Jogo da velha: quem criou joga de <span className="X">X</span> e começa.</strong> <span className="mute">Quem aceitou joga de <span className="O">O</span>.</span></div></li>
          <li><div><strong>Pedra, papel e tesoura: os dois escolhem ao mesmo tempo.</strong> <span className="mute">A jogada fica escondida até os dois escolherem. Aí as mãos balançam e o resultado aparece. Empate repete a rodada. Vence quem chegar primeiro à maioria das rodadas (melhor de 1, 3 ou 5).</span></div></li>
        </ol>
      </section>
      <section className="card" style={vars({ "--delay": ".08s" })}>
        <h2 className="card-title"><IconTrophy /> Pontuação</h2>
        <span className="mute small">Jogo da velha</span>
        <div className="points-grid">
          <div className="point-card win" style={vars({ "--delay": ".15s" })}><b>+3</b><span>Vitória</span></div>
          <div className="point-card draw" style={vars({ "--delay": ".25s" })}><b>0</b><span>Empate</span></div>
          <div className="point-card lose" style={vars({ "--delay": ".35s" })}><b>0</b><span>Derrota</span></div>
        </div>
        <span className="mute small">Pedra, papel e tesoura (por partida, independente do melhor de)</span>
        <div className="points-grid two">
          <div className="point-card win" style={vars({ "--delay": ".15s" })}><b>+1</b><span>Vitória</span></div>
          <div className="point-card lose" style={vars({ "--delay": ".25s" })}><b>0</b><span>Derrota</span></div>
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

function MatchView({ m, busy, onMove, onPick, onCancel, onLeave, onRematch }: {
  m: any; busy: boolean; onMove: (i: number) => void; onPick: (move: Move) => void; onCancel: () => void; onLeave: () => void; onRematch: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/?join=${m.id}` : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback caso clipboard não esteja disponível
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Bora jogar ${m.game === "rps" ? "pedra, papel e tesoura" : "jogo da velha"} comigo? Entra aí no link pra gente disputar: ${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const mine = m.you === m.turn;
  const playing = m.status === "playing";
  const done = m.status === "done";
  // Em pedra, papel e tesoura o resultado (e o confete) ficam com o RpsMatch, que espera a animacao.
  const outcome: "win" | "lose" | "draw" | null = done && m.game === "ttt" ? (m.winner === "draw" ? "draw" : m.winner === m.you ? "win" : "lose") : null;

  return (
    <div className="view">
      <section className="card match">
        {m.game === "ttt" && (
          <div className="players">
            <Player name={m.host} sym="X" active={playing && m.turn === "X"} you={m.you === "X"} winner={done && m.winner === "X"} />
            <span className="vs">VS</span>
            <Player name={m.guest} sym="O" active={playing && m.turn === "O"} you={m.you === "O"} winner={done && m.winner === "O"} right />
          </div>
        )}

        {m.status === "waiting" ? (
          <div className="waiting">
            <span className="game-tag">{gameLabel(m.game, m.bestOf)}</span>
            <div className="radar"><span className="radar-sweep" /><i /><Logo /></div>
            <strong>
              {m.target ? (
                <>Aguardando <span className="grad">@{m.target}</span> aceitar<Dots /></>
              ) : m.isPrivate ? (
                <>Aguardando adversário pelo link<Dots /></>
              ) : (
                <>Procurando adversário<Dots /></>
              )}
            </strong>
            <span className="mute">
              {m.target
                ? `Convite enviado no jogo para @${m.target}. Você também pode copiar o link abaixo:`
                : m.isPrivate
                ? "Envie o link abaixo para seu adversário entrar na partida:"
                : "Seu desafio está visível no lobby público. Ou envie o link direto para um amigo:"}
            </span>

            <div className="share-box">
              <div className="share-input-wrap">
                <IconLink className="share-link-icon" />
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="share-input"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  className={`btn btn-sm ${copied ? "btn-accept" : "btn-primary"}`}
                  onClick={copyLink}
                >
                  {copied ? <><IconCheck /> Copiado!</> : <><IconCopy /> Copiar Link</>}
                </button>
              </div>
              <div className="share-actions">
                <button type="button" className="btn btn-sm btn-ghost" onClick={shareWhatsApp}>
                  <IconShare /> Enviar no WhatsApp
                </button>
              </div>
            </div>

            <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancelar Desafio</button>
          </div>
        ) : m.game === "rps" ? (
          <RpsMatch m={m} busy={busy} onPick={onPick} onLeave={onLeave} onRematch={onRematch} />
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
                <span className={`pts ${outcome}`}>{outcome === "win" ? "+3 pontos" : "0 pontos"}</span>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                  <button className="btn" onClick={onLeave}>Sair</button>
                  <button className="btn btn-primary" disabled={busy} onClick={onRematch}>Revanche</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      {outcome === "win" && <Confetti />}
    </div>
  );
}

function SettingsView({ me, onUpdate, onLogout }: { me: any; onUpdate: () => void; onLogout: () => void }) {
  const [nick, setNick] = useState(me.nickname);
  const [photo, setPhoto] = useState(me.photo || "");
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErr("Por favor, selecione um arquivo de imagem (PNG, JPG, WebP, etc.)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr("A imagem selecionada é muito grande (máximo 10MB)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setErr("");
    const reader = new FileReader();
    reader.onerror = () => setErr("Falha ao ler o arquivo");
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => setErr("Falha ao processar a imagem");
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const MAX_DIM = 256;
          const size = Math.min(img.width, img.height);
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;
          const targetDim = Math.min(size, MAX_DIM);
          canvas.width = targetDim;
          canvas.height = targetDim;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, startX, startY, size, size, 0, 0, targetDim, targetDim);
            let dataUrl = canvas.toDataURL("image/webp", 0.85);
            if (!dataUrl.startsWith("data:image/webp")) {
              dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            }
            setPhoto(dataUrl);
          } else {
            setPhoto(reader.result as string);
          }
        } catch {
          setPhoto(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleRemovePhoto = () => {
    setPhoto("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(""); setErr("");
    const res = await fetch("/api/me", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", nickname: nick, photo: photo || null })
    }).then(r => r.json());
    setBusy(false);
    if (res.error) setErr(res.error);
    else { setMsg("Perfil atualizado!"); onUpdate(); }
  };

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(""); setErr("");
    const res = await fetch("/api/me", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", oldPin, newPin })
    }).then(r => r.json());
    setBusy(false);
    if (res.error) setErr(res.error);
    else { setMsg("Senha alterada!"); setOldPin(""); setNewPin(""); }
  };

  const deleteAccount = async () => {
    const pin = prompt("Tem certeza? Digite seu PIN atual para excluir a conta para sempre:");
    if (!pin) return;
    setBusy(true); setMsg(""); setErr("");
    const res = await fetch("/api/me", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", oldPin: pin })
    }).then(r => r.json());
    setBusy(false);
    if (res.error) setErr(res.error);
    else onLogout();
  };

  return (
    <div className="view">
      <section className="card">
        <h2 className="card-title"><IconSettings /> Configurações de Perfil</h2>
        {msg && <div className="toast" style={{position:'static', marginBottom:'1rem', background:'var(--ok)', color:'#fff'}}>{msg}</div>}
        {err && <div className="toast" style={{position:'static', marginBottom:'1rem'}}>{err}</div>}
        
        <form onSubmit={saveProfile} style={{display:'flex', flexDirection:'column', gap:'1.25rem', marginBottom:'2rem'}}>
          <div>
            <label className="eyebrow" style={{display:'block', marginBottom:'0.75rem'}}>Foto de Perfil</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <Avatar name={nick} photo={photo} className="xl" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="avatar-file-input"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="avatar-file-input" className="btn btn-sm" style={{ cursor: 'pointer' }}>
                    <IconUpload /> {photo ? "Trocar imagem" : "Anexar imagem"}
                  </label>
                  {photo && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: 'var(--err)', borderColor: 'rgba(255, 123, 123, 0.3)' }}
                      onClick={handleRemovePhoto}
                    >
                      <IconTrash /> Remover
                    </button>
                  )}
                </div>
                <span className="mute" style={{ fontSize: '0.8rem' }}>
                  Anexe uma imagem do seu dispositivo (PNG, JPG, WebP).
                </span>
              </div>
            </div>
          </div>
          <div>
            <label className="eyebrow" style={{display:'block', marginBottom:'0.5rem'}}>Apelido</label>
            <input className="input" type="text" value={nick} onChange={e => setNick(e.target.value)} minLength={2} maxLength={20} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>Salvar Perfil</button>
        </form>

        <hr style={{border:'none', borderTop:'1px solid var(--line)', margin:'2rem 0'}} />
        <h2 className="card-title">Mudar PIN</h2>
        <form onSubmit={savePin} style={{display:'flex', flexDirection:'column', gap:'1rem', marginBottom:'2rem'}}>
          <div>
            <label className="eyebrow" style={{display:'block', marginBottom:'0.5rem'}}>PIN Atual</label>
            <input className="input" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, ''))} required />
          </div>
          <div>
            <label className="eyebrow" style={{display:'block', marginBottom:'0.5rem'}}>Novo PIN</label>
            <input className="input" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} required />
          </div>
          <button type="submit" className="btn" disabled={busy || newPin.length !== 4 || oldPin.length !== 4}>Alterar PIN</button>
        </form>

        <hr style={{border:'none', borderTop:'1px solid var(--line)', margin:'2rem 0'}} />
        <h2 className="card-title" style={{color:'var(--err)'}}>Zona de Perigo</h2>
        <button className="btn" style={{color:'var(--err)', borderColor:'rgba(255, 123, 123, 0.3)'}} disabled={busy} onClick={deleteAccount}>Excluir minha conta</button>
      </section>
    </div>
  );
}
