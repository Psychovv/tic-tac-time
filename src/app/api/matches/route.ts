import { and, eq, inArray, or, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { matches, users } from "@/db/schema";
import { me } from "@/lib/auth";
import { BEST_OF } from "@/lib/game";

// Cria um convite "procurando partida", link privado ou desafio direto para jogador.
export async function POST(req: Request) {
  const u = await me();
  if (!u) return Response.json({ error: "Faça login" }, { status: 401 });

  let body: { isPrivate?: boolean; targetNickname?: string; targetId?: string; game?: string; bestOf?: number } = {};
  try {
    body = await req.json();
  } catch {}

  const game = body.game === "rps" ? "rps" : "ttt";
  const bestOf = game === "rps" && (BEST_OF as readonly number[]).includes(Number(body.bestOf)) ? Number(body.bestOf) : 1;

  let targetUser: typeof users.$inferSelect | null = null;
  if (body.targetNickname) {
    const tNick = body.targetNickname.trim();
    if (tNick.toLowerCase() === u.nickname.toLowerCase()) {
      return Response.json({ error: "Você não pode desafiar a si mesmo" }, { status: 400 });
    }
    const found = (await db.select().from(users).where(sql`lower(${users.nickname}) = lower(${tNick})`))[0];
    if (!found) return Response.json({ error: `Jogador "${tNick}" não encontrado` }, { status: 404 });
    targetUser = found;
  } else if (body.targetId) {
    if (body.targetId === u.id) {
      return Response.json({ error: "Você não pode desafiar a si mesmo" }, { status: 400 });
    }
    const found = (await db.select().from(users).where(eq(users.id, body.targetId)))[0];
    if (!found) return Response.json({ error: "Jogador não encontrado" }, { status: 404 });
    targetUser = found;
  }

  // Limpa convites 'waiting' muito antigos (mais de 10 minutos)
  await db.delete(matches).where(
    and(eq(matches.status, "waiting"), lt(matches.createdAt, Date.now() - 600_000))
  );

  // Se já está numa partida em andamento, retorna ela
  const playing = (await db.select().from(matches).where(
    and(eq(matches.status, "playing"), or(eq(matches.hostId, u.id), eq(matches.guestId, u.id)))
  ))[0];
  if (playing) return Response.json({ id: playing.id });

  // Se já tem partida 'waiting' criada pelo usuário
  const myWaiting = (await db.select().from(matches).where(
    and(eq(matches.status, "waiting"), eq(matches.hostId, u.id))
  ))[0];

  const wantsSpecific = Boolean(body.isPrivate || targetUser);
  if (myWaiting) {
    // Mesmo tipo de convite (e mesma configuracao de jogo): so devolve o que ja existe.
    if (!wantsSpecific && myWaiting.game === game && myWaiting.bestOf === bestOf) {
      return Response.json({ id: myWaiting.id });
    }
    // Cancela o waiting anterior para criar o novo desafio solicitado
    await db.delete(matches).where(eq(matches.id, myWaiting.id));
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const turn = Math.random() > 0.5 ? "X" : "O";
  const isPrivate = wantsSpecific ? 1 : 0;
  const targetId = targetUser ? targetUser.id : null;

  await db.insert(matches).values({
    id,
    hostId: u.id,
    targetId,
    isPrivate,
    turn,
    game,
    bestOf,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({
    id,
    isPrivate: isPrivate === 1,
    targetNickname: targetUser?.nickname ?? null,
  });
}

