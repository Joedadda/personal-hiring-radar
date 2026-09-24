import { withSignedInDesk } from "@/lib/guard";
import { getState } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return withSignedInDesk(() => getState());
}
