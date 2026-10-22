// Clearance check: a proponent asks "does the register hold anything in these zones?"
//
// The answer is deliberately thin — a public reference, the land description, and who to
// talk to. It never says what the place is, and the generalized zones mean a hit does not
// locate anything. Every check is logged, so a proponent fishing the whole basin is visible
// to the community.

import "server-only";
import { prisma } from "@/lib/db";
import { record } from "./audit";

export interface ClearanceHit {
  publicRef: string;
  publicName: string;
  country: string;
  status: string;
  overlap: string[];
  custodianOrg: { name: string; contact: string; consentRule: string };
  hasRestricted: boolean;
}

export interface ClearanceResult {
  cells: string[];
  hits: ClearanceHit[];
  checkedAt: string;
}

export async function run(
  cells: string[],
  actor: { sub: string; name: string; roles: string[] },
): Promise<ClearanceResult> {
  const asked = new Set(cells);
  const places = await prisma.place.findMany({ include: { custodianOrg: true } });

  const hits: ClearanceHit[] = places
    .map((p) => ({ p, overlap: p.zoneCells.filter((c) => asked.has(c)) }))
    .filter(({ overlap }) => overlap.length > 0)
    .map(({ p, overlap }) => ({
      publicRef: p.publicRef,
      publicName: p.publicName,
      country: p.country,
      status: p.status,
      overlap,
      custodianOrg: {
        name: p.custodianOrg.name,
        contact: p.custodianOrg.contact,
        consentRule: p.custodianOrg.consentRule,
      },
      hasRestricted: p.hasRestricted,
    }));

  const at = new Date();
  await prisma.clearanceCheck.create({
    data: {
      actorSub: actor.sub,
      actorName: actor.name,
      cells,
      hitRefs: hits.map((h) => h.publicRef),
      at,
    },
  });
  await record({
    actorSub: actor.sub,
    actorName: actor.name,
    actorRoles: actor.roles,
    action: "clearance.checked",
    target: cells.join(" "),
    detail: {
      cells,
      hits: hits.map((h) => h.publicRef),
      returned: "public reference, land description and contact only",
    },
  });

  return { cells, hits, checkedAt: at.toISOString() };
}

export async function history(limit = 50) {
  return prisma.clearanceCheck.findMany({ orderBy: { at: "desc" }, take: limit });
}
