// Prisma client over PostgreSQL, through the pg driver adapter (Prisma 7 query compiler).
//
// Nothing here can read a protected field: the `sealed*` columns are ciphertext produced
// in a custodian's browser. This process holds no key for them, by construction.

import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __noddiePrisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.local.example to .env.local, then run `npm run db:up && npm run db:migrate && npm run db:seed`.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Singleton, so dev hot-reload does not open a new pool per edit. */
export const prisma: PrismaClient = globalForPrisma.__noddiePrisma ?? create();
if (process.env.NODE_ENV !== "production") globalForPrisma.__noddiePrisma = prisma;

export class DatabaseUnavailableError extends Error {}

/** True when the schema has been migrated and seeded. Used by the setup screen. */
export async function databaseReady(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const orgs = await prisma.custodianOrg.count();
    if (orgs === 0) return { ok: false, reason: "Database is migrated but not seeded. Run `npm run db:seed`." };
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/does not exist|relation|42P01/i.test(message)) {
      return { ok: false, reason: "Schema not migrated. Run `npm run db:migrate`." };
    }
    return { ok: false, reason: `Cannot reach PostgreSQL. Run \`npm run db:up\`. (${message})` };
  }
}
