import { deskUrl } from "@/lib/desk-url";
import { withSignedInDesk } from "@/lib/guard";
import { emailApplicableRoles } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withSignedInDesk(() => emailApplicableRoles(deskUrl(request)));
}
