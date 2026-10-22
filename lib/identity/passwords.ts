// Password hashing for the simulated identity provider.
//
// scrypt with a per-user salt and a constant-time comparison. These are demo credentials
// for synthetic accounts, but the mechanics are the real ones: the database stores a hash,
// never a password, and a wrong password fails in constant time.
//
// TIDECLOAK: none of this exists under the real thing. TideCloak authenticates each person
// through their own Tide enclave — there are no passwords in the realm to steal, and no
// password column for this register to hold. Deleting this file is part of going live.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, KEYLEN);
  return { hash: derived.toString("hex"), salt };
}

export async function verifyPassword(
  password: string,
  hash: string | null,
  salt: string | null,
): Promise<boolean> {
  if (!hash || !salt) return false;
  const derived = await scryptAsync(password, salt, KEYLEN);
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== derived.length) return false;
  return timingSafeEqual(stored, derived);
}
