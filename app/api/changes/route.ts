// Change requests: the queue, and the way a new one is opened.
//
// A proponent or a minister may initiate. Neither can approve, and the initiator can never
// be one of the signatures (four-eyes is enforced in lib/registry/changes.ts).

import { handle, httpError, requireUser } from "@/lib/identity/verify";
import { GovernanceError, initiate, list, tally } from "@/lib/registry/changes";
import { remember } from "@/lib/registry/users";
import type { ChangeState, ChangeType } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: ChangeType[] = ["WORKS_PERMIT", "RESTRICTED_READ", "PERMIT_REVOCATION"];
const STATES: ChangeState[] = [
  "DRAFT",
  "NOTICE_ISSUED",
  "PENDING_QUORUM",
  "APPROVED",
  "REJECTED",
  "COMMITTED",
];

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    await remember(user);
    const url = new URL(req.url);
    const stateParam = url.searchParams.get("state");
    const mine = url.searchParams.get("mine") === "1";
    const state = STATES.find((s) => s === stateParam);

    const all = await list({
      ...(state ? { state } : {}),
      ...(mine ? { subjectSub: user.sub } : {}),
    });

    return Response.json({
      requests: all.map((cr) => ({
        id: cr.id,
        ref: cr.ref,
        type: cr.type,
        state: cr.state,
        title: cr.title,
        description: cr.description,
        placeRef: cr.place.publicRef,
        placeName: cr.place.publicName,
        community: cr.custodianOrg.name,
        consentRule: cr.custodianOrg.consentRule,
        initiatorName: cr.initiatorName,
        initiatorRole: cr.initiatorRole,
        subjectName: cr.subjectName,
        subjectSub: cr.subjectSub,
        grantedRole: cr.grantedRole,
        ministerConsent: cr.ministerConsent,
        noticePdfHash: cr.noticePdfHash,
        createdAt: cr.createdAt,
        committedAt: cr.committedAt,
        decidedAt: cr.decidedAt,
        rejectionReason: cr.rejectionReason,
        tally: tally(cr),
        decisions: cr.approvals.map((a) => ({
          custodianName: a.custodianName,
          custodianSub: a.custodianSub,
          decision: a.decision,
          at: a.at,
        })),
        documents: cr.documents.map((d) => ({
          id: d.id,
          kind: d.kind,
          filename: d.filename,
          sha256: d.sha256,
          issuedAt: d.issuedAt,
        })),
      })),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(req, "proponent", "minister", "custodian");
    await remember(user);
    const body = (await req.json()) as Record<string, unknown>;

    const type = TYPES.find((t) => t === body.type);
    if (!type) {
      return Response.json(
        { error: { code: "BAD_TYPE", message: `type must be one of ${TYPES.join(", ")}.` } },
        { status: 400 },
      );
    }
    for (const key of ["placeId", "title", "description"]) {
      if (typeof body[key] !== "string" || !(body[key] as string).trim()) {
        return Response.json(
          { error: { code: "MISSING_FIELD", message: `${key} is required.` } },
          { status: 400 },
        );
      }
    }

    try {
      const cr = await initiate({
        placeId: String(body.placeId),
        type,
        title: String(body.title),
        description: String(body.description),
        initiator: user,
        subjectSub: typeof body.subjectSub === "string" ? body.subjectSub : undefined,
        subjectName: typeof body.subjectName === "string" ? body.subjectName : undefined,
      });
      // The routed community and its own consent rule travel back with the request. The
      // threshold is that corporation's data; no screen may assume a number for it.
      return Response.json(
        {
          id: cr.id,
          ref: cr.ref,
          state: cr.state,
          community: {
            name: cr.custodianOrg.name,
            consentRule: cr.custodianOrg.consentRule,
            quorumThreshold: cr.quorumThreshold,
            custodianCount: cr.custodianOrg.custodianCount,
          },
        },
        { status: 201 },
      );
    } catch (err) {
      if (err instanceof GovernanceError) throw httpError(err.status, err.code, err.message);
      throw err;
    }
  });
}
