// Policy material for browser-side encryption, and the only place the two modes differ
// in what they hand out.
//
//   TideCloak mode: the *public, signed* Forseti policy bytes. They are not a key. The
//     browser passes them to doEncrypt/doDecrypt, and Tide's ORK nodes run the policy
//     contract, which checks the caller's realm role before taking part. A wrong-role
//     decrypt is refused by the network, not by this route.
//
//   Simulated mode: a per-policy AES key, released only to a verified token that holds the
//     policy's role. The refusal is real, but it is OUR refusal rather than the network's -
//     which is exactly why the simulation is labelled on every screen.
//
// TIDECLOAK: the branch below is the seam. Under the realm this route serves public signed
// policy bytes and never a key; the decision moves to the ORK nodes.
//
// Either way, every release is written to the append-only log.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handle, verifyRequest, httpError } from "@/lib/identity/verify";
import { identityMode } from "@/lib/identity/mode";
import { POLICIES, isPolicyLabel } from "@/lib/policyRegistry";
import { getPolicyKeyB64 } from "@/lib/tide/keys";
import { record } from "@/lib/registry/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await verifyRequest(req);
    const url = new URL(req.url);
    const label = url.searchParams.get("policy") ?? "";
    const op = url.searchParams.get("op") === "encrypt" ? "encrypt" : "decrypt";

    if (!isPolicyLabel(label)) {
      throw httpError(400, "BAD_POLICY", "Unknown policy label.");
    }
    const policy = POLICIES[label];
    const requiredRole = op === "encrypt" ? policy.encryptRole : policy.decryptRole;

    if (!user.roles.includes(requiredRole)) {
      await record({
        actorSub: user.sub,
        actorName: user.name,
        actorRoles: user.roles,
        action: "policy.refused",
        target: label,
        detail: { op, requiredRole, heldRoles: user.roles, mode: identityMode() },
      });
      throw httpError(
        403,
        "POLICY_REFUSED",
        "Declined. Opening " +
          label +
          " needs the role " +
          requiredRole +
          ", which only a custodian quorum can grant.",
        { requiredRole, policy: label },
      );
    }

    if (identityMode() === "tidecloak") {
      const path = join(process.cwd(), "data", "policies", label + ".b64");
      if (!existsSync(path)) {
        throw httpError(
          503,
          "NO_POLICY_BYTES",
          "This realm has no committed Forseti policy for " +
            label +
            " yet. Create and commit it, then save its signed bytes to data/policies/" +
            label +
            ".b64 (see README).",
        );
      }
      const bytesB64 = readFileSync(path, "utf8").trim();
      await record({
        actorSub: user.sub,
        actorName: user.name,
        actorRoles: user.roles,
        action: "policy.bytes_served",
        target: label,
        detail: {
          op,
          requiredRole,
          mode: "tidecloak",
          note: "Signed policy bytes are public. The decision is made by the ORKs, not here.",
        },
      });
      return Response.json({ mode: "tidecloak", policy: label, bytesB64 });
    }

    const key = await getPolicyKeyB64(label);
    await record({
      actorSub: user.sub,
      actorName: user.name,
      actorRoles: user.roles,
      action: "policy.key_released",
      target: label,
      detail: { op, requiredRole, mode: "mock", note: "Simulated stand-in for the ORK policy contract." },
    });
    return Response.json({ mode: "mock", policy: label, key });
  });
}
