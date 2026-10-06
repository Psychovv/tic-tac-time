import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function me() {
  const id = (await cookies()).get("uid")?.value;
  if (!id) return null;
  return (await db.select().from(users).where(eq(users.id, id)))[0] ?? null;
}
