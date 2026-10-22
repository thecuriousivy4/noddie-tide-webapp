// Simulated identity provider: sign out. Clears the session cookie; the token itself is
// discarded by the browser.
//
// TIDECLOAK: becomes `useTideCloak().logout()`, which ends the realm session too.

import { clearSession } from "@/lib/tide/session";

export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return Response.json({ ok: true });
}
