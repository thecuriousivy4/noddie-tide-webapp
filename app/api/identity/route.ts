// What identity backend the browser should mount, and the public adapter config when there
// is one. Fetched at runtime rather than imported at build time, because tidecloak.json
// only appears once a realm has been initialised.

import { adapterConfig, identityMode, isSimulated, realmIssuer, tidecloakMisconfigured } from "@/lib/identity/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = adapterConfig();
  return Response.json(
    {
      mode: identityMode(),
      simulated: isSimulated(),
      // Client adapter config is public by design (realm, url, client id).
      config: identityMode() === "tidecloak" ? config : null,
      realm: config?.realm ?? null,
      issuer: realmIssuer(),
      misconfigured: tidecloakMisconfigured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
