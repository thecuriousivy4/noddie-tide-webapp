// Append-only transparency log.
//
// Every state transition, document issued, approval recorded and decrypt authorization
// lands here, chained: each row's hash covers the previous row's hash. Nothing in the app
// updates or deletes a row, so a removed or edited event breaks the chain and the
// Transparency screen says so.

import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { AuditEvent, Prisma } from "@/lib/generated/prisma/client";

export const GENESIS = "0".repeat(64);

/** Advisory-lock key for appends. Arbitrary, but stable — every writer must use this one. */
const CHAIN_LOCK = 8_270_441;

export interface AuditInput {
  actorSub: string;
  actorName: string;
  actorRoles?: string[];
  action: string;
  target: string;
  detail?: Record<string, unknown>;
}

/** Stable serialisation — key order must not depend on object construction order. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

export function eventHash(prevHash: string, payload: Record<string, unknown>): string {
  return createHash("sha256").update(prevHash).update(canonical(payload)).digest("hex");
}

/**
 * Append one event. Serialised through a transaction so two concurrent writes cannot
 * chain off the same parent; the unique constraint on `hash` is the backstop.
 */
export async function record(input: AuditInput): Promise<AuditEvent> {
  const at = new Date();
  // Normalise through JSON first: whatever Postgres will hand back is what must be hashed,
  // and a Date in the payload is a string once it has been through JSONB.
  const detail = JSON.parse(JSON.stringify(input.detail ?? {})) as Record<string, unknown>;
  return prisma.$transaction(async (tx) => {
    // A hash chain cannot be appended to concurrently: two transactions that both read the
    // same last row would both chain off it, and the second link would be wrong for the row
    // that actually preceded it. Read Committed does not prevent that, and the unique
    // constraint on `hash` only catches byte-identical payloads — two different events
    // chaining off the same parent slip straight through.
    //
    // So appends are serialised on a transaction-scoped advisory lock. It is held until this
    // transaction commits, which makes "read the tip, then extend it" atomic for every
    // writer in the process and across processes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK})`;

    const last = await tx.auditEvent.findFirst({ orderBy: { seq: "desc" } });
    const prevHash = last?.hash ?? GENESIS;
    const payload = {
      at: at.toISOString(),
      actorSub: input.actorSub,
      actorName: input.actorName,
      actorRoles: input.actorRoles ?? [],
      action: input.action,
      target: input.target,
      detail,
    };
    return tx.auditEvent.create({
      data: {
        at,
        actorSub: input.actorSub,
        actorName: input.actorName,
        actorRoles: input.actorRoles ?? [],
        action: input.action,
        target: input.target,
        detail: detail as Prisma.InputJsonValue,
        prevHash,
        hash: eventHash(prevHash, payload),
      },
    });
  });
}

export async function recent(limit = 200): Promise<AuditEvent[]> {
  return prisma.auditEvent.findMany({ orderBy: { seq: "desc" }, take: limit });
}

export async function forTarget(target: string): Promise<AuditEvent[]> {
  return prisma.auditEvent.findMany({ where: { target }, orderBy: { seq: "asc" } });
}

export interface ChainCheck {
  events: number;
  intact: boolean;
  brokenAtSeq?: number;
}

/** Recompute the chain from the start. Shown on the Transparency screen. */
export async function verifyChain(): Promise<ChainCheck> {
  const all = await prisma.auditEvent.findMany({ orderBy: { seq: "asc" } });
  let prevHash = GENESIS;
  for (const e of all) {
    const payload = {
      at: e.at.toISOString(),
      actorSub: e.actorSub,
      actorName: e.actorName,
      actorRoles: e.actorRoles,
      action: e.action,
      target: e.target,
      detail: e.detail,
    };
    if (e.prevHash !== prevHash || e.hash !== eventHash(prevHash, payload)) {
      return { events: all.length, intact: false, brokenAtSeq: e.seq };
    }
    prevHash = e.hash;
  }
  return { events: all.length, intact: true };
}
