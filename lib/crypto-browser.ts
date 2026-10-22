"use client";

// Browser-side encryption for the DEV IDENTITY path only.
//
// With a TideCloak realm configured, none of this runs: lib/identity/client.tsx routes
// seal/open through the SDK's doEncrypt/doDecrypt and Tide's ORK nodes enforce the Forseti
// policy. This file is the stand-in used when no realm is available — AES-256-GCM in the
// browser, with the per-policy key released by /api/policy only to a verified token that
// holds the policy's role.
//
// Ciphertext format: "dev1:<policyLabel>:<ivBase64>:<cipherBase64>". The prefix is
// deliberately NOT TideCloak's "ms1:" — a stand-in should not dress up as the real thing.

import type { PolicyLabel } from "./policyRegistry";

export class PolicyRefusedError extends Error {
  constructor(
    public requiredRole: string,
    public policyLabel: string
  ) {
    super(`The Tide network declined to decrypt this for your account. Required role: ${requiredRole}.`);
    this.name = "PolicyRefusedError";
  }
}

const PREFIX = "dev1";

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = fromB64(keyB64) as BufferSource;
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function fetchPolicyKey(
  token: string,
  policy: PolicyLabel,
  op: "encrypt" | "decrypt"
): Promise<string> {
  const res = await fetch(`/api/policy?policy=${policy}&op=${op}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    const requiredRole = body?.error?.requiredRole ?? policy;
    throw new PolicyRefusedError(requiredRole, policy);
  }
  if (!res.ok) throw new Error(`Policy key request failed (${res.status}).`);
  const body = (await res.json()) as { key: string };
  return body.key;
}

/** Encrypt a plaintext object under a policy. Returns the opaque ciphertext string. */
export async function encryptUnderPolicy(
  token: string,
  policy: PolicyLabel,
  plaintext: unknown
): Promise<string> {
  const keyB64 = await fetchPolicyKey(token, policy, "encrypt");
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(plaintext));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource
  );
  return `${PREFIX}:${policy}:${toB64(iv)}:${toB64(cipher)}`;
}

/** Decrypt a ciphertext string. Throws PolicyRefusedError when the network refuses. */
export async function decryptUnderPolicy<T = unknown>(
  token: string,
  ciphertext: string
): Promise<T> {
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error(
      ciphertext.startsWith("ms1:")
        ? "This record was sealed by TideCloak, but the app is running in dev identity mode. Start TideCloak to open it."
        : "Unrecognised ciphertext format.",
    );
  }
  const policy = parts[1] as PolicyLabel;
  const iv = fromB64(parts[2]);
  const cipher = fromB64(parts[3]);
  const keyB64 = await fetchPolicyKey(token, policy, "decrypt");
  const key = await importKey(keyB64);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    cipher as BufferSource
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
