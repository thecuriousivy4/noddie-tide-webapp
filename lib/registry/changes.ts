// The governance state machine (§5 of the brief), and the only route by which authority
// over a place can come into being.
//
//   DRAFT ──issue notice──► NOTICE_ISSUED ──► PENDING_QUORUM ──┬─ enough approvals ─► APPROVED ──commit──► COMMITTED
//                                                              └─ quorum impossible ─► REJECTED
//
// Three things the code refuses to do, deliberately:
//   1. It never counts a minister's consent as a quorum signature. It is recorded as an
//      input and displayed as one.
//   2. It never lets one identity supply two approvals, and never lets the initiator
//      approve their own request (four-eyes).
//   3. It never writes a role onto a token. COMMITTED means the community consented; the
//      permit only becomes real when the network puts the role in the subject's token,
//      which every gate re-checks from the signed token itself.

import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { record } from "./audit";
import { identityMode } from "@/lib/identity/mode";
import type {
  Approval,
  ChangeRequest,
  ChangeState,
  ChangeType,
  CustodianOrg,
  NoticeDocument,
  Place,
} from "@/lib/generated/prisma/client";

export class GovernanceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

export type ChangeRequestFull = ChangeRequest & {
  place: Place;
  custodianOrg: CustodianOrg;
  approvals: Approval[];
  documents: NoticeDocument[];
};

export interface Actor {
  sub: string;
  name: string;
  roles: string[];
}

/** The realm role that would emerge on commit. Derived, never free text. */
export function roleForChange(type: ChangeType, place: Place): string {
  switch (type) {
    case "WORKS_PERMIT":
      return `permit-${place.publicRef.toLowerCase().replace(/-/g, "")}`;
    case "PERMIT_REVOCATION":
      return `permit-${place.publicRef.toLowerCase().replace(/-/g, "")}`;
    case "RESTRICTED_READ":
      return "custodian-women";
  }
}

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.changeRequest.count();
  return `CR-${year}-${String(count + 1).padStart(4, "0")}`;
}

const include = {
  place: true,
  custodianOrg: true,
  approvals: { orderBy: { at: "asc" } },
  documents: { orderBy: { issuedAt: "asc" } },
} as const;

export async function get(id: string): Promise<ChangeRequestFull | null> {
  return prisma.changeRequest.findUnique({
    where: { id },
    include,
  }) as Promise<ChangeRequestFull | null>;
}

async function need(id: string): Promise<ChangeRequestFull> {
  const cr = await get(id);
  if (!cr) throw new GovernanceError("NOT_FOUND", "Change request not found.", 404);
  return cr;
}

export async function list(filter?: {
  state?: ChangeState;
  subjectSub?: string;
  placeId?: string;
}): Promise<ChangeRequestFull[]> {
  return prisma.changeRequest.findMany({
    where: {
      ...(filter?.state ? { state: filter.state } : {}),
      ...(filter?.subjectSub ? { subjectSub: filter.subjectSub } : {}),
      ...(filter?.placeId ? { placeId: filter.placeId } : {}),
    },
    include,
    orderBy: { createdAt: "desc" },
  }) as Promise<ChangeRequestFull[]>;
}

/** Step 1–2: open a request and resolve which community's quorum it routes to. */
export async function initiate(input: {
  placeId: string;
  type: ChangeType;
  title: string;
  description: string;
  initiator: Actor;
  subjectSub?: string;
  subjectName?: string;
}): Promise<ChangeRequestFull> {
  const place = await prisma.place.findUnique({
    where: { id: input.placeId },
    include: { custodianOrg: true },
  });
  if (!place) throw new GovernanceError("NO_PLACE", "No such place in the register.", 404);

  const subjectSub = input.subjectSub ?? input.initiator.sub;
  const subjectName = input.subjectName ?? input.initiator.name;
  const grantedRole = roleForChange(input.type, place);

  const open = await prisma.changeRequest.findFirst({
    where: {
      placeId: place.id,
      subjectSub,
      grantedRole,
      state: { in: ["DRAFT", "NOTICE_ISSUED", "PENDING_QUORUM", "APPROVED"] },
    },
  });
  if (open) {
    throw new GovernanceError(
      "ALREADY_OPEN",
      `A request for this place and role is already open (${open.ref}).`,
    );
  }

  const cr = await prisma.changeRequest.create({
    data: {
      ref: await nextRef(),
      placeId: place.id,
      type: input.type,
      state: "DRAFT",
      title: input.title,
      description: input.description,
      initiatorSub: input.initiator.sub,
      initiatorName: input.initiator.name,
      initiatorRole: primaryRole(input.initiator.roles),
      subjectSub,
      subjectName,
      grantedRole,
      // Routing: the place decides which community holds consent, and the community
      // decides the threshold. Neither is a constant in this file.
      custodianOrgId: place.custodianOrgId,
      quorumThreshold: place.custodianOrg.quorumThreshold,
    },
    include,
  });

  await record({
    actorSub: input.initiator.sub,
    actorName: input.initiator.name,
    actorRoles: input.initiator.roles,
    action: "change.initiated",
    target: cr.ref,
    detail: {
      place: place.publicRef,
      type: input.type,
      routedTo: place.custodianOrg.name,
      consentRule: place.custodianOrg.consentRule,
      grantedRole,
      subject: subjectName,
    },
  });

  return cr as ChangeRequestFull;
}

function primaryRole(roles: string[]): string {
  for (const r of ["minister", "proponent", "custodian", "tide-realm-admin"]) {
    if (roles.includes(r)) return r;
  }
  return roles[0] ?? "unknown";
}

/**
 * Step 3: attach proof of notice. The PDF is generated and hashed by the caller
 * (lib/documents/notice.ts) and handed in here so this file stays free of rendering.
 */
export async function attachNotice(
  id: string,
  doc: { kind: NoticeDocument["kind"]; filename: string; sha256: string; bytes: Uint8Array },
  actor: Actor,
): Promise<ChangeRequestFull> {
  const cr = await need(id);
  if (cr.state !== "DRAFT") {
    throw new GovernanceError("BAD_STATE", `Notice can only be issued from DRAFT (is ${cr.state}).`);
  }

  await prisma.noticeDocument.create({
    data: {
      changeRequestId: cr.id,
      kind: doc.kind,
      filename: doc.filename,
      sha256: doc.sha256,
      bytes: Buffer.from(doc.bytes),
      issuedBySub: actor.sub,
      issuedByName: actor.name,
    },
  });

  // NOTICE_ISSUED is a real state, and it is also momentary: proof of notice served is
  // exactly what opens the request to the quorum, so both transitions are logged.
  await prisma.changeRequest.update({
    where: { id: cr.id },
    data: { state: "NOTICE_ISSUED", noticePdfHash: doc.sha256, noticeIssuedAt: new Date() },
  });
  await record({
    actorSub: actor.sub,
    actorName: actor.name,
    actorRoles: actor.roles,
    action: "change.notice_issued",
    target: cr.ref,
    detail: { kind: doc.kind, filename: doc.filename, sha256: doc.sha256, proof: "notice served" },
  });

  const pending = await prisma.changeRequest.update({
    where: { id: cr.id },
    data: { state: "PENDING_QUORUM" },
    include,
  });

  // Public pressure on the place, from the moment notice is served. Nothing protected is
  // revealed by it: the register already shows that a request exists against this place.
  // UNDER_WATCH means proposed and undecided; only a committed permit makes it
  // WORKS_PROPOSED.
  if (cr.type === "WORKS_PERMIT" && cr.place.status === "QUIET") {
    await prisma.place.update({ where: { id: cr.placeId }, data: { status: "UNDER_WATCH" } });
  }
  await record({
    actorSub: actor.sub,
    actorName: actor.name,
    actorRoles: actor.roles,
    action: "change.pending_quorum",
    target: cr.ref,
    detail: {
      routedTo: cr.custodianOrg.name,
      threshold: cr.quorumThreshold,
      of: cr.custodianOrg.custodianCount,
    },
  });

  return pending as ChangeRequestFull;
}

/** Step 4: a minister's consent, recorded as an input and never counted as a signature. */
export async function recordMinisterConsent(id: string, actor: Actor): Promise<ChangeRequestFull> {
  const cr = await need(id);
  if (cr.state === "COMMITTED" || cr.state === "REJECTED") {
    throw new GovernanceError("BAD_STATE", `This request is already ${cr.state.toLowerCase()}.`);
  }
  const updated = await prisma.changeRequest.update({
    where: { id: cr.id },
    data: { ministerConsent: true, ministerConsentBy: actor.name, ministerConsentAt: new Date() },
    include,
  });
  await record({
    actorSub: actor.sub,
    actorName: actor.name,
    actorRoles: actor.roles,
    action: "change.minister_consent_recorded",
    target: cr.ref,
    detail: {
      effect: "none",
      note: "Recorded as an input. It is not a quorum signature and does not advance the request.",
      quorumSignatures: updated.approvals.filter((a) => a.decision === "APPROVE").length,
      threshold: cr.quorumThreshold,
    },
  });
  return updated as ChangeRequestFull;
}

export interface Tally {
  approvals: number;
  denials: number;
  threshold: number;
  custodians: number;
  /** Approvals still needed before the request can be committed. */
  outstanding: number;
  quorumReached: boolean;
  quorumImpossible: boolean;
}

export function tally(cr: ChangeRequestFull): Tally {
  const approvals = cr.approvals.filter((a) => a.decision === "APPROVE").length;
  const denials = cr.approvals.filter((a) => a.decision === "DENY").length;
  const custodians = cr.custodianOrg.custodianCount;
  const threshold = cr.quorumThreshold;
  return {
    approvals,
    denials,
    threshold,
    custodians,
    outstanding: Math.max(0, threshold - approvals),
    quorumReached: approvals >= threshold,
    quorumImpossible: custodians - denials < threshold,
  };
}

/** Step 5: one custodian's independent decision, from their own session. */
export async function decide(
  id: string,
  actor: Actor,
  decision: "APPROVE" | "DENY",
  reason?: string,
): Promise<ChangeRequestFull> {
  const cr = await need(id);
  if (cr.state !== "PENDING_QUORUM") {
    throw new GovernanceError(
      "BAD_STATE",
      cr.state === "DRAFT"
        ? "No notice has been issued yet, so there is nothing to decide."
        : `This request is ${cr.state.toLowerCase()} and no longer open to decisions.`,
    );
  }
  if (!actor.roles.includes("custodian")) {
    throw new GovernanceError("NOT_CUSTODIAN", "Only a custodian can decide a request.", 403);
  }
  if (actor.sub === cr.initiatorSub) {
    throw new GovernanceError(
      "FOUR_EYES",
      "The person who initiated a request cannot also approve it.",
      403,
    );
  }
  if (cr.approvals.some((a) => a.custodianSub === actor.sub)) {
    throw new GovernanceError("ALREADY_DECIDED", "You have already decided this request.");
  }

  await prisma.approval.create({
    data: {
      changeRequestId: cr.id,
      custodianSub: actor.sub,
      custodianName: actor.name,
      decision,
      // In TideCloak mode the enclave signature reference; locally a decision receipt id.
      signatureRef: `${identityMode() === "tidecloak" ? "tide" : "sim"}:${randomUUID()}`,
    },
  });

  const after = await need(id);
  const t = tally(after);
  await record({
    actorSub: actor.sub,
    actorName: actor.name,
    actorRoles: actor.roles,
    action: decision === "APPROVE" ? "change.approved_by" : "change.denied_by",
    target: cr.ref,
    detail: { approvals: t.approvals, denials: t.denials, threshold: t.threshold, reason },
  });

  if (t.quorumReached) {
    const approved = await prisma.changeRequest.update({
      where: { id: cr.id },
      data: { state: "APPROVED", decidedAt: new Date() },
      include,
    });
    await record({
      actorSub: actor.sub,
      actorName: actor.name,
      actorRoles: actor.roles,
      action: "change.quorum_reached",
      target: cr.ref,
      detail: {
        signatures: after.approvals
          .filter((a) => a.decision === "APPROVE")
          .map((a) => ({ custodian: a.custodianName, signatureRef: a.signatureRef, at: a.at })),
        proof: "consent",
      },
    });
    return approved as ChangeRequestFull;
  }

  if (t.quorumImpossible) {
    return reject(id, actor, reason ?? "Enough custodians declined that the threshold can no longer be met.");
  }

  return after;
}

export async function reject(id: string, actor: Actor, reason: string): Promise<ChangeRequestFull> {
  const cr = await need(id);
  if (cr.state === "COMMITTED") {
    throw new GovernanceError("BAD_STATE", "A committed request cannot be rejected.");
  }
  const updated = await prisma.changeRequest.update({
    where: { id: cr.id },
    data: { state: "REJECTED", rejectionReason: reason, decidedAt: new Date() },
    include,
  });
  // A refusal lifts the watch, unless another live works request still stands against
  // the same place.
  if (cr.type === "WORKS_PERMIT") {
    const stillLive = await prisma.changeRequest.count({
      where: {
        placeId: cr.placeId,
        type: "WORKS_PERMIT",
        id: { not: cr.id },
        state: { in: ["NOTICE_ISSUED", "PENDING_QUORUM", "APPROVED", "COMMITTED"] },
      },
    });
    if (stillLive === 0 && cr.place.status === "UNDER_WATCH") {
      await prisma.place.update({ where: { id: cr.placeId }, data: { status: "QUIET" } });
    }
  }

  await record({
    actorSub: actor.sub,
    actorName: actor.name,
    actorRoles: actor.roles,
    action: "change.rejected",
    target: cr.ref,
    detail: { reason, approvals: tally(updated as ChangeRequestFull).approvals },
  });
  return updated as ChangeRequestFull;
}

/**
 * Step 6: commit. Completes the community's side and records the grant reference.
 *
 * What this does NOT do is put the role in anyone's token. In TideCloak mode the grant is
 * carried out by the realm's own IGA quorum and signed by the network; here we record that
 * it was authorised and let every gate keep checking the token. In dev identity mode the
 * seeded user's dev roles are updated, which is why that mode is labelled on every screen.
 */
export async function commit(
  id: string,
  actor: Actor,
  tideGrantRef?: string,
): Promise<ChangeRequestFull> {
  const cr = await need(id);
  if (cr.state !== "APPROVED") {
    throw new GovernanceError(
      "BAD_STATE",
      cr.state === "PENDING_QUORUM"
        ? `Quorum is not reached: ${tally(cr).outstanding} more approval(s) required.`
        : `Only an APPROVED request can be committed (is ${cr.state}).`,
    );
  }
  if (!actor.roles.includes("custodian")) {
    throw new GovernanceError("NOT_CUSTODIAN", "Only a custodian can commit a request.", 403);
  }

  const grantRef = tideGrantRef ?? `${identityMode() === "tidecloak" ? "tide" : "sim"}:grant:${randomUUID()}`;

  const committed = await prisma.changeRequest.update({
    where: { id: cr.id },
    data: { state: "COMMITTED", committedAt: new Date(), tideGrantRef: grantRef },
    include,
  });

  // Simulated identity only: change what the provider will issue from now on. The holder
  // still has to come back for a new token, which is the point being demonstrated.
  // TIDECLOAK: under the realm this block does nothing - the grant is carried by the
  // realm's own IGA quorum and signed by the network.
  if (identityMode() === "mock") {
    const subject = await prisma.userRef.findUnique({ where: { sub: cr.subjectSub } });
    if (subject) {
      const roles = new Set(subject.devRoles);
      if (cr.type === "PERMIT_REVOCATION") roles.delete(cr.grantedRole);
      else roles.add(cr.grantedRole);
      await prisma.userRef.update({ where: { sub: subject.sub }, data: { devRoles: [...roles] } });
    }
  }

  if (cr.type === "WORKS_PERMIT") {
    await prisma.place.update({ where: { id: cr.placeId }, data: { status: "WORKS_PROPOSED" } });
  }

  await record({
    actorSub: actor.sub,
    actorName: actor.name,
    actorRoles: actor.roles,
    action: "change.committed",
    target: cr.ref,
    detail: {
      grantedRole: cr.grantedRole,
      subject: cr.subjectName,
      tideGrantRef: grantRef,
      noticeSha256: cr.noticePdfHash,
      signatures: cr.approvals
        .filter((a) => a.decision === "APPROVE")
        .map((a) => ({ custodian: a.custodianName, signatureRef: a.signatureRef })),
      ministerConsentRecorded: cr.ministerConsent,
      ministerConsentCounted: false,
      note:
        identityMode() === "tidecloak"
          ? "Authorised. The role reaches the subject only when the network signs it into their token."
          : "Simulated identity: the provider will issue this role from now on; the holder must refresh their token.",
    },
  });

  return committed as ChangeRequestFull;
}

/** The three proofs the brief asks a committed request to carry. */
export interface ProofChain {
  notice: { present: boolean; sha256: string | null; issuedAt: Date | null; filename: string | null };
  consent: {
    present: boolean;
    threshold: number;
    signatures: { custodian: string; signatureRef: string; at: Date }[];
  };
  authority: { present: boolean; grantedRole: string; tideGrantRef: string | null; committedAt: Date | null };
  ministerConsent: { recorded: boolean; by: string | null; counted: false };
}

export function proofChain(cr: ChangeRequestFull): ProofChain {
  const approvals = cr.approvals.filter((a) => a.decision === "APPROVE");
  const doc = cr.documents.find((d) => d.kind === "WORKS_NOTICE" || d.kind === "MINISTERIAL_ANNOUNCEMENT");
  return {
    notice: {
      present: Boolean(cr.noticePdfHash),
      sha256: cr.noticePdfHash,
      issuedAt: cr.noticeIssuedAt,
      filename: doc?.filename ?? null,
    },
    consent: {
      present: approvals.length >= cr.quorumThreshold,
      threshold: cr.quorumThreshold,
      signatures: approvals.map((a) => ({
        custodian: a.custodianName,
        signatureRef: a.signatureRef,
        at: a.at,
      })),
    },
    authority: {
      present: cr.state === "COMMITTED",
      grantedRole: cr.grantedRole,
      tideGrantRef: cr.tideGrantRef,
      committedAt: cr.committedAt,
    },
    ministerConsent: {
      recorded: cr.ministerConsent,
      by: cr.ministerConsentBy,
      counted: false,
    },
  };
}
