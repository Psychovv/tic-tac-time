import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { me } from "@/lib/auth";

// Cria um convite "procurando partida" (ou devolve a partida aberta do usuario).
export async function POST() {
  const u = await me();
  if (!u) return Response.json({ error: "Faca login" }, { status: 401 });
  const open = (await db.select().from(matches).where(
    and(inArray(matches.status, ["waiting", "playing"]), or(eq(matches.hostId, u.id), eq(matches.guestId, u.id)))
  ))[0];
  if (open) return Response.json({ id: open.id });
  const id = crypto.randomUUID();
  await db.insert(matches).values({ id, hostId: u.id, createdAt: Date.now() });
  return Response.json({ id });
}
