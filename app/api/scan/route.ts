import { withSignedInDesk } from "@/lib/guard";
import { scanAll } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function POST() {
  return withSignedInDesk(() => scanAll());
}
