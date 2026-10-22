// Server-side token verification. This is the only place authority enters the system.
//
// Rules that hold in both identity modes:
//   · roles come from the verified token's `realm_access.roles`, never from a request body,
//     a query string, a cookie or a database column;
//   · a tampered token fails verification and the request is 401;
//   · the app has no code path that adds a role to a token. Roles appear only because a
//     custodian quorum committed a change request and the network signed the result.

import "server-only";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { verifyTideCloakToken } from "@tidecloak/nextjs/server";
import { adapterConfig, identityMode, realmIssuer } from "./mode";
import { getPublicJwks } from "@/lib/tide/keys";
import type { ApiError } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
  toResponse(): Response {
    const body: ApiError & { error: Record<string, unknown> } = {
      error: { code: this.code, message: this.message, ...(this.extra ?? {}) },
    };
    return Response.json(body, { status: this.status });
  }
}

export function httpError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): HttpError {
  return new HttpError(status, code, message, extra);
}

export interface VerifiedUser {
  sub: string;
  username: string;
  name: string;
  roles: string[];
  iss?: string;
  iat?: number;
  /** How this token was verified — recorded in the audit log, shown in Transparency. */
  via: "tidecloak" | "mock";
}

let devJwks: ReturnType<typeof createLocalJWKSet> | null = null;

async function localJwks() {
  if (!devJwks) devJwks = createLocalJWKSet((await getPublicJwks()) as JSONWebKeySet);
  return devJwks;
}

function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw httpError(401, "NO_TOKEN", "Sign in first.");
  const token = header.slice(7).trim();
  if (!token) throw httpError(401, "NO_TOKEN", "Sign in first.");
  return token;
}

function claimsToUser(
  payload: Record<string, unknown>,
  via: "tidecloak" | "mock",
): VerifiedUser {
  const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
  return {
    sub: String(payload.sub ?? ""),
    username: String(payload.preferred_username ?? ""),
    name: String(payload.name ?? payload.preferred_username ?? ""),
    roles: realmAccess?.roles ?? [],
    iss: payload.iss ? String(payload.iss) : undefined,
    iat: typeof payload.iat === "number" ? payload.iat : undefined,
    via,
  };
}

/** Verify the bearer token. Throws 401 if it is missing, expired, or not network-signed. */
export async function verifyRequest(req: Request): Promise<VerifiedUser> {
  const token = bearer(req);

  // TIDECLOAK: the real verification path. `verifyTideCloakToken` fetches the realm's JWKS
  // and checks the signature the Tide network produced; this process holds no key.
  if (identityMode() === "tidecloak") {
    const config = adapterConfig();
    if (!config) {
      throw httpError(
        503,
        "TIDECLOAK_NOT_CONFIGURED",
        "IDENTITY=tidecloak but tidecloak.json is missing. See the README.",
      );
    }
    const claims = await verifyTideCloakToken(config, token).catch(() => null);
    if (!claims) throw httpError(401, "BAD_TOKEN", "Token is not valid for this realm.");
    return claimsToUser(claims as Record<string, unknown>, "tidecloak");
  }

  // Simulated provider: same verification, local JWKS. A tampered payload or a forged
  // signature fails here exactly as it would against the realm.

  try {
    const { payload } = await jwtVerify(token, await localJwks(), { issuer: realmIssuer() });
    return claimsToUser(payload as Record<string, unknown>, "mock");
  } catch {
    throw httpError(401, "BAD_TOKEN", "Token signature or claims are invalid.");
  }
}

/**
 * Verify, then require at least one of `roles`.
 * @throws HttpError 403 listing what the token would need — the UI shows this verbatim,
 *   because "you cannot do this" is more honest when it says who could.
 */
export async function requireUser(req: Request, ...roles: string[]): Promise<VerifiedUser> {
  const user = await verifyRequest(req);
  if (roles.length > 0 && !roles.some((r) => user.roles.includes(r))) {
    throw httpError(
      403,
      "FORBIDDEN",
      roles.length === 1
        ? `Your token does not carry the role ${roles[0]}. The app cannot add it; a custodian quorum has to grant it.`
        : `Your token carries none of: ${roles.join(", ")}. The app cannot add one.`,
      { requiredRoles: roles, heldRoles: user.roles },
    );
  }
  return user;
}

/** Wrap a route handler so thrown HttpErrors become clean JSON. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return err.toResponse();
    console.error("Unhandled route error:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return Response.json({ error: { code: "INTERNAL", message } }, { status: 500 });
  }
}
