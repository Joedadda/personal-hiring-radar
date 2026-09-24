import { removeCompany, scanCompany } from "@/lib/pipeline";
import { jsonError } from "@/lib/respond";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await scanCompany(id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await removeCompany(id));
  } catch (error) {
    return jsonError(error);
  }
}
