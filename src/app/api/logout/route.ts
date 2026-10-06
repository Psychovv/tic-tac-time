import { cookies } from "next/headers";

export async function POST() {
  (await cookies()).delete("uid");
  return Response.json({ ok: true });
}
