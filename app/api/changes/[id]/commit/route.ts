// Commit. The community's side completes here, and the instrument of consent is issued.
//
// What does not happen here: this route does not put a role in anyone's token. With a
// TideCloak realm the grant is carried by the realm's own IGA quorum and signed by the
// network, and every gate re-reads the token regardless — which is why no amount of access
// to this server produces a permit.

import { handle, requireUser, httpError } from "@/lib/identity/verify";
import { commit, get, GovernanceError, proofChain } from "@/lib/registry/changes";
import { buildPermitInstrument } from "@/lib/documents/instruments";
import { prisma } from "@/lib/db";
import { record } from "@/lib/registry/audit";
import { remember } from "@/lib/registry/users";
import { identityMode } from "@/lib/identity/mode";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "custodian");
    await remember(user);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { tideGrantRef?: string };

    try {
      const committed = await commit(id, user, body.tideGrantRef);
      const proofs = proofChain(committed);

      if (committed.type !== "PERMIT_REVOCATION") {
        const doc = await buildPermitInstrument(committed, proofs);
        await prisma.noticeDocument.create({
          data: {
            changeRequestId: committed.id,
            kind: "PERMIT_INSTRUMENT",
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
          target: committed.ref,
          detail: { kind: "PERMIT_INSTRUMENT", sha256: doc.sha256 },
        });
      }

      const after = (await get(id))!;
      const note =
        identityMode() === "tidecloak"
          ? after.subjectName +
            " holds the permit once the network signs " +
            after.grantedRole +
            " into their token. Consent is complete; this register cannot do that part."
          : "Simulated identity: the provider will now issue " +
            after.grantedRole +
            " to " +
            after.subjectName +
            " - they have to refresh their token before the permit exists for them.";

      return Response.json({
        state: after.state,
        proofs: proofChain(after),
        grantedRole: after.grantedRole,
        tokenNote: note,
      });
    } catch (err) {
      if (err instanceof GovernanceError) throw httpError(err.status, err.code, err.message);
      throw err;
    }
  });
}
