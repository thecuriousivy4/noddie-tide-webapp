// Server-only key material for the TideCloak simulation.
//
// Two kinds of key live here:
//   1. An RS256 signing key — stands in for Tide's network signing key. Tokens are signed
//      with it and verified against the matching public JWKS (lib/auth.ts). This verification
//      path is REAL: a tampered token fails `jwtVerify`.
//   2. One AES-256-GCM key per Forseti policy. Site data is encrypted with it in the browser;
//      the server stores only ciphertext. The key is released to the browser for a decrypt
//      only when the caller's verified token holds the policy's decryption role.
//
// Keys are generated once and persisted to data/keys.json (gitignored). Never commit them.

// No `server-only` guard here: the seed script (plain Node via tsx) reaches this through
// devSeal. Everything that imports it in app/ is a route handler.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { exportJWK, generateKeyPair, importJWK, type JWK, type KeyLike } from "jose";
import { POLICIES, type PolicyLabel } from "@/lib/policyRegistry";

const KEYS_PATH = join(process.cwd(), "data", "keys.json");

interface StoredKeys {
  kid: string;
  privateJwk: JWK;
  publicJwk: JWK;
  policyKeys: Record<string, string>; // policy label -> base64 AES-256 key
}

interface KeyCache {
  stored: StoredKeys;
  signingKey: KeyLike;
  publicKey: KeyLike;
}

// Persist a singleton across dev hot-reloads.
const globalForKeys = globalThis as unknown as { __noddieKeys?: Promise<KeyCache> };

async function createKeys(): Promise<StoredKeys> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  const kid = randomBytes(8).toString("hex");

  const policyKeys: Record<string, string> = {};
  for (const label of Object.keys(POLICIES) as PolicyLabel[]) {
    policyKeys[label] = randomBytes(32).toString("base64");
  }

  const stored: StoredKeys = { kid, privateJwk, publicJwk, policyKeys };

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(KEYS_PATH, JSON.stringify(stored, null, 2), "utf8");
  return stored;
}

function loadKeys(): StoredKeys | null {
  if (!existsSync(KEYS_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(KEYS_PATH, "utf8")) as StoredKeys;
    // Re-create if a new policy was added since the file was written.
    for (const label of Object.keys(POLICIES)) {
      if (!parsed.policyKeys[label]) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function build(): Promise<KeyCache> {
  const stored = loadKeys() ?? (await createKeys());
  const signingKey = (await importJWK(stored.privateJwk, "RS256")) as KeyLike;
  const publicKey = (await importJWK(stored.publicJwk, "RS256")) as KeyLike;
  return { stored, signingKey, publicKey };
}

function cache(): Promise<KeyCache> {
  if (!globalForKeys.__noddieKeys) globalForKeys.__noddieKeys = build();
  return globalForKeys.__noddieKeys;
}

export const KID = "noddie-tide-sig";

export async function getSigningKey(): Promise<{ key: KeyLike; kid: string }> {
  const c = await cache();
  return { key: c.signingKey, kid: c.stored.kid };
}

/** Public JWKS, as a JWKS endpoint would expose it. */
export async function getPublicJwks(): Promise<{ keys: JWK[] }> {
  const c = await cache();
  return {
    keys: [{ ...c.stored.publicJwk, kid: c.stored.kid, use: "sig", alg: "RS256" }],
  };
}

export async function getPolicyKeyB64(label: PolicyLabel): Promise<string> {
  const c = await cache();
  return c.stored.policyKeys[label];
}
