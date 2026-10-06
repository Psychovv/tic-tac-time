import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { matches, users } from "@/db/schema";
import { me } from "@/lib/auth";
import { result } from "@/lib/game";

type Ctx = { params: Promise<{ id: string }> };
type Match = typeof matches.$inferSelect;

async function view(id: string, uid: string) {
  const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
  if (!m) return null;
  const ids = [m.hostId, m.guestId].filter(Boolean) as string[];
  const us = await db.select({ id: users.id, nickname: users.nickname }).from(users).where(inArray(users.id, ids));
  const name = (i: string | null) => us.find((x) => x.id === i)?.nickname ?? null;
  return {
    id: m.id, board: m.board, turn: m.turn, status: m.status, winner: m.winner,
    host: name(m.hostId), guest: name(m.guestId),
    you: m.hostId === uid ? "X" : m.guestId === uid ? "O" : null,
  };
}

// Pontos: vitoria +3, empate +1 cada, derrota 0.
async function score(tx: any, m: Match, r: "X" | "O" | "draw") {
  if (r === "draw") {
    for (const id of [m.hostId, m.guestId])
      await tx.update(users).set({ points: sql`points + 1`, draws: sql`draws + 1` }).where(eq(users.id, id!));
    return;
  }
  const [w, l] = r === "X" ? [m.hostId, m.guestId] : [m.guestId, m.hostId];
  await tx.update(users).set({ points: sql`points + 3`, wins: sql`wins + 1` }).where(eq(users.id, w!));
  await tx.update(users).set({ losses: sql`losses + 1` }).where(eq(users.id, l!));
}

export async function GET(_: Request, { params }: Ctx) {
  const u = await me();
  if (!u) return Response.json({ error: "Faca login" }, { status: 401 });
  const { id } = await params;

  // Lógica de Abandono de Partida (W.O.)
  const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
  if (m && m.status === "playing") {
    const lastActive = m.updatedAt ?? m.createdAt;
    if (lastActive < Date.now() - 300_000) { // 5 minutos de inatividade
      const res = m.turn === "X" ? "O" : "X"; // quem não jogou perde por W.O.
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
  const { action, cell } = await req.json();
  const now = Date.now();

  if (action === "accept") {
    // Atomico: so um jogador consegue aceitar.
    const r = await db.update(matches).set({ guestId: u.id, status: "playing", updatedAt: now })
      .where(and(eq(matches.id, id), eq(matches.status, "waiting"), ne(matches.hostId, u.id)));
    if (r.rowsAffected === 0) return Response.json({ error: "Convite indisponivel" }, { status: 409 });
  } else if (action === "cancel") {
    await db.delete(matches).where(and(eq(matches.id, id), eq(matches.hostId, u.id), eq(matches.status, "waiting")));
    return Response.json({ ok: true });
  } else if (action === "move") {
    const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    if (!m || m.status !== "playing") return Response.json({ error: "Partida nao esta em andamento" }, { status: 409 });
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
  } else if (action === "rematch") {
    const m = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    if (!m) return Response.json({ error: "Partida não encontrada" }, { status: 404 });
    const opponentId = u.id === m.hostId ? m.guestId : m.hostId;
    
    // Verifica se o oponente já criou uma partida esperando
    const existing = await db.select().from(matches).where(
      and(eq(matches.status, "waiting"), eq(matches.hostId, opponentId!))
    ).limit(1);

    if (existing[0]) {
      await db.update(matches).set({ guestId: u.id, status: "playing", updatedAt: now }).where(eq(matches.id, existing[0].id));
      return Response.json({ id: existing[0].id });
    } else {
      const newId = crypto.randomUUID();
      await db.insert(matches).values({ id: newId, hostId: u.id, createdAt: now, updatedAt: now });
      return Response.json({ id: newId });
    }
  } else return Response.json({ error: "Acao invalida" }, { status: 400 });

  return Response.json(await view(id, u.id));
}
