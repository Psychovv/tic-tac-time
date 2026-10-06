import { and, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { matches, users } from "@/db/schema";
import { me } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await me();
  const ranking = await db
    .select({ id: users.id, nickname: users.nickname, points: users.points, wins: users.wins, photo: users.photo })
    .from(users).orderBy(desc(users.points)).limit(10);
  if (!u) return Response.json({ me: null, ranking, waiting: [], challenges: [] });

  // Desafios públicos abertos (não privados e sem alvo específico)
  const waiting = await db
    .select({ id: matches.id, host: users.nickname, photo: users.photo })
    .from(matches).innerJoin(users, eq(users.id, matches.hostId))
    .where(and(
      eq(matches.status, "waiting"),
      eq(matches.isPrivate, 0),
      isNull(matches.targetId),
      ne(matches.hostId, u.id),
      gt(matches.createdAt, Date.now() - 600_000)
    ))
    .limit(20);

  // Desafios diretos enviados especificamente para o usuário
  const challenges = await db
    .select({ id: matches.id, host: users.nickname, photo: users.photo, createdAt: matches.createdAt })
    .from(matches).innerJoin(users, eq(users.id, matches.hostId))
    .where(and(
      eq(matches.status, "waiting"),
      eq(matches.targetId, u.id),
      gt(matches.createdAt, Date.now() - 600_000)
    ))
    .limit(5);

  const mine = (await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(inArray(matches.status, ["waiting", "playing"]), or(eq(matches.hostId, u.id), eq(matches.guestId, u.id))))
    .limit(1))[0] ?? null;

  return Response.json({
    me: { id: u.id, nickname: u.nickname, points: u.points, photo: u.photo },
    waiting,
    challenges,
    mine,
    ranking,
  });
}
