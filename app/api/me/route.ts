// Who the server believes you are, read only from your verified token.
//
// The Authority panel in the UI renders this verbatim, including the line that the app
// cannot add to it. If a role is missing from here, no screen and no route will act as
// though it is present.

import { handle, verifyRequest } from "@/lib/identity/verify";
import { identityMode, realmIssuer } from "@/lib/identity/mode";
import { remember } from "@/lib/registry/users";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPLAIN: Record<string, string> = {
  custodian: "Record places, decide and commit change requests for your community.",
  "custodian-women": "Open the restricted cultural layer. Quorum-granted standing, held separately.",
  proponent: "Run clearance checks, lodge works notices, ask for a permit.",
  minister: "View the permit queue and record a consent — which grants nothing on its own.",
  "tide-realm-admin": "Platform administration. Grants no reading of protected fields and no permit.",
};

export async function GET(req: Request) {
  return handle(async () => {
    const user = await verifyRequest(req);
    await remember(user);

    const permitRoles = user.roles.filter((r) => r.startsWith("permit-"));
    const permits = await prisma.changeRequest.findMany({
      where: { grantedRole: { in: permitRoles }, state: "COMMITTED" },
      include: { place: true, custodianOrg: true, approvals: true },
    });

    return Response.json({
      user: { sub: user.sub, username: user.username, name: user.name, roles: user.roles },
      mode: identityMode(),
      verifiedVia: user.via,
      issuer: user.iss ?? realmIssuer(),
      authority: user.roles.map((role) => ({
        role,
        explain:
          EXPLAIN[role] ??
          (role.startsWith("permit-")
            ? "A works permit for one place, granted by a custodian quorum."
            : "No capability in this register."),
        grantedBy: role.startsWith("permit-") ? "custodian quorum" : "realm",
      })),
      permits: permits.map((p) => ({
        ref: p.ref,
        placeRef: p.place.publicRef,
        placeName: p.place.publicName,
        role: p.grantedRole,
        committedAt: p.committedAt,
        signatures: p.approvals.filter((a) => a.decision === "APPROVE").length,
        threshold: p.quorumThreshold,
      })),
      note: "Roles are read from your signed token. This application has no code path that adds one.",
    });
  });
}
