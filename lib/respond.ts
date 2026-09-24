import { NextResponse } from "next/server";
import { FetchError } from "./http";

export function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const status = error instanceof FetchError ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}
