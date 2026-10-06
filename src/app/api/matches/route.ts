import { and, eq, inArray, or, lt } from "drizzle-orm";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { me } from "@/lib/auth";

// Cria um convite "procurando partida" (ou devolve a partida aberta do usuario).
export async function POST() {
  const u = await me();
  if (!u) return Response.json({ error: "Faca login" }, { status: 401 });

  // Limpa convites 'waiting' muito antigos (mais de 10 minutos)
  await db.delete(matches).where(
    and(eq(matches.status, "waiting"), lt(matches.createdAt, Date.now() - 600_000))
  );

  const open = (await db.select().from(matches).where(
    and(inArray(matches.status, ["waiting", "playing"]), or(eq(matches.hostId, u.id), eq(matches.guestId, u.id)))
  ))[0];
  
  if (open) return Response.json({ id: open.id });
  
  const id = crypto.randomUUID();
  const now = Date.now();
  const turn = Math.random() > 0.5 ? "X" : "O";
  await db.insert(matches).values({ id, hostId: u.id, turn, createdAt: now, updatedAt: now });
  return Response.json({ id });
}
