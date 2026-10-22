// Simulated identity provider: re-issue the token from the session.
//
// This is the step that makes emergent authority visible. The app cannot put a role in a
// token; a quorum commit changes what the identity provider will issue, and the holder has
// to come back for a new token before the role exists for them. Pressing "Refresh token" in
// the header is exactly that trip.
//
// TIDECLOAK: becomes `useTideCloak().forceRefreshToken()`, which asks the realm for a fresh
// token. The realm's answer changes only because its own IGA quorum committed the grant.

import { prisma } from "@/lib/db";
import { identityMode } from "@/lib/identity/mode";
import { getSessionSub } from "@/lib/tide/session";
import { mintToken } from "@/lib/tide/tokens";
import { handle } from "@/lib/identity/verify";

export const runtime = "nodejs";

export async function POST() {
  return handle(async () => {
    if (identityMode() === "tidecloak") {
      return Response.json(
        { error: { code: "USE_TIDECLOAK", message: "Token refresh is handled by the realm." } },
        { status: 404 },
      );
    }
    const sub = await getSessionSub();
    if (!sub) {
      return Response.json(
        { error: { code: "NO_SESSION", message: "Not signed in." } },
        { status: 401 },
      );
    }
    const user = await prisma.userRef.findUnique({ where: { sub } });
    if (!user) {
      return Response.json(
        { error: { code: "NO_SESSION", message: "That account no longer exists." } },
        { status: 401 },
      );
    }
    const token = await mintToken({
      id: user.sub,
      username: user.username,
      name: user.name,
      roles: user.devRoles,
    });
    return Response.json({
      token,
      mode: "mock",
      user: { sub: user.sub, username: user.username, name: user.name, roles: user.devRoles },
    });
  });
}
