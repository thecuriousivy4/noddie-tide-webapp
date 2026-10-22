// Proponent clearance check. Returns public information only, and logs the enquiry.

import { handle, requireUser } from "@/lib/identity/verify";
import { run } from "@/lib/registry/clearance";
import { remember } from "@/lib/registry/users";
import { isValidCell } from "@/lib/grid";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(req, "proponent", "minister", "custodian");
    await remember(user);
    const body = (await req.json()) as { cells?: unknown };
    const cells = Array.isArray(body.cells) ? body.cells.map(String).filter(isValidCell) : [];
    if (cells.length === 0) {
      return Response.json(
        { error: { code: "NO_CELLS", message: "Select at least one zone to check." } },
        { status: 400 },
      );
    }
    return Response.json(await run(cells, user));
  });
}
