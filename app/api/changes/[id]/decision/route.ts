// One custodian's independent decision, taken from their own session.
//
// There is no route that records two decisions at once, and none that lets a non-custodian
// decide. A denial that puts the threshold out of reach rejects the request, and a refusal
// notice is issued — a "no" is recorded as formally as a "yes".

import { handle, requireUser, httpError } from "@/lib/identity/verify";
import { decide, get, GovernanceError, proofChain, tally } from "@/lib/registry/changes";
import { buildRefusalNotice } from "@/lib/documents/instruments";
import { prisma } from "@/lib/db";
import { record } from "@/lib/registry/audit";
import { remember } from "@/lib/registry/users";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "custodian");
    await remember(user);
    const { id } = await params;
    const body = (await req.json()) as { decision?: string; reason?: string };
    const decision =
      body.decision === "DENY" ? "DENY" : body.decision === "APPROVE" ? "APPROVE" : null;
    if (!decision) throw httpError(400, "BAD_DECISION", "decision must be APPROVE or DENY.");

    try {
      const updated = await decide(id, user, decision, body.reason);

      if (
        updated.state === "REJECTED" &&
        !updated.documents.some((d) => d.kind === "REFUSAL_NOTICE")
      ) {
        const doc = await buildRefusalNotice(updated);
        await prisma.noticeDocument.create({
          data: {
            changeRequestId: updated.id,
            kind: "REFUSAL_NOTICE",
            filename: doc.filename,
            sha256: doc.sha256,
            bytes: Buffer.from(doc.bytes),
            issuedBySub: user.sub,
            issuedByName: user.name,
          },
        });
        await record({
          actorSub: user.sub,
          actorName: user.name,
          actorRoles: user.roles,
          action: "document.issued",
          target: updated.ref,
          detail: { kind: "REFUSAL_NOTICE", sha256: doc.sha256 },
        });
      }

      const after = (await get(id))!;
      return Response.json({
        state: after.state,
        tally: tally(after),
        proofs: proofChain(after),
      });
    } catch (err) {
      if (err instanceof GovernanceError) throw httpError(err.status, err.code, err.message);
      throw err;
    }
  });
}
