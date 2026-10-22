// The places register.
//
// Two shapes leave this module. `PublicPlace` is what anyone signed in may see — a
// reference, a coarse land description, generalized zones, a status. `SealedPlace` adds
// the ciphertext strings, which are useless without a role the network has to grant;
// handing them to the browser is what lets a custodian open them on their own device,
// and is why this server can be inspected without exposing a single place.

import "server-only";
import { prisma } from "@/lib/db";
import { record } from "./audit";
import { httpError } from "@/lib/identity/verify";
import type { Place, PlaceStatus } from "@/lib/generated/prisma/client";

export interface PublicPlace {
  id: string;
  publicRef: string;
  publicName: string;
  country: string;
  publicSummary: string;
  scene: string;
  zoneCells: string[];
  status: PlaceStatus;
  hasRestricted: boolean;
  custodianOrg: { id: string; name: string; contact: string; consentRule: string };
  recordedByName: string;
  createdAt: string;
  openRequests: number;
}

export interface SealedPlace extends PublicPlace {
  sealed: {
    name: string;
    boundary: string;
    significance: string;
    restricted: string | null;
  };
}

type WithOrg = Place & {
  custodianOrg: { id: string; name: string; contact: string; consentRule: string };
  _count?: { changeRequests: number };
};

function toPublic(p: WithOrg, openRequests: number): PublicPlace {
  return {
    id: p.id,
    publicRef: p.publicRef,
    publicName: p.publicName,
    country: p.country,
    publicSummary: p.publicSummary,
    scene: p.scene,
    zoneCells: p.zoneCells,
    status: p.status,
    hasRestricted: p.hasRestricted,
    custodianOrg: p.custodianOrg,
    recordedByName: p.recordedByName,
    createdAt: p.createdAt.toISOString(),
    openRequests,
  };
}

export function toSealed(p: WithOrg, openRequests: number): SealedPlace {
  return {
    ...toPublic(p, openRequests),
    sealed: {
      name: p.sealedName,
      boundary: p.sealedBoundary,
      significance: p.sealedSignificance,
      restricted: p.sealedRestricted,
    },
  };
}

const OPEN_STATES = ["DRAFT", "NOTICE_ISSUED", "PENDING_QUORUM", "APPROVED"] as const;

export async function listSealed(): Promise<SealedPlace[]> {
  const places = await prisma.place.findMany({
    include: { custodianOrg: true },
    orderBy: { publicRef: "asc" },
  });
  const open = await prisma.changeRequest.groupBy({
    by: ["placeId"],
    where: { state: { in: [...OPEN_STATES] } },
    _count: { _all: true },
  });
  const counts = new Map(open.map((o) => [o.placeId, o._count._all]));
  return places.map((p) => toSealed(p as WithOrg, counts.get(p.id) ?? 0));
}

export async function getByRef(ref: string): Promise<SealedPlace | null> {
  const place = await prisma.place.findFirst({
    where: { publicRef: { equals: ref, mode: "insensitive" } },
    include: { custodianOrg: true },
  });
  if (!place) return null;
  const openRequests = await prisma.changeRequest.count({
    where: { placeId: place.id, state: { in: [...OPEN_STATES] } },
  });
  return toSealed(place as WithOrg, openRequests);
}

export interface NewPlaceInput {
  publicRef: string;
  publicName: string;
  country: string;
  publicSummary: string;
  scene: string;
  zoneCells: string[];
  custodianOrgId: string;
  sealedName: string;
  sealedBoundary: string;
  sealedSignificance: string;
  sealedRestricted?: string | null;
}

/**
 * Record a place. The caller has already sealed the protected fields in their browser;
 * this function would not be able to seal them, because it has no key.
 */
export async function create(
  input: NewPlaceInput,
  actor: { sub: string; name: string; roles: string[] },
): Promise<SealedPlace> {
  const ref = input.publicRef.trim().toUpperCase();
  const existing = await prisma.place.findUnique({ where: { publicRef: ref } });
  if (existing) {
    throw httpError(409, "ALREADY_RECORDED", `${ref} is already on the register.`);
  }

  const place = await prisma.place.create({
    data: {
      id: ref,
      publicRef: ref,
      publicName: input.publicName.trim(),
      country: input.country.trim(),
      publicSummary: input.publicSummary.trim(),
      scene: input.scene,
      zoneCells: input.zoneCells,
      status: "QUIET",
      custodianOrgId: input.custodianOrgId,
      sealedName: input.sealedName,
      sealedBoundary: input.sealedBoundary,
      sealedSignificance: input.sealedSignificance,
      sealedRestricted: input.sealedRestricted ?? null,
      hasRestricted: Boolean(input.sealedRestricted),
      recordedBySub: actor.sub,
      recordedByName: actor.name,
    },
    include: { custodianOrg: true },
  });

  await record({
    actorSub: actor.sub,
    actorName: actor.name,
    actorRoles: actor.roles,
    action: "place.recorded",
    target: ref,
    detail: {
      zones: input.zoneCells,
      hasRestricted: Boolean(input.sealedRestricted),
      // Lengths only. The server cannot describe what it stored.
      sealedLengths: {
        name: input.sealedName.length,
        boundary: input.sealedBoundary.length,
        significance: input.sealedSignificance.length,
      },
      note: "Protected fields arrived already sealed; this server holds no key for them.",
    },
  });

  return toSealed(place as WithOrg, 0);
}

export async function setStatus(id: string, status: PlaceStatus): Promise<void> {
  await prisma.place.update({ where: { id }, data: { status } });
}

export async function orgs() {
  return prisma.custodianOrg.findMany({ orderBy: { name: "asc" } });
}
