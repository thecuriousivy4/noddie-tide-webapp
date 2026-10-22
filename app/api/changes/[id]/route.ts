import { handle, requireUser } from "@/lib/identity/verify";
import { get, proofChain, tally } from "@/lib/registry/changes";
import { forTarget } from "@/lib/registry/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await params;
    const cr = await get(id);
    if (!cr) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "No such change request." } },
        { status: 404 },
      );
    }
    const t = tally(cr);
    return Response.json({
      request: {
        id: cr.id,
        ref: cr.ref,
        type: cr.type,
        state: cr.state,
        title: cr.title,
        description: cr.description,
        place: {
          id: cr.place.id,
          publicRef: cr.place.publicRef,
          publicName: cr.place.publicName,
          country: cr.place.country,
          zoneCells: cr.place.zoneCells,
          hasRestricted: cr.place.hasRestricted,
        },
        community: {
          name: cr.custodianOrg.name,
          contact: cr.custodianOrg.contact,
          consentRule: cr.custodianOrg.consentRule,
          custodianCount: cr.custodianOrg.custodianCount,
        },
        initiatorName: cr.initiatorName,
        initiatorRole: cr.initiatorRole,
        initiatorSub: cr.initiatorSub,
        subjectName: cr.subjectName,
        subjectSub: cr.subjectSub,
        grantedRole: cr.grantedRole,
        ministerConsent: cr.ministerConsent,
        ministerConsentBy: cr.ministerConsentBy,
        ministerConsentAt: cr.ministerConsentAt,
        rejectionReason: cr.rejectionReason,
        createdAt: cr.createdAt,
        noticeIssuedAt: cr.noticeIssuedAt,
        decidedAt: cr.decidedAt,
        committedAt: cr.committedAt,
      },
      tally: t,
      proofs: proofChain(cr),
      decisions: cr.approvals.map((a) => ({
        custodianName: a.custodianName,
        custodianSub: a.custodianSub,
        decision: a.decision,
        signatureRef: a.signatureRef,
        at: a.at,
      })),
      documents: cr.documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        filename: d.filename,
        sha256: d.sha256,
        issuedAt: d.issuedAt,
        issuedByName: d.issuedByName,
        bytes: d.bytes.length,
      })),
      // What this viewer may do, so the UI never offers a button the server would refuse.
      viewer: {
        sub: user.sub,
        isCustodian: user.roles.includes("custodian"),
        isInitiator: user.sub === cr.initiatorSub,
        hasDecided: cr.approvals.some((a) => a.custodianSub === user.sub),
        canDecide:
          cr.state === "PENDING_QUORUM" &&
          user.roles.includes("custodian") &&
          user.sub !== cr.initiatorSub &&
          !cr.approvals.some((a) => a.custodianSub === user.sub),
        canCommit: cr.state === "APPROVED" && user.roles.includes("custodian"),
        canIssueNotice: cr.state === "DRAFT" && (user.sub === cr.initiatorSub || user.roles.includes("minister")),
        canRecordMinisterConsent:
          user.roles.includes("minister") && cr.state !== "COMMITTED" && cr.state !== "REJECTED",
      },
      trail: (await forTarget(cr.ref)).map((e) => ({
        seq: e.seq,
        at: e.at,
        actorName: e.actorName,
        action: e.action,
        detail: e.detail,
        hash: e.hash,
      })),
    });
  });
}
