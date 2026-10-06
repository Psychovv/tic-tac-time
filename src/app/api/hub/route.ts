import { and, desc, eq, gt, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { matches, users } from "@/db/schema";
import { me } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await me();
  const ranking = await db
    .select({ nickname: users.nickname, points: users.points, wins: users.wins })
    .from(users).orderBy(desc(users.points)).limit(10);
  if (!u) return Response.json({ me: null, ranking });

  const waiting = await db
    .select({ id: matches.id, host: users.nickname })
    .from(matches).innerJoin(users, eq(users.id, matches.hostId))
    .where(and(eq(matches.status, "waiting"), ne(matches.hostId, u.id), gt(matches.createdAt, Date.now() - 600_000)))
    .limit(20);
  const mine = (await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(inArray(matches.status, ["waiting", "playing"]), or(eq(matches.hostId, u.id), eq(matches.guestId, u.id))))
    .limit(1))[0] ?? null;

  return Response.json({ me: { nickname: u.nickname, points: u.points }, waiting, mine, ranking });
}
