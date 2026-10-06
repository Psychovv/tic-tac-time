import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { me } from "@/lib/auth";
import crypto from "crypto";

function hashPin(pin: string) {
  return crypto.scryptSync(pin, "tic-tac-time-salt", 32).toString("hex");
}

export async function POST(req: Request) {
  const u = await me();
  if (!u) return Response.json({ error: "Faça login" }, { status: 401 });

  const { action, nickname, photo, oldPin, newPin } = await req.json();

  if (action === "update") {
    const updates: any = {};
    if (nickname && nickname !== u.nickname) {
      const n = String(nickname).trim().slice(0, 20);
      if (n.length < 2) return Response.json({ error: "Use pelo menos 2 letras no apelido" }, { status: 400 });
      // Verifica se apelido ja existe
      const existing = (await db.select().from(users).where(eq(users.nickname, n)))[0];
      if (existing) return Response.json({ error: "Este apelido já está em uso" }, { status: 400 });
      updates.nickname = n;
    }

    if (photo !== undefined) {
      if (photo === null || photo === "") {
        updates.photo = null;
      } else if (typeof photo === "string") {
        if (photo.startsWith("http://") || photo.startsWith("https://")) {
          return Response.json({ error: "A foto de perfil deve ser anexada como imagem e não como URL" }, { status: 400 });
        }
        if (!photo.startsWith("data:image/")) {
          return Response.json({ error: "A foto de perfil deve ser anexada como imagem" }, { status: 400 });
        }
        if (photo.length > 2 * 1024 * 1024) {
          return Response.json({ error: "A imagem anexada é muito grande" }, { status: 400 });
        }
        updates.photo = photo;
      } else {
        return Response.json({ error: "Formato de imagem inválido" }, { status: 400 });
      }
    }

    if (oldPin && newPin) {
      if (!u.pin || u.pin !== hashPin(oldPin)) {
        return Response.json({ error: "PIN antigo incorreto" }, { status: 400 });
      }
      const p = String(newPin).trim();
      if (p.length !== 4 || !/^\d{4}$/.test(p)) return Response.json({ error: "O novo PIN deve ter 4 números" }, { status: 400 });
      updates.pin = hashPin(p);
    }

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, u.id));
    }
    return Response.json({ ok: true });
  }

  if (action === "delete") {
    // Para deletar, vamos pedir a senha atual para confirmar
    if (!oldPin) return Response.json({ error: "PIN obrigatório para excluir a conta" }, { status: 400 });
    if (!u.pin || u.pin !== hashPin(oldPin)) {
      return Response.json({ error: "PIN incorreto" }, { status: 400 });
    }
    await db.delete(users).where(eq(users.id, u.id));
    (await cookies()).delete("uid");
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Ação inválida" }, { status: 400 });
}
