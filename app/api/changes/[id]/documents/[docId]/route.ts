// Download an issued instrument, re-hashing it on the way out so a viewer can see that the
// bytes they received are the bytes the transparency log committed to.

import { createHash } from "node:crypto";
import { handle, requireUser, httpError } from "@/lib/identity/verify";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return handle(async () => {
    await requireUser(req);
    const { id, docId } = await params;
    const doc = await prisma.noticeDocument.findFirst({
      where: { id: docId, changeRequestId: id },
    });
    if (!doc) throw httpError(404, "NOT_FOUND", "No such document.");

    const bytes = Buffer.from(doc.bytes);
    const recomputed = createHash("sha256").update(bytes).digest("hex");

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.filename}"`,
        "X-Document-SHA256": doc.sha256,
        "X-Document-SHA256-Recomputed": recomputed,
        "Cache-Control": "no-store",
      },
    });
  });
}
