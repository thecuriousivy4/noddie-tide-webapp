// A display-name cache for people the register has seen, plus the seeded demo accounts.
//
// `devRoles` is used for one purpose only: minting dev-identity tokens when no TideCloak
// realm is configured. With a realm configured, nothing in the app reads it — roles come
// from the verified token and from nowhere else.

import "server-only";
import { prisma } from "@/lib/db";
import type { VerifiedUser } from "@/lib/identity/verify";

export async function remember(user: VerifiedUser): Promise<void> {
  if (!user.sub) return;
  await prisma.userRef.upsert({
    where: { sub: user.sub },
    create: {
      sub: user.sub,
      username: user.username || user.sub.slice(0, 8),
      name: user.name || user.username || "Unknown",
      devRoles: [],
    },
    update: {
      name: user.name || user.username || "Unknown",
      ...(user.username ? { username: user.username } : {}),
    },
  });
}

export async function bySub(sub: string) {
  return prisma.userRef.findUnique({ where: { sub } });
}

export async function byUsername(username: string) {
  return prisma.userRef.findUnique({ where: { username } });
}

/** The seeded scenario accounts, for the dev-identity picker and for subject selection. */
export async function seeded() {
  return prisma.userRef.findMany({ where: { seeded: true }, orderBy: { username: "asc" } });
}

/** Everyone who could hold a permit — shown when a change request needs a subject. */
export async function proponents() {
  const all = await prisma.userRef.findMany({ orderBy: { username: "asc" } });
  return all.filter((u) => u.devRoles.includes("proponent") || u.devRoles.length === 0);
}
