// Seed: the custodian organisation, the scenario's people, and (dev identity only) the
// sample places.
//
// Places are sealed records. With a TideCloak realm configured, only a custodian's browser
// can produce them, so this script seeds no places and the register starts empty — a
// custodian signs in and presses "Load sample places" on the register page. Without a realm
// (dev identity), the script seals the fixtures itself so the demo is ready immediately,
// and says so on stdout.

import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { SEED_USERS, SEED_SITES, SEED_ORGS } from "../lib/fixtures";
import { devSeal } from "../lib/tide/devSeal";
import { hashPassword } from "../lib/identity/passwords";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.local.example to .env and try again.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SCENES: Record<string, string> = {
  shelters: "shelters",
  overhang: "overhang",
  spring: "spring",
  ridge: "ridge",
};

async function main() {
  const tidecloakMode =
    process.env.IDENTITY === "tidecloak" && existsSync(join(process.cwd(), "tidecloak.json"));

  // More than one corporation, on purpose: the register is not one community's database.
  // Each row carries its own consent rule, and the application reads the threshold from
  // whichever corporation holds the place in question.
  for (const org of SEED_ORGS) {
    await prisma.custodianOrg.upsert({ where: { id: org.id }, create: org, update: { ...org } });
    console.log(`· ${org.name} — ${org.consentRule}`);
  }

  for (const u of SEED_USERS) {
    // Stored as a scrypt hash with a per-user salt. The plaintext is never written.
    const { hash, salt } = await hashPassword(u.password);
    await prisma.userRef.upsert({
      where: { sub: u.id },
      create: {
        sub: u.id,
        username: u.username,
        name: u.name,
        devRoles: u.roles,
        blurb: u.blurb,
        seeded: true,
        passwordHash: hash,
        passwordSalt: salt,
      },
      update: {
        name: u.name,
        devRoles: u.roles,
        blurb: u.blurb,
        seeded: true,
        passwordHash: hash,
        passwordSalt: salt,
      },
    });
  }
  console.log(`· ${SEED_USERS.length} scenario accounts, each with a scrypt-hashed password`);

  if (tidecloakMode) {
    console.log("");
    console.log("IDENTITY=tidecloak — skipping sample places on purpose.");
    console.log("Protected fields can only be sealed in a custodian's browser, which is the");
    console.log("point. Sign in as a custodian and use \"Load sample places\" on /register.");
    console.log("(Joan loads RB-07 and RB-12; Lena loads RB-15, which has a restricted layer.)");
    return;
  }

  console.log("");
  console.log("SIMULATED IDENTITY. Sealing the sample places with the local per-policy keys");
  console.log("in data/keys.json. Ciphertext is prefixed dev1: so it can never be mistaken");
  console.log("for TideCloak's ms1:. Set IDENTITY=tidecloak for the real thing.");

  for (const s of SEED_SITES) {
    const sealedName = await devSeal("custodian-records", s.details.name);
    const sealedBoundary = await devSeal("custodian-records", s.details.boundary);
    const sealedSignificance = await devSeal("custodian-records", {
      significance: s.details.significance,
      description: s.details.description,
      recordedBy: s.details.recordedBy,
      recordedOn: s.details.recordedOn,
    });
    const sealedRestricted = s.restricted
      ? await devSeal("restricted-women", s.restricted)
      : null;

    const recorder = SEED_USERS.find((u) => u.username === s.loadAs)!;

    await prisma.place.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        publicRef: s.id,
        publicName: s.publicName,
        country: s.landType,
        publicSummary: s.publicSummary,
        scene: SCENES[s.scene] ?? "ridge",
        zoneCells: s.zoneCells,
        status: "QUIET",
        custodianOrgId: s.orgId,
        sealedName,
        sealedBoundary,
        sealedSignificance,
        sealedRestricted,
        hasRestricted: Boolean(sealedRestricted),
        recordedBySub: recorder.id,
        recordedByName: recorder.name,
      },
      update: {
        publicName: s.publicName,
        country: s.landType,
        publicSummary: s.publicSummary,
        zoneCells: s.zoneCells,
        sealedName,
        sealedBoundary,
        sealedSignificance,
        sealedRestricted,
        hasRestricted: Boolean(sealedRestricted),
      },
    });
    console.log(`· place ${s.id} — ${s.publicName} (sealed, ${s.restricted ? "with" : "no"} restricted layer)`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("");
    console.log("Seed complete.");
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
