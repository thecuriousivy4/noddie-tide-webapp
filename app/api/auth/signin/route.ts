// Simulated identity provider: sign-in.
//
// Username + password against a scrypt hash, then an RS256 token minted with a local
// keypair and carrying the account's roles as `realm_access.roles`. The token is verified
// on every protected route against the matching JWKS, so authorization is real — only the
// key custody is local.
//
// TIDECLOAK: this route disappears under IDENTITY=tidecloak. Sign-in becomes a redirect to
// the realm (`useTideCloak().login()` in lib/identity/client.tsx), the person authenticates
// through their own Tide enclave, and the token comes back signed by the Tide network
// instead of by a key this process holds. Nothing downstream changes, because nothing
// downstream reads anything but the verified token.

import { prisma } from "@/lib/db";
import { identityMode } from "@/lib/identity/mode";
import { verifyPassword } from "@/lib/identity/passwords";
import { mintToken } from "@/lib/tide/tokens";
import { setSession } from "@/lib/tide/session";
import { handle } from "@/lib/identity/verify";
import { record } from "@/lib/registry/audit";

export const runtime = "nodejs";

/** Same message for an unknown account and a wrong password. */
const REFUSED = {
  error: {
    code: "BAD_CREDENTIALS",
    message: "That username and password do not match an account on this register.",
  },
};

export async function POST(req: Request) {
  return handle(async () => {
    if (identityMode() === "tidecloak") {
      return Response.json(
        {
          error: {
            code: "USE_TIDECLOAK",
            message:
              "This register is running on TideCloak. Sign in through the realm, not through a password form.",
          },
        },
        { status: 404 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };
    const username = (body.username ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!username || !password) {
      return Response.json(
        { error: { code: "MISSING_FIELDS", message: "Enter your username and password." } },
        { status: 400 },
      );
    }

    const user = await prisma.userRef.findUnique({ where: { username } });
    const ok = user
      ? await verifyPassword(password, user.passwordHash, user.passwordSalt)
      : // Spend the work anyway, so a missing account is not faster than a wrong password.
        await verifyPassword(password, null, null);

    if (!user || !ok) {
      await record({
        actorSub: "anonymous",
        actorName: username || "(blank)",
        action: "auth.refused",
        target: username || "(blank)",
        detail: { reason: "username or password did not match" },
      });
      return Response.json(REFUSED, { status: 401 });
    }

    await setSession(user.sub);
    const token = await mintToken({
      id: user.sub,
      username: user.username,
      name: user.name,
      roles: user.devRoles,
    });

    await record({
      actorSub: user.sub,
      actorName: user.name,
      actorRoles: user.devRoles,
      action: "auth.signed_in",
      target: user.username,
      detail: { mode: "mock", rolesInToken: user.devRoles },
    });

    return Response.json({
      token,
      mode: "mock",
      user: { sub: user.sub, username: user.username, name: user.name, roles: user.devRoles },
    });
  });
}
