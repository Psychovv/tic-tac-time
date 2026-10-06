import { desc, or, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, matches } from "@/db/schema";
import { me } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await me();
  if (!u) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Pega o ranking completo
  const ranking = await db
    .select({ nickname: users.nickname, points: users.points, wins: users.wins, draws: users.draws, losses: users.losses })
    .from(users)
    .orderBy(desc(users.points));

  // Pega o histórico das últimas 20 partidas do usuário que já terminaram
  const history = await db
    .select()
    .from(matches)
    .where(
      or(
        eq(matches.hostId, u.id),
        eq(matches.guestId, u.id)
      )
    )
    .orderBy(desc(matches.createdAt))
    .limit(30);

  // Mapeia os ids pros nicks do historico
  const uIds = new Set<string>();
  for (const m of history) {
    uIds.add(m.hostId);
    if (m.guestId) uIds.add(m.guestId);
  }
  
  let userMap: Record<string, string> = {};
  if (uIds.size > 0) {
    const us = await db.select({ id: users.id, nickname: users.nickname }).from(users).where(or(...Array.from(uIds).map(id => eq(users.id, id))));
    for (const user of us) userMap[user.id] = user.nickname;
  }

  const historyMapped = history.filter(m => m.status === "done").map(m => ({
    id: m.id,
    host: userMap[m.hostId] ?? "Desconhecido",
    guest: m.guestId ? (userMap[m.guestId] ?? "Desconhecido") : "Desconhecido",
    winner: m.winner,
    you: m.hostId === u.id ? "X" : "O",
    createdAt: m.createdAt
  }));

  return Response.json({ ranking, history: historyMapped });
}
