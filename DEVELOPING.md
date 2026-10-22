# Noddie — a heritage register held by community

**No nod, no dig.**

Noddie is register software that Traditional Owner corporations use to record culturally
significant places. It is not one community’s database: every place belongs to the
corporation that holds it, and **each corporation sets its own consent rule**. Proponents and
ministers must obtain that community’s custodian quorum before any works affecting one of
its places.

The demonstrated point: no single actor — not an administrator, not the server, not a minister
— can read protected details or grant a permit alone. Authority exists only once the right
community’s custodians align.

The scenario in the seed is the fictional **Ridgeline Basin**, with two corporations in it:

| Corporation | Places | Its consent rule |
| --- | --- | --- |
| Wattle Creek Traditional Owners Corporation | RB-07, RB-12, RB-15 | 2 of 3 custodians |
| Stony Pass Aboriginal Corporation | SP-04 | all 3 custodians — no majority |

Neither threshold is a constant anywhere in the code. A request against SP-04 needs three
approvals because Stony Pass says so, and `npm run verify` proves that two are not enough.

Built for the RMIT GenAI & Cybersecurity Hackathon (Tide UNLOCKED challenge).

> Everything here is synthetic. All places, people, communities and cultural knowledge are
> invented. No Aboriginal art, motif or iconography is imitated anywhere in the interface, and
> no real agency branding or crest is used. Real use would require co-design led by Traditional
> Owners, under their governance.

---

## Run it

Prerequisites: Node 22+, Docker Desktop running.

```bash
cp .env.local.example .env
npm install
npm run db:up        # PostgreSQL 17 on localhost:5433
npm run db:migrate   # apply prisma/migrations
npm run db:seed      # community, accounts, and the sample places
npm run dev          # http://localhost:3000
```

`npm run setup` runs the three database steps in one line.

### Sign in

The register runs with a **simulated identity provider** by default (`IDENTITY=mock`). Sign-in
is a real credential form — username and password, checked against a scrypt hash, answered with
a signed token that every protected route verifies. There is no account list to click.

| Username | Password | Person | Roles in their token |
| --- | --- | --- | --- |
| `joan` | `noddie-joan` | Elder Joan Mitchell | `custodian`, `tide-realm-admin` |
| `ray` | `noddie-ray` | Elder Ray Turner | `custodian`, `tide-realm-admin` |
| `lena` | `noddie-lena` | Elder Lena Kane | `custodian`, `custodian-women`, `tide-realm-admin` |
| `dana` | `noddie-dana` | Dana Price (Northgate Iron) | `proponent` |
| `minister` | `noddie-minister` | Minister M. Harding | `minister` |
| `admin` | `noddie-admin` | System Administrator | `tide-realm-admin` |

Lena holds the quorum-granted standing that opens the restricted cultural layer; Ray is a
custodian and still cannot read it. That difference is the point of having both.

---

## What this is, as a service

A top navbar, no sidebar, and no catch-all dashboard. The signed-in landing page carries an
acknowledgement, who you are, the roles the identity provider signed into your token, and the
two or three tasks your roles permit. Everything else is a page of its own.

Every action is a task flow: **start → form → check your answers → confirmation**, with
breadcrumbs, and nothing irreversible happens before the check screen.

| Route | What it is |
| --- | --- |
| `/` | Public page: Acknowledgement of Country, the case, sign-in |
| `/signin` | Username + password (or, under TideCloak, one button to the realm) |
| `/home` | Signed-in landing: your authority, and your tasks |
| `/register` | Browse places — sortable records table with the holding corporation, public columns only |
| `/register/[ref]` | Place detail — protected fields gated, withheld state shown plainly |
| `/register/new` | **Task:** record a place · Start → Public details (incl. holding corporation) → Protected details → Check → Receipt |
| `/requests` | Change requests, filtered by what needs your action |
| `/requests/new` | **Task:** lodge a works notice · Start → Affected place → Notice details → Check → Confirmation |
| `/requests/[id]` | The full chain: routing, quorum tally, each decision, proofs, trail |
| `/requests/[id]/decide` | **Task:** a custodian's decision · Decide → Check → Confirmation |
| `/transparency` | What the server actually holds — ciphertext, verbatim |
| `/activity` | Append-only, hash-chained activity log |
| `/guide` | The seven-step demonstration with live checks |

---

## The claim, and where to check it

| Claim | Where |
| --- | --- |
| The database holds ciphertext, not places | `/transparency`, or `docker exec noddie-postgres psql -U noddie -d noddie -c 'select "sealedName" from place'` |
| No decryption key exists server-side | `app/api/policy/route.ts`. Under TideCloak the server serves public *signed policy bytes* and never a key |
| A plain administrator cannot read a place | Sign in as `admin`, open any place, press **Open the record** → declined |
| A custodian without the women's standing cannot read the restricted layer | Sign in as `ray`, open RB-15 → declined. As `lena` → opens |
| A minister cannot grant a permit | `/requests/[id]` → **Record consent**. Returns 200, kept permanently, moves nothing |
| A permit needs that community's quorum | `/requests/[id]/decide`. RB-07 needs two of three; SP-04 needs all three. The initiator cannot approve; one custodian cannot approve twice |
| The gate trusts only a signed token | `app/api/works-notices/route.ts` reads `realm_access.roles` and consults no table |
| Notices are real documents with real hashes | `/requests/new` issues a PDF; its SHA-256 is in `/activity` before any decision |
| The log cannot be quietly edited | Each entry's hash covers the previous entry's. `/transparency` recomputes the chain |
| The log holds up under concurrent use | `npm run verify:race` fires 24 overlapping writes and recomputes the chain. Appends are serialised on a Postgres advisory lock, so two writers cannot chain off the same parent |

`npm run verify` asserts all of the above and more — 68 checks over the real HTTP API. It needs
the dev server running and a freshly seeded database:

```bash
npm run db:reset && npm run db:seed
npm run dev
npm run verify        # 68 checks, 0 failed
```

---

## Simulated identity → real TideCloak

Per Tide's instruction for this hackathon, the app is **built as though TideCloak protects it**
and simulates TideCloak's sign-in, roles and access checks locally. The simulation is honest
about itself: a dark banner on every signed-in screen, ciphertext prefixed `dev1:` rather than
TideCloak's `ms1:`, and an issuer claim of `https://simulated.noddie.local/...`.

One environment flag switches backends — `IDENTITY=mock` or `IDENTITY=tidecloak` — and every
seam carries a `// TIDECLOAK:` comment at the exact line that changes (16 of them across 14
files; `grep -rn "TIDECLOAK:" app lib prisma proxy.ts`).

> The Tide MCP (Raziel) was not connected to the machine this was built on, so the integration
> points were planned against the installed `@tidecloak/nextjs` SDK itself — its front-channel
> guide, `TideCloakProvider`, `useTideCloak()`, `createTideCloakProxy` and
> `verifyTideCloakToken` type signatures — rather than from a Raziel playbook. The seam list
> below is what those APIs actually require.

| Seam | Simulated now | Real TideCloak | File |
| --- | --- | --- | --- |
| Mode switch | `IDENTITY=mock` | `IDENTITY=tidecloak` + `tidecloak.json` | `lib/identity/mode.ts` |
| Provider | `MockBridge` | `<TideCloakProvider config={adapter}>` | `lib/identity/client.tsx` |
| Sign-in | `POST /api/auth/signin`, scrypt hash | `useTideCloak().login()` → realm redirect → Tide enclave | `app/api/auth/signin/route.ts`, `app/signin/page.tsx` |
| Sign-out | clears the session cookie | `useTideCloak().logout()` | `app/api/auth/signout/route.ts` |
| Token issue | RS256, local keypair in `data/keys.json` | threshold-signed by the Tide network; app holds no key | `lib/tide/tokens.ts` |
| Token refresh | `POST /api/auth/token` re-mints from the session | `useTideCloak().forceRefreshToken()` | `app/api/auth/token/route.ts` |
| JWKS | `GET /api/auth/jwks` | realm `/protocol/openid-connect/certs` | `app/api/auth/jwks/route.ts` |
| Token verify | `jose.jwtVerify` against the local JWKS | `verifyTideCloakToken(config, token)` | `lib/identity/verify.ts` |
| Route protection | API handlers verify every request | `createTideCloakProxy({ config, protectedRoutes })` (already wired, pass-through without a realm) | `proxy.ts` |
| Field seal | AES-256-GCM in the browser, `dev1:` prefix | `doEncrypt(data, policyBytes)`, `ms1:` prefix | `lib/crypto-browser.ts`, `lib/identity/client.tsx` |
| Field open | AES-GCM with a key released by `/api/policy` to a role-bearing token | `doDecrypt(data, policyBytes)` — the ORK nodes run the Forseti contract and refuse the wrong role | `app/api/policy/route.ts` |
| Policy material | per-policy AES key | committed Forseti policy bytes from `data/policies/*.b64` (public, signed) | `app/api/policy/route.ts` |
| Role grant on commit | the provider starts issuing the role; holder must refresh | realm IGA quorum commits; network signs it in | `lib/registry/changes.ts` |
| Passwords | scrypt hash + salt on `user_ref` | none — there is no password in the realm to hold | `lib/identity/passwords.ts`, `prisma/schema.prisma` |
| Account roster | `GET /api/identity/accounts` for the sign-in page | 404s; realm accounts are not the app's to list | `app/api/identity/accounts/route.ts` |

### Switching it on

1. `npm run tide:up` starts `tideorg/tidecloak-dev` on `localhost:8080`. The realm has to be
   initialised once with a free dev licence (≤100 users) — see
   [tidecloak-gettingstarted](https://github.com/tide-foundation/tidecloak-gettingstarted). That
   step is interactive and needs a person.
   *Port 8080 must be free; stop anything else bound to it first.*
2. Create realm roles `custodian`, `custodian-women`, `proponent`, `minister`, and one
   `permit-rb07`-style role per place.
3. Create users `joan`, `ray`, `lena`, `dana`, `minister`, link each to a Tide account in its
   own browser profile, and map the roles in the table above.
4. Enable IGA and build the elder quorum: grant `tide-realm-admin` to Ray, then Lena,
   approving each change request in the enclave. With three admins the realm admin policy needs
   two approvals, so no single administrator can change a role mapping.
5. Create and commit two Forseti policies, then save each one's signed bytes (base64) to
   `data/policies/custodian-records.b64` and `data/policies/restricted-women.b64`:

   | Label | Encrypt role | Decrypt role |
   | --- | --- | --- |
   | `custodian-records` | `custodian` | `custodian` |
   | `restricted-women` | `custodian-women` | `custodian-women` |

6. Put the client adapter config at `tidecloak.json`, set `IDENTITY=tidecloak` in `.env`, and
   restart. Redirect URI for the client: `http://localhost:3000/auth/redirect`.

The sign-in page becomes a single button, `/api/auth/*` and `/api/identity/accounts` return 404,
the simulation banner disappears, and new records seal as `ms1:`.

---

## The seven-step demonstration

`/guide` walks these with live checks. Sign in as the named person each time — the point is that
no single person can do all of it.

1. **joan** — *Register → Load sample places.* Protected fields are sealed in her browser; the
   server receives ciphertext.
2. **lena** — loads RB-15, which carries a separately sealed restricted layer. Ray holds
   `custodian` and still cannot open it.
3. **dana** — *Requests → Start a works notice.* Zones `E4 E5 F4 F5`. She gets a reference, a
   land description and a contact. Never a name, never a boundary.
4. **dana** — completes the flow. A PDF notice is generated and its SHA-256 written to the log:
   proof of notice served, fixed before anyone decides. `DRAFT → NOTICE_ISSUED → PENDING_QUORUM`.
5. **minister** — opens the request and records a consent. Kept permanently, counted nowhere,
   tally unchanged. This is the step the whole project exists for.
6. **joan**, then **ray** — each opens `/requests/[id]/decide` from their own session. Four-eyes
   is enforced. At 2 of 3 the request becomes `APPROVED`; a custodian commits it and the
   instrument of consent is issued.
7. **dana** — *Lodge works notice* on the request page. Before refreshing her token: refused,
   because the token carries no permit role. After **Refresh token**: accepted, and the receipt
   quotes the token it was checked against.

Close on `/transparency` as **admin**: ciphertext in every protected column, an intact chain,
and a permit column that is a record rather than an authority.

---

## Governance state machine

```
DRAFT ──serve notice──► NOTICE_ISSUED ──► PENDING_QUORUM ──┬── approvals ≥ threshold ──► APPROVED ──commit──► COMMITTED
                                                           └── threshold unreachable ───► REJECTED
```

- Routing is data, not code: a place names its `CustodianOrg`, and the organisation names its
  own `quorumThreshold` and `consentRule`.
- `ministerConsent` is an input recorded on the request. It is never counted in a tally, and it
  appears in the issued instrument marked "not counted".
- `COMMITTED` means the community consented. It does not mean this service granted anything:
  the role reaches the holder only in a newly issued token, and every gate re-reads the token.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + TypeScript + React 19 |
| Identity | swappable: simulated provider, or **TideCloak** via `@tidecloak/nextjs` |
| Database | **PostgreSQL 17 + Prisma 7** (pg driver adapter); protected columns hold ciphertext |
| JWT | `jose` — RS256 sign and verify, JWKS |
| Documents | `pdf-lib`, server-side, SHA-256 per document |
| Abstract map | `three` + `@react-three/fiber` over a synthetic heightfield — no basemap, no coordinates |
| Typeface | Public Sans (service), Fraunces (public page), IBM Plex Mono (references) |
| Styling | hand-built CSS design system in `app/globals.css` |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:up` / `db:down` | PostgreSQL via docker compose |
| `npm run db:migrate` / `db:reset` | apply / recreate the schema |
| `npm run db:seed` | community, accounts, sample places |
| `npm run db:studio` | Prisma Studio — handy for showing raw ciphertext |
| `npm run demo` | reset to the two-minute demo's opening position (CR-2026-0001 pending quorum) |
| `npm run verify` | 68-check run of the whole scenario over the API |
| `npm run verify:race` | 24 concurrent writes, then recompute the hash chain |
| `npm run tide:up` / `tide:down` | TideCloak dev container |

## Known limits

- The realm's IGA quorum and this register's change-request quorum are two mechanisms running
  side by side. The register records the community's consent; the realm carries the role grant.
  The app deliberately cannot write a role into a token.
- `data/policies/*.b64` has to be filled in by hand after committing each Forseti policy. There
  is no in-app policy authoring screen.
- The simulated provider is for development and for judging without a licensed realm. It is not
  a security claim, and it says so on every screen it appears on.
- **The `custodian` role is realm-wide, not per-corporation.** In this prototype a custodian can
  decide requests for any corporation on the register; the threshold that applies is always the
  holding corporation’s, but who counts as its custodian is not yet scoped. A real deployment
  would scope custodianship per corporation — in TideCloak terms, a client role or group per
  corporation rather than one realm role — so that Wattle Creek’s elders cannot decide Stony
  Pass’s places.
