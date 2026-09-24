import { getState, resetDesk } from "@/lib/pipeline";
import { jsonError } from "@/lib/respond";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getState());
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  try {
    return NextResponse.json(await resetDesk());
  } catch (error) {
    return jsonError(error);
  }
}
