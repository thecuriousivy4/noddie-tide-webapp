// Issue the notice. This is what moves a request out of DRAFT and opens it to the quorum,
// and it is also the first of the three proofs: the PDF's SHA-256 is written to the
// append-only log before any custodian has decided anything.

import { handle, requireUser, httpError } from "@/lib/identity/verify";
import { attachNotice, get, GovernanceError } from "@/lib/registry/changes";
import { buildWorksNotice } from "@/lib/documents/instruments";
import { remember } from "@/lib/registry/users";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "proponent", "minister", "custodian");
    await remember(user);
    const { id } = await params;
    const cr = await get(id);
    if (!cr) throw httpError(404, "NOT_FOUND", "No such change request.");
    if (cr.initiatorSub !== user.sub && !user.roles.includes("minister")) {
      throw httpError(
        403,
        "NOT_INITIATOR",
        "Only the initiator can issue the notice for this request.",
      );
    }

    try {
      const doc = await buildWorksNotice(cr);
      const updated = await attachNotice(
        id,
        {
          kind: cr.initiatorRole === "minister" ? "MINISTERIAL_ANNOUNCEMENT" : "WORKS_NOTICE",
          filename: doc.filename,
          sha256: doc.sha256,
          bytes: doc.bytes,
        },
        user,
      );
      return Response.json({
        state: updated.state,
        sha256: doc.sha256,
        filename: doc.filename,
        documentId: updated.documents.at(-1)?.id ?? null,
      });
    } catch (err) {
      if (err instanceof GovernanceError) throw httpError(err.status, err.code, err.message);
      throw err;
    }
  });
}
