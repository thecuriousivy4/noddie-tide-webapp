// Dev-identity sealing on the server, used by the seed script only.
//
// Wire-compatible with lib/crypto-browser.ts (AES-256-GCM, WebCrypto layout: ciphertext
// followed by the 16-byte auth tag) so a record sealed by the seed can be opened in the
// browser and vice versa. This exists so `npm run db:seed` produces a demo-ready register
// without a realm; with TideCloak configured, places are sealed in a custodian's browser
// and this file is never called.

// No `server-only` guard here: the seed script (plain Node via tsx) imports this module.
// It is still server-side code — nothing in app/ imports it from a client component.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getPolicyKeyB64 } from "./keys";
import type { PolicyLabel } from "@/lib/policyRegistry";

const PREFIX = "dev1";

export async function devSeal(policy: PolicyLabel, value: unknown): Promise<string> {
  const key = Buffer.from(await getPolicyKeyB64(policy), "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
    cipher.final(),
  ]);
  const payload = Buffer.concat([body, cipher.getAuthTag()]);
  return `${PREFIX}:${policy}:${iv.toString("base64")}:${payload.toString("base64")}`;
}

export async function devOpen<T>(sealed: string): Promise<T> {
  const parts = sealed.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) throw new Error("Not dev-sealed ciphertext.");
  const policy = parts[1] as PolicyLabel;
  const iv = Buffer.from(parts[2], "base64");
  const payload = Buffer.from(parts[3], "base64");
  const body = payload.subarray(0, payload.length - 16);
  const tag = payload.subarray(payload.length - 16);
  const key = Buffer.from(await getPolicyKeyB64(policy), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(body), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}
