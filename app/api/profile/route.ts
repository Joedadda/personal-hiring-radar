import { saveProfile } from "@/lib/pipeline";
import { jsonError } from "@/lib/respond";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      domain?: string;
      preferredRoles?: string;
      levels?: string[];
      keywords?: string;
    };
    return NextResponse.json(await saveProfile(body));
  } catch (error) {
    return jsonError(error);
  }
}
