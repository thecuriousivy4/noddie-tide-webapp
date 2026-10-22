// Synthetic seed data. All names, places, people and knowledge are fictional.
// No real place names, community names, people or cultural knowledge appear anywhere.

import type { AppUser, RestrictedLayer, SiteDetails } from "./types";

export interface SeedUser extends AppUser {
  /** Short line shown beside the account in the README and the sign-in help. */
  blurb: string;
  /**
   * Demo password for the simulated identity provider. Seeded as a scrypt hash; the
   * plaintext lives here only so the README can list credentials for judges.
   * TIDECLOAK: unused under the real realm, which authenticates through Tide enclaves.
   */
  password: string;
}

// The five linked actors plus the bootstrap system administrator (section 2).
export const SEED_USERS: SeedUser[] = [
  {
    id: "u-joan",
    username: "joan",
    password: "noddie-joan",
    name: "Elder Joan Mitchell",
    roles: ["tide-realm-admin", "custodian"],
    blurb: "Custodian elder. Records sites, reads details, approves change requests.",
  },
  {
    id: "u-ray",
    username: "ray",
    password: "noddie-ray",
    name: "Elder Ray Turner",
    roles: ["tide-realm-admin", "custodian"],
    blurb: "Custodian elder. Same as Joan; cannot read the restricted layer.",
  },
  {
    id: "u-lena",
    username: "lena",
    password: "noddie-lena",
    name: "Elder Lena Kane",
    roles: ["tide-realm-admin", "custodian", "custodian-women"],
    blurb: "Custodian elder who also holds the restricted layer standing.",
  },
  {
    id: "u-dana",
    username: "dana",
    password: "noddie-dana",
    name: "Dana Price",
    roles: ["proponent"],
    blurb: "Northgate Iron. Runs clearance checks, requests permits, lodges works notices.",
  },
  {
    id: "u-minister",
    username: "minister",
    password: "noddie-minister",
    name: "Minister M. Harding",
    roles: ["minister"],
    blurb: "Can view the permit queue and press consent — which has no effect alone.",
  },
  {
    id: "u-admin",
    username: "admin",
    password: "noddie-admin",
    name: "System Administrator",
    roles: ["tide-realm-admin"],
    blurb: "Full platform admin. Still cannot grant a permit without the elder quorum.",
  },
];

/**
 * The Traditional Owner corporations using the register.
 *
 * There is more than one on purpose. Noddie is not one community's database: a place belongs
 * to the corporation that holds it, and each corporation sets its own consent rule. Stony
 * Pass requires all three of its custodians to agree; Wattle Creek requires two of three.
 * Neither threshold is a constant anywhere in the application.
 */
export interface SeedOrg {
  id: string;
  name: string;
  contact: string;
  consentRule: string;
  quorumThreshold: number;
  custodianCount: number;
}

export const SEED_ORGS: SeedOrg[] = [
  {
    id: "wattle-creek-toc",
    name: "Wattle Creek Traditional Owners Corporation",
    contact: "heritage@wattlecreek.example",
    consentRule: "2 of 3 custodians, for every disclosure and every permit",
    quorumThreshold: 2,
    custodianCount: 3,
  },
  {
    id: "stony-pass-ac",
    name: "Stony Pass Aboriginal Corporation",
    contact: "country@stonypass.example",
    consentRule: "all 3 custodians must agree \u2014 this community does not permit a majority",
    quorumThreshold: 3,
    custodianCount: 3,
  },
];

export type PlaceScene = "shelters" | "overhang" | "spring" | "ridge";

export interface SeedSite {
  id: string;
  publicLabel: string;
  publicName: string; // friendly, non-sensitive name shown publicly
  scene: PlaceScene;
  publicSummary: string; // coarse, non-sensitive description shown to anyone
  landType: string; // e.g. "Rock country", "Gully", "Spring flat"
  /** The corporation that holds this place. */
  orgId: string;
  community: string;
  contact: string;
  zoneCells: string[];
  hasRestricted: boolean;
  details: SiteDetails;
  restricted?: RestrictedLayer;
  /** Which seed user should load this record (only they hold the right encryption role). */
  loadAs: string;
}

export const SEED_SITES: SeedSite[] = [
  {
    id: "RB-07",
    publicLabel: "Site RB-07",
    publicName: "Ironbark Ridge",
    scene: "shelters",
    publicSummary:
      "A low sandstone rise in rock country. A protected place is recorded here; its details are held by the community.",
    landType: "Rock country",
    orgId: "wattle-creek-toc",
    community: "Wattle Creek TOC",
    contact: "heritage@wattlecreek.example",
    zoneCells: ["E4", "E5", "F4", "F5"],
    hasRestricted: false,
    loadAs: "joan",
    details: {
      name: "Twin Shelters",
      description:
        "A pair of low rock shelters set into a sandstone rise above a dry watercourse. Charcoal and stone fragments in the floor deposit point to long, repeated use.",
      significance: "Occupation evidence spanning many generations of seasonal camps.",
      boundary: [
        [4.3, 3.5],
        [5.7, 3.4],
        [5.8, 4.7],
        [4.4, 4.8],
      ],
      recordedBy: "Elder Joan Mitchell",
      recordedOn: "2026-09-18",
    },
  },
  {
    id: "RB-12",
    publicLabel: "Site RB-12",
    publicName: "Hollowstone Gully",
    scene: "overhang",
    publicSummary:
      "A sheltered gully below a rocky outcrop. A protected place is recorded here; its details are held by the community.",
    landType: "Gully",
    orgId: "wattle-creek-toc",
    community: "Wattle Creek TOC",
    contact: "heritage@wattlecreek.example",
    zoneCells: ["H2", "H3"],
    hasRestricted: false,
    loadAs: "joan",
    details: {
      name: "Painted Overhang",
      description:
        "A single sheltered overhang carrying a faded pigment panel on its rear wall. The panel is fragile and sensitive to touch and light.",
      significance: "A rock art panel of continuing importance to the community.",
      boundary: [
        [7.2, 1.4],
        [7.8, 1.5],
        [7.7, 2.7],
        [7.3, 2.6],
      ],
      recordedBy: "Elder Joan Mitchell",
      recordedOn: "2026-09-25",
    },
  },
  {
    id: "RB-15",
    publicLabel: "Site RB-15",
    publicName: "Kingfisher Flat",
    scene: "spring",
    publicSummary:
      "An open flat beside a reliable spring. A protected place is recorded here; some of its knowledge is held under additional cultural restriction.",
    landType: "Spring flat",
    orgId: "wattle-creek-toc",
    community: "Wattle Creek TOC",
    contact: "heritage@wattlecreek.example",
    zoneCells: ["C6", "C7", "D6"],
    hasRestricted: true,
    loadAs: "lena",
    details: {
      name: "Spring Place",
      description:
        "An open ground beside a reliable spring, used as a gathering place. The surface retains arrangements that should not be disturbed.",
      significance: "A ceremony ground of ongoing cultural importance.",
      boundary: [
        [2.3, 5.3],
        [3.6, 5.4],
        [3.5, 6.6],
        [2.4, 6.7],
      ],
      recordedBy: "Elder Lena Kane",
      recordedOn: "2026-10-02",
    },
    restricted: {
      audience: "women",
      knowledge:
        "[Synthetic placeholder] This field stands in for women's knowledge that would, in a real register, be recorded only with the consent of the right people and never shown here.",
      protocol: "Not to be shown to men or visitors.",
    },
  },
  {
    id: "SP-04",
    publicLabel: "Site SP-04",
    publicName: "Quartz Saddle",
    scene: "ridge",
    publicSummary:
      "A saddle between two ridges. A protected place is recorded here; its details are held by the community.",
    landType: "Ridge country",
    orgId: "stony-pass-ac",
    community: "Stony Pass AC",
    contact: "country@stonypass.example",
    zoneCells: ["J6", "K6", "K7"],
    hasRestricted: false,
    loadAs: "joan",
    details: {
      name: "Quartz Saddle",
      description:
        "A low saddle carrying a scatter of worked quartz, exposed where the ground has thinned. The scatter runs further than the surface suggests.",
      significance: "A working place used across many generations, and a route between valleys.",
      boundary: [
        [9.3, 5.4],
        [10.7, 5.3],
        [10.8, 6.7],
        [9.4, 6.6],
      ],
      recordedBy: "Elder Joan Mitchell",
      recordedOn: "2026-10-11",
    },
  },
];

export function userByUsername(username: string): SeedUser | undefined {
  return SEED_USERS.find((u) => u.username === username);
}

/** Two-letter initials from the last two words of a name ("Elder Joan Mitchell" -> "JM"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((w) => !/^elder$/i.test(w));
  const take = parts.slice(-2);
  return take.map((w) => w[0]?.toUpperCase() ?? "").join("") || name.slice(0, 2).toUpperCase();
}

/** The three custodian elders who form the quorum. */
export const CUSTODIAN_SIGNERS = SEED_USERS.filter((u) => u.roles.includes("custodian")).map((u) => ({
  sub: u.id,
  name: u.name.replace(/^Elder\s+/, ""),
  initials: initialsOf(u.name),
}));
