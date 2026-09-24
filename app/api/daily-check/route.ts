import { deskUrl } from "@/lib/desk-url";
import { jsonError } from "@/lib/respond";
import { runDailyTick } from "@/lib/schedule";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await runDailyTick(deskUrl(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
