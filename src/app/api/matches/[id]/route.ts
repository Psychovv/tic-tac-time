import { and, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { matches, users } from "@/db/schema";
import { me } from "@/lib/auth";
import { MOVES, result, rpsRound, winsNeeded, type Move } from "@/lib/game";
import {
  allSunk, CELLS, emptyShots, parseFleet, parseShots, shotViews,
  validateFleet, type Ship, type Shots,
} from "@/lib/naval";

type Ctx = { params: Promise<{ id: string }> };
type Match = typeof matches.$inferSelect;

function navalFields(m: Match, uid: string) {
  if (m.game !== "naval") return {};
  const isHost = m.hostId === uid, isGuest = m.guestId === uid;
  const hostFleet = parseFleet(m.hostFleet);
  const guestFleet = parseFleet(m.guestFleet);
  const shots = parseShots(m.shots);
  const myFleet = isHost ? hostFleet : isGuest ? guestFleet : null;
  const oppFleet = isHost ? guestFleet : isGuest ? hostFleet : null;
  const myShotList = isHost ? shots.host : isGuest ? shots.guest : [];
  const oppShotList = isHost ? shots.guest : isGuest ? shots.host : [];
  // Tiros seus sobre a frota inimiga (hit/sunk sem revelar o resto).
  // Tiros do oponente sobre a sua frota (sempre conhecidos no seu mar).
  const myShots = oppFleet ? shotViews(oppFleet, myShotList) : myShotList.map((cell) => ({ cell, hit: false, sunk: false }));
  const oppShots = myFleet ? shotViews(myFleet, oppShotList) : oppShotList.map((cell) => ({ cell, hit: false, sunk: false }));
  return {
    phase: m.phase,
    myFleet,
    myReady: Boolean(myFleet),
    oppReady: Boolean(oppFleet),
    myShots,
    oppShots,
    // Frota inimiga só no fim, para mostrar o que sobrou.
    oppFleet: m.status === "done" ? oppFleet : null,
  };
}

async function view(id: string, uid: string) {
  const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
  if (!m) return null;
  const ids = [m.hostId, m.guestId, m.targetId].filter(Boolean) as string[];
  const us = ids.length > 0
    ? await db.select({ id: users.id, nickname: users.nickname }).from(users).where(inArray(users.id, ids))
    : [];
  const name = (i: string | null) => us.find((x) => x.id === i)?.nickname ?? null;
  const isHost = m.hostId === uid, isGuest = m.guestId === uid;
  return {
    id: m.id, board: m.board, turn: m.turn, status: m.status, winner: m.winner,
    host: name(m.hostId), guest: name(m.guestId),
    target: name(m.targetId),
    isPrivate: m.isPrivate === 1,
    you: isHost ? "X" : isGuest ? "O" : null,
    // Pedra, papel e tesoura. A jogada do adversario NUNCA sai daqui: so se ele ja jogou.
    // A revelacao vem em `last` depois que os dois jogaram.
    game: m.game, bestOf: m.bestOf,
    hostScore: m.hostScore, guestScore: m.guestScore, round: m.round,
    last: m.last ? JSON.parse(m.last) : null,
    myMove: isHost ? m.hostMove : isGuest ? m.guestMove : null,
    oppPicked: Boolean(isHost ? m.guestMove : isGuest ? m.hostMove : null),
    ...navalFields(m, uid),
  };
}

// Pontos: jogo da velha / batalha naval: vitoria +3, empate 0, derrota 0.
// Pedra, papel e tesoura: vitoria da partida +1, derrota 0 (sem empate de partida).
async function score(tx: any, m: Match, r: "X" | "O" | "draw") {
  if (r === "draw") {
    if (m.game === "rps" || m.game === "naval") return;
    for (const id of [m.hostId, m.guestId])
      await tx.update(users).set({ draws: sql`draws + 1` }).where(eq(users.id, id!));
    return;
  }
  const [w, l] = r === "X" ? [m.hostId, m.guestId] : [m.guestId, m.hostId];
  const pts = m.game === "rps" ? 1 : 3;
  await tx.update(users).set({ points: sql`points + ${pts}`, wins: sql`wins + 1` }).where(eq(users.id, w!));
  await tx.update(users).set({ losses: sql`losses + 1` }).where(eq(users.id, l!));
}

// Resolve a rodada de pedra, papel e tesoura quando os dois ja jogaram.
// Idempotente: a trava por `round` garante que so uma requisicao concorrente aplica o resultado.
async function resolveRound(id: string) {
  const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
  if (!m || m.game !== "rps" || m.status !== "playing" || !m.hostMove || !m.guestMove) return;
  const w = rpsRound(m.hostMove as Move, m.guestMove as Move);
  const hostScore = m.hostScore + (w === "X" ? 1 : 0);
  const guestScore = m.guestScore + (w === "O" ? 1 : 0);
  const need = winsNeeded(m.bestOf);
  const final = hostScore >= need ? "X" : guestScore >= need ? "O" : null;
  const round = m.round + 1;
  await db.transaction(async (tx) => {
    const upd = await tx.update(matches)
      .set({
        hostMove: null, guestMove: null, hostScore, guestScore, round,
        last: JSON.stringify({ n: round, h: m.hostMove, g: m.guestMove, w }),
        status: final ? "done" : "playing", winner: final, updatedAt: Date.now(),
      })
      .where(and(
        eq(matches.id, id), eq(matches.status, "playing"), eq(matches.round, m.round),
        isNotNull(matches.hostMove), isNotNull(matches.guestMove),
      ));
    if (upd.rowsAffected === 0) return;
    if (final) await score(tx, m, final);
  });
}

function woResult(m: Match): "X" | "O" | "draw" {
  if (m.game === "rps") {
    return m.hostMove && !m.guestMove ? "X" : m.guestMove && !m.hostMove ? "O" : "draw";
  }
  if (m.game === "naval") {
    if (m.phase === "place") {
      const h = Boolean(m.hostFleet), g = Boolean(m.guestFleet);
      if (h && !g) return "X";
      if (g && !h) return "O";
      return "draw";
    }
    // battle: quem esta na vez perde
    return m.turn === "X" ? "O" : "X";
  }
  return m.turn === "X" ? "O" : "X";
}

export async function GET(_: Request, { params }: Ctx) {
  const u = await me();
  if (!u) return Response.json({ error: "Faca login" }, { status: 401 });
  const { id } = await params;

  // Logica de abandono de partida (W.O.)
  const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
  if (m && m.status === "playing") {
    const lastActive = m.updatedAt ?? m.createdAt;
    if (lastActive < Date.now() - 300_000) { // 5 minutos de inatividade
      const res = woResult(m);
      try {
        await db.transaction(async (tx) => {
          const upd = await tx.update(matches)
            .set({ status: "done", winner: res, updatedAt: Date.now() })
            .where(and(eq(matches.id, m.id), eq(matches.status, "playing")));
          if (upd.rowsAffected > 0) {
            await score(tx, m, res);
          }
        });
      } catch {}
    }
  }

  const v = await view(id, u.id);
  return v ? Response.json(v) : Response.json({ error: "Partida nao encontrada" }, { status: 404 });
}

export async function POST(req: Request, { params }: Ctx) {
  const u = await me();
  if (!u) return Response.json({ error: "Faca login" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { action, cell, move, ships } = body;
  const now = Date.now();

  if (action === "accept") {
    const current = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    if (!current) return Response.json({ error: "Partida não encontrada" }, { status: 404 });
    if (current.hostId === u.id) return Response.json({ error: "Você é o criador desta partida" }, { status: 400 });
    if (current.status !== "waiting") return Response.json({ error: "Este convite já foi aceito ou encerrado" }, { status: 409 });
    if (current.targetId && current.targetId !== u.id) {
      return Response.json({ error: "Este desafio foi enviado para outro jogador" }, { status: 403 });
    }

    // Atomico: so o alvo ou qualquer um (se sem alvo) consegue aceitar.
    const r = await db.update(matches).set({ guestId: u.id, status: "playing", updatedAt: now })
      .where(and(
        eq(matches.id, id),
        eq(matches.status, "waiting"),
        ne(matches.hostId, u.id),
        or(isNull(matches.targetId), eq(matches.targetId, u.id))
      ));
    if (r.rowsAffected === 0) return Response.json({ error: "Convite indisponível" }, { status: 409 });
  } else if (action === "decline") {
    const r = await db.delete(matches).where(
      and(eq(matches.id, id), eq(matches.status, "waiting"), eq(matches.targetId, u.id))
    );
    if (r.rowsAffected === 0) return Response.json({ error: "Desafio indisponível" }, { status: 404 });
    return Response.json({ ok: true });
  } else if (action === "cancel") {
    await db.delete(matches).where(and(eq(matches.id, id), eq(matches.hostId, u.id), eq(matches.status, "waiting")));
    return Response.json({ ok: true });
  } else if (action === "move") {
    const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    if (!m || m.game !== "ttt" || m.status !== "playing") return Response.json({ error: "Partida nao esta em andamento" }, { status: 409 });
    const sym = m.hostId === u.id ? "X" : m.guestId === u.id ? "O" : null;
    if (!sym || sym !== m.turn) return Response.json({ error: "Nao e a sua vez" }, { status: 400 });
    if (!Number.isInteger(cell) || cell < 0 || cell > 8 || m.board[cell] !== ".")
      return Response.json({ error: "Jogada invalida" }, { status: 400 });
    const board = m.board.slice(0, cell) + sym + m.board.slice(cell + 1);
    const res = result(board);
    // Trava otimista e atualizacao de pontos em transacao atomica.
    try {
      await db.transaction(async (tx) => {
        const upd = await tx.update(matches)
          .set({ board, turn: sym === "X" ? "O" : "X", status: res ? "done" : "playing", winner: res, updatedAt: now })
          .where(and(eq(matches.id, id), eq(matches.board, m.board), eq(matches.status, "playing")));
        if (upd.rowsAffected === 0) throw new Error("optimistic_lock_failed");
        if (res) await score(tx, m, res);
      });
    } catch (e: any) {
      if (e.message === "optimistic_lock_failed") {
        return Response.json({ error: "Tente novamente" }, { status: 409 });
      }
      throw e;
    }
  } else if (action === "pick") {
    const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    if (!m || m.game !== "rps" || m.status !== "playing") return Response.json({ error: "Partida nao esta em andamento" }, { status: 409 });
    const isHost = m.hostId === u.id;
    if (!isHost && m.guestId !== u.id) return Response.json({ error: "Voce nao esta nesta partida" }, { status: 403 });
    if (!MOVES.includes(move)) return Response.json({ error: "Jogada invalida" }, { status: 400 });
    // Atomico: so grava se voce ainda nao jogou nesta rodada (jogada nao pode ser trocada).
    const r = await db.update(matches)
      .set(isHost ? { hostMove: move, updatedAt: now } : { guestMove: move, updatedAt: now })
      .where(and(eq(matches.id, id), eq(matches.status, "playing"), isNull(isHost ? matches.hostMove : matches.guestMove)));
    if (r.rowsAffected === 0) return Response.json({ error: "Voce ja jogou nesta rodada" }, { status: 409 });
    await resolveRound(id);
  } else if (action === "place") {
    const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    if (!m || m.game !== "naval" || m.status !== "playing" || m.phase !== "place")
      return Response.json({ error: "Partida nao esta em posicionamento" }, { status: 409 });
    const isHost = m.hostId === u.id;
    if (!isHost && m.guestId !== u.id) return Response.json({ error: "Voce nao esta nesta partida" }, { status: 403 });
    if (!validateFleet(ships)) return Response.json({ error: "Frota invalida" }, { status: 400 });
    const fleetCol = isHost ? matches.hostFleet : matches.guestFleet;
    if (isHost ? m.hostFleet : m.guestFleet)
      return Response.json({ error: "Voce ja posicionou a frota" }, { status: 409 });

    const fleetJson = JSON.stringify(ships as Ship[]);
    const r = await db.update(matches)
      .set({
        ...(isHost ? { hostFleet: fleetJson } : { guestFleet: fleetJson }),
        updatedAt: now,
      })
      .where(and(
        eq(matches.id, id),
        eq(matches.status, "playing"),
        eq(matches.phase, "place"),
        isNull(fleetCol),
      ));
    if (r.rowsAffected === 0) return Response.json({ error: "Nao foi possivel posicionar" }, { status: 409 });

    // Se os dois ja posicionaram (corrida inclusa), avanca para combate.
    const turn = Math.random() > 0.5 ? "X" : "O";
    await db.update(matches)
      .set({ phase: "battle", turn, updatedAt: Date.now() })
      .where(and(
        eq(matches.id, id),
        eq(matches.status, "playing"),
        eq(matches.phase, "place"),
        isNotNull(matches.hostFleet),
        isNotNull(matches.guestFleet),
      ));
  } else if (action === "fire") {
    const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    if (!m || m.game !== "naval" || m.status !== "playing" || m.phase !== "battle")
      return Response.json({ error: "Partida nao esta em combate" }, { status: 409 });
    const isHost = m.hostId === u.id;
    if (!isHost && m.guestId !== u.id) return Response.json({ error: "Voce nao esta nesta partida" }, { status: 403 });
    const sym = isHost ? "X" : "O";
    if (sym !== m.turn) return Response.json({ error: "Nao e a sua vez" }, { status: 400 });
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS)
      return Response.json({ error: "Jogada invalida" }, { status: 400 });

    const shots: Shots = parseShots(m.shots);
    const myList = isHost ? shots.host : shots.guest;
    if (myList.includes(cell)) return Response.json({ error: "Celula ja atacada" }, { status: 400 });

    const oppFleet = parseFleet(isHost ? m.guestFleet : m.hostFleet);
    if (!oppFleet) return Response.json({ error: "Frota inimiga ausente" }, { status: 409 });

    const nextList = [...myList, cell];
    const nextShots: Shots = isHost
      ? { host: nextList, guest: shots.guest }
      : { host: shots.host, guest: nextList };
    const hit = oppFleet.some((s) => s.cells.includes(cell));
    const won = allSunk(oppFleet, nextList);
    const nextTurn = won ? m.turn : hit ? m.turn : (m.turn === "X" ? "O" : "X");
    const shotsJson = JSON.stringify(nextShots);
    const prevShots = m.shots ?? JSON.stringify(emptyShots());

    try {
      await db.transaction(async (tx) => {
        const upd = await tx.update(matches)
          .set({
            shots: shotsJson,
            turn: nextTurn,
            status: won ? "done" : "playing",
            winner: won ? sym : null,
            updatedAt: now,
          })
          .where(and(
            eq(matches.id, id),
            eq(matches.status, "playing"),
            eq(matches.phase, "battle"),
            eq(matches.turn, m.turn),
            eq(matches.shots, prevShots),
          ));
        if (upd.rowsAffected === 0) throw new Error("optimistic_lock_failed");
        if (won) await score(tx, m, sym);
      });
    } catch (e: any) {
      if (e.message === "optimistic_lock_failed") {
        return Response.json({ error: "Tente novamente" }, { status: 409 });
      }
      throw e;
    }
  } else if (action === "rematch") {
    const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    if (!m) return Response.json({ error: "Partida não encontrada" }, { status: 404 });
    const opponentId = u.id === m.hostId ? m.guestId : m.hostId;

    // Verifica se o oponente já criou uma partida esperando (do mesmo jogo/formato)
    const existing = await db.select().from(matches).where(
      and(eq(matches.status, "waiting"), eq(matches.hostId, opponentId!), eq(matches.game, m.game), eq(matches.bestOf, m.bestOf))
    ).limit(1);

    if (existing[0]) {
      await db.update(matches).set({ guestId: u.id, status: "playing", updatedAt: now }).where(eq(matches.id, existing[0].id));
      return Response.json({ id: existing[0].id });
    } else {
      const newId = crypto.randomUUID();
      const turn = Math.random() > 0.5 ? "X" : "O";
      await db.insert(matches).values({
        id: newId,
        hostId: u.id,
        targetId: opponentId,
        isPrivate: 1,
        turn,
        game: m.game,
        bestOf: m.bestOf,
        ...(m.game === "naval" ? {
          phase: "place",
          shots: JSON.stringify(emptyShots()),
        } : {}),
        createdAt: now,
        updatedAt: now,
      });
      return Response.json({ id: newId });
    }
  } else return Response.json({ error: "Acao invalida" }, { status: 400 });

  return Response.json(await view(id, u.id));
}
