import { withSignedInDesk } from "@/lib/guard";
import { FetchError } from "@/lib/http";
import { removeProfile, saveProfile } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PUT(request: Request) {
  return withSignedInDesk(async () => {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      domain?: string;
      preferredRoles?: string;
      levels?: string[];
      keywords?: string;
      email?: string;
    };
    return saveProfile(body);
  });
}

export function DELETE(request: Request) {
  return withSignedInDesk(async () => {
    const body = (await request.json()) as { id?: string };
    if (!body.id) throw new FetchError("That profile is not on the desk.");
    return removeProfile(body.id);
  });
}
