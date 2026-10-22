// The gate.
//
// A proponent lodges a works notice for a place. The only thing consulted is the verified
// token: does it carry permit-<ref>? Not a column, not a status field, not a cached flag.
// Pointing this route at a tampered token, or at a permit that was never committed, fails
// here — which is the whole claim the project makes, in one function.

import { handle, requireUser, httpError } from "@/lib/identity/verify";
import { prisma } from "@/lib/db";
import { record } from "@/lib/registry/audit";
import { remember } from "@/lib/registry/users";
import { buildLodgementReceipt } from "@/lib/documents/instruments";
import { realmIssuer } from "@/lib/identity/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(req);
    const events = await prisma.auditEvent.findMany({
      where: { action: { startsWith: "works_notice." } },
      orderBy: { seq: "desc" },
      take: 100,
    });
    return Response.json({
      notices: events.map((e) => ({
        seq: e.seq,
        at: e.at,
        actorName: e.actorName,
        outcome: e.action === "works_notice.accepted" ? "accepted" : "refused",
        target: e.target,
        detail: e.detail,
      })),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(req, "proponent", "minister", "tide-realm-admin", "custodian");
    await remember(user);
    const body = (await req.json()) as { placeRef?: string; summary?: string };
    const placeRef = (body.placeRef ?? "").trim().toUpperCase();
    if (!placeRef) throw httpError(400, "NO_PLACE", "Which place is the notice for?");

    const place = await prisma.place.findUnique({
      where: { publicRef: placeRef },
      include: { custodianOrg: true },
    });
    if (!place) throw httpError(404, "NOT_FOUND", placeRef + " is not on the register.");

    const requiredRole = "permit-" + place.publicRef.toLowerCase().replace(/-/g, "");
    const permitted = user.roles.includes(requiredRole);

    const tokenRoles = user.roles;
    const common = {
      actorSub: user.sub,
      actorName: user.name,
      actorRoles: tokenRoles,
      target: place.publicRef,
    };

    if (!permitted) {
      await record({
        ...common,
        action: "works_notice.refused",
        detail: {
          requiredRole,
          heldRoles: tokenRoles,
          checkedAgainst: "verified access token",
          reason:
            "The token does not carry the permit role. No database value was consulted, and none would have changed this.",
        },
      });
      throw httpError(
        403,
        "NO_PERMIT",
        "Refused. Your token does not carry " +
          requiredRole +
          ", so no works may be lodged for " +
          place.publicRef +
          ". Only a custodian quorum can create that role.",
        { requiredRole, heldRoles: tokenRoles },
      );
    }

    const committed = await prisma.changeRequest.findFirst({
      where: { placeId: place.id, grantedRole: requiredRole, state: "COMMITTED" },
      orderBy: { committedAt: "desc" },
      include: { approvals: true },
    });

    await record({
      ...common,
      action: "works_notice.accepted",
      detail: {
        requiredRole,
        checkedAgainst: "verified access token",
        tokenIssuer: user.iss ?? realmIssuer(),
        verifiedVia: user.via,
        permitRef: committed?.ref ?? null,
        summary: body.summary ?? null,
      },
    });

    const receipt = await buildLodgementReceipt({
      ref: committed?.ref ?? place.publicRef,
      authority: place.custodianOrg.name,
      placeRef: place.publicRef,
      placeName: place.publicName,
      holderName: user.name,
      outcome: "accepted",
      reason:
        "Accepted. The role " +
        requiredRole +
        " was present in the presented access token and its signature verified.",
      tokenIss: user.iss ?? realmIssuer(),
      tokenSub: user.sub,
      tokenRoles,
      verifiedVia: user.via,
      at: new Date().toISOString(),
    });

    if (committed) {
      await prisma.noticeDocument.create({
        data: {
          changeRequestId: committed.id,
          kind: "WORKS_NOTICE",
          filename: receipt.filename,
          sha256: receipt.sha256,
          bytes: Buffer.from(receipt.bytes),
          issuedBySub: user.sub,
          issuedByName: user.name,
        },
      });
      await record({
        ...common,
        action: "document.issued",
        detail: { kind: "WORKS_NOTICE_RECEIPT", sha256: receipt.sha256, changeRequest: committed.ref },
      });
    }

    return Response.json({
      outcome: "accepted",
      requiredRole,
      permitRef: committed?.ref ?? null,
      receipt: { filename: receipt.filename, sha256: receipt.sha256 },
    });
  });
}
