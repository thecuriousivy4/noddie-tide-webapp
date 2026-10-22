// The register.
//
// GET returns every place with its ciphertext. That is deliberate and safe: the sealed
// strings are what a custodian's browser needs in order to open them on their own device,
// and they are useless to anyone the network will not decrypt for — including this server.
//
// POST records a place. The protected fields arrive already sealed; this route could not
// seal them, because it has no key.

import { handle, requireUser } from "@/lib/identity/verify";
import { create, listSealed, orgs } from "@/lib/registry/places";
import { remember } from "@/lib/registry/users";
import { isValidCell } from "@/lib/grid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    await remember(user);
    return Response.json({ places: await listSealed(), orgs: await orgs() });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(req, "custodian");
    await remember(user);
    const body = (await req.json()) as Record<string, unknown>;

    const required = [
      "publicRef",
      "publicName",
      "country",
      "publicSummary",
      "custodianOrgId",
      "sealedName",
      "sealedBoundary",
      "sealedSignificance",
    ];
    for (const key of required) {
      if (typeof body[key] !== "string" || !(body[key] as string).trim()) {
        return Response.json(
          { error: { code: "MISSING_FIELD", message: `${key} is required.` } },
          { status: 400 },
        );
      }
    }

    const zoneCells = Array.isArray(body.zoneCells)
      ? body.zoneCells.map(String).filter(isValidCell)
      : [];
    if (zoneCells.length === 0) {
      return Response.json(
        { error: { code: "NO_ZONES", message: "Mark at least one generalized zone." } },
        { status: 400 },
      );
    }

    // A restricted layer may only be recorded by someone who holds that standing.
    const sealedRestricted =
      typeof body.sealedRestricted === "string" && body.sealedRestricted ? body.sealedRestricted : null;
    if (sealedRestricted && !user.roles.includes("custodian-women")) {
      return Response.json(
        {
          error: {
            code: "NO_RESTRICTED_STANDING",
            message: "Recording the restricted layer needs the quorum-granted custodian-women standing.",
          },
        },
        { status: 403 },
      );
    }

    const place = await create(
      {
        publicRef: String(body.publicRef),
        publicName: String(body.publicName),
        country: String(body.country),
        publicSummary: String(body.publicSummary),
        scene: typeof body.scene === "string" ? body.scene : "ridge",
        zoneCells,
        custodianOrgId: String(body.custodianOrgId),
        sealedName: String(body.sealedName),
        sealedBoundary: String(body.sealedBoundary),
        sealedSignificance: String(body.sealedSignificance),
        sealedRestricted,
      },
      user,
    );
    return Response.json({ place }, { status: 201 });
  });
}
