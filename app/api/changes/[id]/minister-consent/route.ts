// A minister presses consent. The request records it and does not move.
//
// This route exists in order to be pressed: it returns 200, writes an audit line saying the
// effect was none, and reports the unchanged tally. Consent from this office is an input to
// the community's decision, not a decision.

import { handle, requireUser, httpError } from "@/lib/identity/verify";
import { GovernanceError, recordMinisterConsent, tally } from "@/lib/registry/changes";
import { remember } from "@/lib/registry/users";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, "minister");
    await remember(user);
    const { id } = await params;
    try {
      const updated = await recordMinisterConsent(id, user);
      const t = tally(updated);
      const state = updated.state.replace(/_/g, " ").toLowerCase();
      return Response.json({
        state: updated.state,
        tally: t,
        effect: "none",
        message:
          "Recorded. The request is still " +
          state +
          " and still needs " +
          t.outstanding +
          " custodian approval(s). A minister's consent is not a quorum signature.",
      });
    } catch (err) {
      if (err instanceof GovernanceError) throw httpError(err.status, err.code, err.message);
      throw err;
    }
  });
}
