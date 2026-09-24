import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "./auth";
import { withDesk } from "./db";
import { ensureSchema } from "./postgres";
import { jsonError } from "./respond";

export async function withSignedInDesk(work: () => Promise<unknown> | unknown) {
  try {
    await ensureSchema();
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to use this desk." }, { status: 401 });
    }
    const body = await withDesk(session.user.id, () => work());
    return NextResponse.json(body);
  } catch (error) {
    return jsonError(error);
  }
}
