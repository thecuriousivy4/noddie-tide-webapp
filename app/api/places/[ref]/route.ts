import { handle, requireUser } from "@/lib/identity/verify";
import { getByRef } from "@/lib/registry/places";
import { list } from "@/lib/registry/changes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  return handle(async () => {
    await requireUser(req);
    const { ref } = await params;
    const place = await getByRef(ref);
    if (!place) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: `${ref} is not on the register.` } },
        { status: 404 },
      );
    }
    const requests = await list({ placeId: place.id });
    return Response.json({
      place,
      requests: requests.map((r) => ({
        id: r.id,
        ref: r.ref,
        type: r.type,
        state: r.state,
        title: r.title,
        subjectName: r.subjectName,
        createdAt: r.createdAt,
        approvals: r.approvals.filter((a) => a.decision === "APPROVE").length,
        threshold: r.quorumThreshold,
      })),
    });
  });
}
