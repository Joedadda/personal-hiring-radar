import { withSignedInDesk } from "@/lib/guard";
import { activateProfile } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withSignedInDesk(async () => {
    const body = (await request.json()) as { id?: string };
    return activateProfile(body.id || "");
  });
}
