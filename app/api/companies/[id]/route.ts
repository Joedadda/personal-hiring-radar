import { withSignedInDesk } from "@/lib/guard";
import { removeCompany, scanCompany } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

export function POST(_request: Request, context: Context) {
  return withSignedInDesk(async () => {
    const { id } = await context.params;
    return scanCompany(id);
  });
}

export function DELETE(_request: Request, context: Context) {
  return withSignedInDesk(async () => {
    const { id } = await context.params;
    return removeCompany(id);
  });
}
