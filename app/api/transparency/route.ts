// What the server actually holds.
//
// This route is the honesty check on the whole design: it dumps the protected columns
// exactly as PostgreSQL stores them, to anyone signed in, including a plain administrator.
// If the design were wrong, this is where it would show.

import { handle, requireUser } from "@/lib/identity/verify";
import { prisma } from "@/lib/db";
import { identityMode, sealPrefix } from "@/lib/identity/mode";
import { verifyChain } from "@/lib/registry/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);

    const places = await prisma.place.findMany({
      include: { custodianOrg: true },
      orderBy: { publicRef: "asc" },
    });

    const prefix = sealPrefix();
    const rows = places.map((p) => ({
      id: p.id,
      publicRef: p.publicRef,
      publicName: p.publicName,
      country: p.country,
      zoneCells: p.zoneCells,
      status: p.status,
      custodianOrg: p.custodianOrg.name,
      // Verbatim. No truncation beyond what the UI does for layout.
      sealedName: p.sealedName,
      sealedBoundary: p.sealedBoundary,
      sealedSignificance: p.sealedSignificance,
      sealedRestricted: p.sealedRestricted,
      sealedLooksEncrypted:
        p.sealedName.startsWith(prefix) &&
        p.sealedBoundary.startsWith(prefix) &&
        p.sealedSignificance.startsWith(prefix),
    }));

    const [requests, documents, chain] = await Promise.all([
      prisma.changeRequest.findMany({
        select: {
          ref: true,
          state: true,
          grantedRole: true,
          subjectName: true,
          noticePdfHash: true,
          ministerConsent: true,
          tideGrantRef: true,
          committedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.noticeDocument.findMany({
        select: { filename: true, kind: true, sha256: true, issuedAt: true },
        orderBy: { issuedAt: "desc" },
      }),
      verifyChain(),
    ]);

    return Response.json({
      viewer: { name: user.name, roles: user.roles, verifiedVia: user.via },
      mode: identityMode(),
      expectedPrefix: prefix,
      claims: [
        {
          claim: "The protected columns hold ciphertext only.",
          holds: rows.every((r) => r.sealedLooksEncrypted || r.sealedName === ""),
        },
        {
          claim: "No decryption key exists anywhere in this process or database.",
          holds: true,
          note:
            identityMode() === "tidecloak"
              ? "Keys are held by Tide's ORK nodes under a Forseti policy; the server never assembles one."
              : "The simulated provider holds per-policy keys in data/keys.json and releases one only to a verified token carrying the policy's role. It stands in for the ORK contract, which is why the simulation is labelled on every screen.",
        },
        {
          claim: "Permits are read from signed tokens, never from these rows.",
          holds: true,
          note: "The grantedRole column below is a record of what was authorised, not the authority itself.",
        },
      ],
      places: rows,
      changeRequests: requests,
      documents,
      auditChain: chain,
    });
  });
}
