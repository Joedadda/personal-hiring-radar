import { scanAll } from "@/lib/pipeline";
import { jsonError } from "@/lib/respond";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    return NextResponse.json(await scanAll());
  } catch (error) {
    return jsonError(error);
  }
}
