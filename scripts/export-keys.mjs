// Print data/keys.json as the single-line base64 value a host expects in NODDIE_KEYS.
//
// A deployed instance cannot keep data/keys.json: serverless filesystems are read-only and
// per-invocation, and two instances that each generated their own keys would reject each
// other's tokens and be unable to open each other's ciphertext. Pinning the keys in the
// environment is what makes the simulated identity survive a deploy.
//
// The value is secret. It carries the RS256 signing key and every per-policy AES key, so
// anyone holding it can mint tokens and open every sealed record. Paste it into the host's
// encrypted environment settings and nowhere else.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const path = join(process.cwd(), "data", "keys.json");

if (!existsSync(path)) {
  console.error("No data/keys.json yet. Run `npm run dev` and sign in once, then retry.");
  process.exit(1);
}

const raw = readFileSync(path, "utf8");
JSON.parse(raw); // fail loudly rather than export something unusable

console.error("# Set this on your host as NODDIE_KEYS (secret - treat it like a password):");
console.log(Buffer.from(raw, "utf8").toString("base64"));
