import { headers } from "next/headers";
import { getAuth } from "./auth";
import { ensureSchema } from "./postgres";

export async function currentSession() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  await ensureSchema();
  return getAuth().api.getSession({ headers: await headers() });
}
