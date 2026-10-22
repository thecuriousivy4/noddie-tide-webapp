// The scenario roster shown on the sign-in page: usernames, names and the roles each
// account's token will carry. No credential material is returned, and filling the username
// field still leaves the password to be typed.
//
// TIDECLOAK: 404s under IDENTITY=tidecloak. Realm accounts are not this service's to list.

import { prisma } from "@/lib/db";
import { identityMode } from "@/lib/identity/mode";
import { handle } from "@/lib/identity/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    if (identityMode() === "tidecloak") {
      return Response.json(
        { error: { code: "NOT_APPLICABLE", message: "Accounts live in the realm." } },
        { status: 404 },
      );
    }
    const accounts = await prisma.userRef.findMany({
      where: { seeded: true },
      orderBy: { username: "asc" },
      select: { username: true, name: true, blurb: true, devRoles: true },
    });
    return Response.json({
      accounts: accounts.map((a) => ({
        username: a.username,
        name: a.name,
        blurb: a.blurb,
        roles: a.devRoles,
      })),
    });
  });
}
