// Simulated identity provider: the public verification keys, laid out the way a realm's
// /protocol/openid-connect/certs endpoint lays them out.
//
// Verification against this JWKS is the real mechanism: a token with an altered payload or
// a forged signature fails `jwtVerify` and the request is 401. What is simulated is only
// where the private half lives.
//
// TIDECLOAK: replaced by the realm's own certs endpoint. The app then holds no signing key
// at all, which is the point of threshold-signed tokens — there is no key to steal.

import { getPublicJwks } from "@/lib/tide/keys";
import { identityMode, realmIssuer } from "@/lib/identity/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (identityMode() === "tidecloak") {
    return Response.json(
      {
        error: {
          code: "NOT_APPLICABLE",
          message:
            "Running on TideCloak. Tokens are verified against the realm's JWKS and this process holds no signing key.",
        },
      },
      { status: 404 },
    );
  }
  const jwks = await getPublicJwks();
  return Response.json({ ...jwks, issuer: realmIssuer(), simulated: true });
}
