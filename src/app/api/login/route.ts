import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import crypto from "crypto";

function hashPin(pin: string) {
  // Sal estatico simples porque os PINs sao de 4 digitos
  return crypto.scryptSync(pin, "tic-tac-time-salt", 32).toString("hex");
}

export async function POST(req: Request) {
  const { nickname, pin } = await req.json();
  const n = String(nickname ?? "").trim().slice(0, 20);
  const p = String(pin ?? "").trim();
  
  if (n.length < 2) return Response.json({ error: "Use pelo menos 2 letras no apelido" }, { status: 400 });
  if (p.length !== 4 || !/^\d{4}$/.test(p)) return Response.json({ error: "O PIN deve ter 4 números" }, { status: 400 });

  let u = (await db.select().from(users).where(eq(users.nickname, n)))[0];
  
  if (!u) {
    // Nova conta
    u = { 
      id: crypto.randomUUID(), 
      nickname: n, 
      pin: hashPin(p),
      attempts: 0,
      lockedAt: null,
      points: 0, wins: 0, losses: 0, draws: 0, photo: null 
    };
    await db.insert(users).values(u);
  } else {
    // Conta existente: checa se ta bloqueada (15 min)
    if (u.lockedAt && Date.now() - u.lockedAt < 15 * 60 * 1000) {
       const left = Math.ceil((15 * 60 * 1000 - (Date.now() - u.lockedAt)) / 60000);
       return Response.json({ error: `Bloqueado. Tente em ${left} min` }, { status: 403 });
    }
    
    // Se for conta antiga sem PIN, o primeiro login define o PIN
    if (!u.pin) {
       await db.update(users).set({ pin: hashPin(p) }).where(eq(users.id, u.id));
    } else if (u.pin !== hashPin(p)) {
       const attempts = (u.lockedAt ? 0 : u.attempts) + 1;
       if (attempts >= 5) {
         await db.update(users).set({ attempts: 0, lockedAt: Date.now() }).where(eq(users.id, u.id));
         return Response.json({ error: "Conta bloqueada por 15 minutos" }, { status: 403 });
       }
       await db.update(users).set({ attempts }).where(eq(users.id, u.id));
       return Response.json({ error: `PIN incorreto. Restam ${5 - attempts} tentativas` }, { status: 401 });
    }
    
    // Sucesso
    if (u.attempts > 0 || u.lockedAt) {
       await db.update(users).set({ attempts: 0, lockedAt: null }).where(eq(users.id, u.id));
    }
  }
  
  (await cookies()).set("uid", u.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
  return Response.json({ ok: true });
}
