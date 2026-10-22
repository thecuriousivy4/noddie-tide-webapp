// The activity log, plus a recomputation of the hash chain.

import { handle, requireUser } from "@/lib/identity/verify";
import { recent, verifyChain } from "@/lib/registry/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(req);
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);
    const [events, chain] = await Promise.all([recent(limit), verifyChain()]);
    return Response.json({
      chain,
      events: events.map((e) => ({
        seq: e.seq,
        at: e.at,
        actorName: e.actorName,
        actorRoles: e.actorRoles,
        action: e.action,
        target: e.target,
        detail: e.detail,
        prevHash: e.prevHash,
        hash: e.hash,
      })),
    });
  });
}
