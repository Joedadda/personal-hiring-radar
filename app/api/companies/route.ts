import { addCompany } from "@/lib/pipeline";
import { jsonError } from "@/lib/respond";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    return NextResponse.json(await addCompany(body.url || ""));
  } catch (error) {
    return jsonError(error);
  }
}
