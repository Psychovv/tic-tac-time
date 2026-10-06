"use client";
import { useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const post = (url: string, body: object = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export default function Home() {
  const [hub, setHub] = useState<any>(null);
  const [mid, setMid] = useState<string | null>(null);
  const [m, setM] = useState<any>(null);
  const [nick, setNick] = useState("");
  const [err, setErr] = useState("");

  // Polling a cada 2s: hub (convites/ranking) e, se estiver numa partida, o estado dela.
  useEffect(() => {
    let on = true;
    const tick = async () => {
      const h = await fetch("/api/hub", { cache: "no-store" }).then((r) => r.json());
      if (!on) return;
      setHub(h);
      if (h.mine && !mid) setMid(h.mine.id);
      if (mid) {
        const r = await fetch(`/api/matches/${mid}`, { cache: "no-store" });
        if (r.ok && on) setM(await r.json());
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { on = false; clearInterval(t); };
  }, [mid]);

  const act = async (id: string, body: object) => {
    const r = await post(`/api/matches/${id}`, body);
    setErr(r.error ?? "");
    if (r.id) { setM(r); setMid(id); }
  };
  const leave = () => { setMid(null); setM(null); };

  if (!hub) return <main className="mute">Carregando…</main>;

  if (!hub.me) return (
    <main>
      <h1>Jogo da velha do setor</h1>
      <section>
        <h2>Como você quer ser chamado?</h2>
        <div className="row">
          <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Seu apelido" maxLength={20} />
          <button className="primary" onClick={async () => { const r = await post("/api/login", { nickname: nick }); setErr(r.error ?? ""); if (r.ok) location.reload(); }}>Entrar</button>
        </div>
        {err && <span className="err">{err}</span>}
      </section>
    </main>
  );

  if (mid && m) {
    const mine = m.you === m.turn;
    const status =
      m.status === "waiting" ? "Aguardando um adversário aceitar…" :
      m.status === "playing" ? (mine ? "Sua vez" : "Vez do adversário") :
      m.winner === "draw" ? "Empate (+1 ponto)" : m.winner === m.you ? "Você venceu! (+3 pontos)" : "Você perdeu";
    return (
      <main>
        <section>
          <div className="row"><h2>{m.host} <span className="X">X</span> vs {m.guest ?? "…"} <span className="O">O</span></h2><span className="mute">você é {m.you}</span></div>
          <div className="board">
            {[...m.board].map((c: string, i: number) => (
              <button key={i} className={`cell ${c}`} disabled={m.status !== "playing" || !mine || c !== "."} onClick={() => act(mid, { action: "move", cell: i })}>{c === "." ? "" : c}</button>
            ))}
          </div>
          <div className="row"><strong>{status}</strong>
            {m.status === "waiting" && <button onClick={async () => { await post(`/api/matches/${mid}`, { action: "cancel" }); leave(); }}>Cancelar</button>}
            {m.status === "done" && <button className="primary" onClick={leave}>Voltar ao hub</button>}
          </div>
          {err && <span className="err">{err}</span>}
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="row"><h1>Jogo da velha do setor</h1><span className="mute">{hub.me.nickname} · {hub.me.points} pts</span></div>
      <section>
        <div className="row"><h2>Procurando partida</h2>
          <button className="primary" onClick={async () => { const r = await post("/api/matches"); if (r.id) setMid(r.id); }}>Procurar partida</button></div>
        {hub.waiting.length === 0 && <span className="mute">Ninguém procurando agora. Puxe uma partida!</span>}
        {hub.waiting.map((w: any) => (
          <div className="row" key={w.id}><span>{w.host}</span><button onClick={() => act(w.id, { action: "accept" })}>Aceitar</button></div>
        ))}
        {err && <span className="err">{err}</span>}
      </section>
      <section>
        <h2>Ranking</h2>
        {hub.ranking.map((r: any, i: number) => (
          <div className="row" key={r.nickname}><span>{i + 1}. {r.nickname}</span><span className="mute">{r.wins} vitórias · <strong>{r.points} pts</strong></span></div>
        ))}
      </section>
    </main>
  );
}
