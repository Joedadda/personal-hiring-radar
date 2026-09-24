import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { ensureSchema } from "@/lib/postgres";
import { jsonError } from "@/lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request, method: "GET" | "POST") {
  try {
    await ensureSchema();
    const handler = toNextJsHandler(getAuth());
    return handler[method](request);
  } catch (error) {
    return jsonError(error);
  }
}

export function GET(request: Request) {
  return handle(request, "GET");
}

export function POST(request: Request) {
  return handle(request, "POST");
}
