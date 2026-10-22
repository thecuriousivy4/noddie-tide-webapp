// Which identity backend the app runs on.
//
//   IDENTITY=mock       (default) a local, simulated identity provider with the same shape
//                       as TideCloak: username + password sign-in, a locally signed RS256
//                       token, a JWKS endpoint, and server-side verification on every
//                       protected route. Real auth mechanics, local key.
//   IDENTITY=tidecloak  the live thing: per-user sign-in against a TideCloak realm, tokens
//                       signed by the Tide network, roles that only a committed quorum can
//                       change. Requires tidecloak.json in the project root.
//
// Nothing else in the app branches on this except the sign-in screen and the verification
// source. Every route still authorizes from a verified token's realm roles and nothing else.
//
// TIDECLOAK: this module is the switch. To go live, set IDENTITY=tidecloak and drop the
// realm's client adapter config at ./tidecloak.json — no other file needs editing.

import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type IdentityMode = "tidecloak" | "mock";

export interface AdapterConfig {
  realm: string;
  "auth-server-url": string;
  resource: string;
  [key: string]: unknown;
}

const ADAPTER_PATH = join(process.cwd(), "tidecloak.json");

const cache = globalThis as unknown as {
  __noddieAdapter?: { at: number; config: AdapterConfig | null };
};

function read(): AdapterConfig | null {
  // Re-read at most every few seconds: the file appears mid-session when someone finishes
  // initialising a realm, and the app should pick it up without a restart.
  const fresh = cache.__noddieAdapter && Date.now() - cache.__noddieAdapter.at < 5000;
  if (fresh) return cache.__noddieAdapter!.config;

  let config: AdapterConfig | null = null;
  if (existsSync(ADAPTER_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(ADAPTER_PATH, "utf8")) as AdapterConfig;
      if (parsed.realm && parsed["auth-server-url"]) config = parsed;
    } catch {
      config = null;
    }
  }
  cache.__noddieAdapter = { at: Date.now(), config };
  return config;
}

export function adapterConfig(): AdapterConfig | null {
  return read();
}

/** The configured mode. `tidecloak` without an adapter config is a misconfiguration. */
export function identityMode(): IdentityMode {
  return process.env.IDENTITY === "tidecloak" ? "tidecloak" : "mock";
}

/** True when the mode is `tidecloak` but the realm config is missing — fail closed, loudly. */
export function tidecloakMisconfigured(): boolean {
  return identityMode() === "tidecloak" && read() === null;
}

export function isSimulated(): boolean {
  return identityMode() === "mock";
}

export function realmIssuer(): string {
  const cfg = read();
  if (identityMode() === "tidecloak" && cfg) {
    return `${String(cfg["auth-server-url"]).replace(/\/$/, "")}/realms/${cfg.realm}`;
  }
  // The simulated issuer says what it is. A token minted here could never be mistaken for
  // one the Tide network signed.
  return process.env.MOCK_ISSUER ?? "https://simulated.noddie.local/realms/ridgeline-basin";
}

/** Ciphertext prefix the current mode produces. `ms1:` is TideCloak's; the mock never uses it. */
export function sealPrefix(): "ms1:" | "dev1:" {
  return identityMode() === "tidecloak" ? "ms1:" : "dev1:";
}
