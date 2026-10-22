// Mints network-signed access tokens for the simulation.
// Roles are read from the database at mint time, so a newly granted permit role appears
// only after the user re-logs in / refreshes their token — exactly as in TideCloak.

import "server-only";
import { SignJWT } from "jose";
import { getSigningKey } from "./keys";
import { realmIssuer } from "@/lib/identity/mode";

// One source of truth for the issuer claim: the same function the verifier uses, so a
// minted token and the check that reads it can never drift apart.
export const TIDE_AUDIENCE = "noddie-app";
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export interface TokenSubject {
  id: string;
  username: string;
  name: string;
  roles: string[];
}

export async function mintToken(user: TokenSubject): Promise<string> {
  const { key, kid } = await getSigningKey();
  return new SignJWT({
    preferred_username: user.username,
    name: user.name,
    realm_access: { roles: user.roles },
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .setSubject(user.id)
    .setIssuer(realmIssuer())
    .setAudience(TIDE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(key);
}
