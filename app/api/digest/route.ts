import { deskUrl } from "@/lib/desk-url";
import { emailApplicableRoles } from "@/lib/pipeline";
import { jsonError } from "@/lib/respond";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await emailApplicableRoles(deskUrl(request)));
  } catch (error) {
    return jsonError(error);
  }
}
