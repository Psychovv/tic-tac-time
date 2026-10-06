import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function POST(req: Request) {
  const { nickname } = await req.json();
  const n = String(nickname ?? "").trim().slice(0, 20);
  if (n.length < 2) return Response.json({ error: "Use pelo menos 2 caracteres" }, { status: 400 });
  let u = (await db.select().from(users).where(eq(users.nickname, n)))[0];
  if (!u) {
    u = { id: crypto.randomUUID(), nickname: n, points: 0, wins: 0, losses: 0, draws: 0 };
    await db.insert(users).values(u);
  }
  (await cookies()).set("uid", u.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
  return Response.json({ ok: true });
}
