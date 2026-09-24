import { deskUrl } from "@/lib/desk-url";
import { jsonError } from "@/lib/respond";
import { startDailyChecks } from "@/lib/schedule";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    void startDailyChecks(deskUrl(request)).catch((error) => {
      console.error(error);
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
