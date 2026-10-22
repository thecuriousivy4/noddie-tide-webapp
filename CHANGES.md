# Build notes and deliberate deviations

A record of what is real in this build, what differs from the original design plan (since
removed), and why. The plan described a SQLite-plus-simulation build; this document and the
README supersede it.

The app has been rebuilt on the stack the brief calls for: **PostgreSQL + Prisma**, real
**TideCloak** authentication through `@tidecloak/nextjs`, server-side PDF generation with
SHA-256 in an append-only log, a governance state machine, and a public-register interface.
The earlier SQLite-plus-simulation build is gone.

## What is real

- **PostgreSQL + Prisma 7** (pg driver adapter). `prisma/schema.prisma`, one checked-in
  migration, `prisma/seed.ts`, `docker-compose.yml`. Protected columns (`sealedName`,
  `sealedBoundary`, `sealedSignificance`, `sealedRestricted`) hold ciphertext strings the
  server never parses. Verified: `select left("sealedName",28) from place` returns prefixed
  ciphertext and nothing else.
- **Token-only authorization.** Every route handler verifies the bearer token and reads roles
  from `realm_access.roles`. No handler reads a role from a request body, a cookie or a table.
  With a realm configured, verification is `verifyTideCloakToken(config, token)`; the app
  holds no signing key.
- **The works-notice gate** (`app/api/works-notices/route.ts`) consults the token and nothing
  else. Verified: refused for the proponent before commit, refused for a platform admin,
  refused on the proponent's *old* token after commit, accepted only after a token refresh,
  and still refused for a second place the permit does not cover.
- **The quorum.** `DRAFT → NOTICE_ISSUED → PENDING_QUORUM → APPROVED|REJECTED → COMMITTED`,
  with the threshold read from the custodian organisation rather than a constant. Four-eyes is
  enforced: the initiator cannot approve, and one custodian cannot approve twice. Two denials
  that put the threshold out of reach refuse the request and issue a refusal notice.
- **Ministerial consent is inert.** `POST /api/changes/:id/minister-consent` returns 200,
  writes a permanent record, and changes neither the state nor the tally. Verified.
- **Documents.** `pdf-lib`, server-side: works notice, ministerial announcement, instrument of
  consent, refusal notice, lodgement receipt. Each is hashed with SHA-256, the hash is written
  to the log at the moment of issue, and the download route re-hashes the bytes on the way out
  so a viewer can compare.
- **Append-only transparency log** with a hash chain — each row's hash covers the previous
  row's hash. The Transparency screen recomputes the whole chain and names the first broken
  row. Verified intact across a full 60-check run of the scenario.
- **Browser-side sealing.** Protected fields are encrypted in a custodian's browser before
  they are sent. There is no server code path that can seal or open them with a realm
  configured, which is also why the seed script records no places in that mode.

## Deliberate deviations, and why

- **Tailwind was not adopted.** The brief asks for Tailwind "tuned to a public-sector system",
  and §6 describes the result rather than the tool. The project already had a hand-built design
  system in `app/globals.css` matching that description — typographic, hairline borders, one
  ochre accent, no shadows or decorative gradients — so the work went into the §6 components
  (records tables with sortable columns, status lozenges, the authority panel, official
  masthead and footer) instead of into a framework migration that would have changed nothing
  a judge can see.
- **`pdf-lib` instead of QuestPDF / `@react-pdf/renderer` / Playwright.** Still server-side,
  still a real PDF, no headless browser in the container.
- **`react-three-fiber` instead of MapLibre.** The brief requires an abstract basin with no
  real basemap, no projection and no coordinates. MapLibre exists to render basemaps; a
  deterministic heightfield over the register's own 12×8 zone grid gives the abstraction the
  cultural-safety rule asks for. Places are soft discs sized to the cells they were recorded
  against — never pins, never smaller than a cell and a half, labelled "positions indicative
  only".
- **The app does not write roles into tokens.** `COMMITTED` records that the community
  consented. With a realm configured, the role grant itself is carried by the realm's IGA
  quorum and signed by the network. An app that could grant itself a permit role would
  contradict the entire argument, so this one cannot, and the UI says so where it matters.
- **`data/policies/*.b64`.** Committed Forseti policy bytes are read from disk rather than
  created in-app; there is no policy-authoring screen. `app/api/policy/route.ts` serves those
  bytes (public, signed) and audits every release.

## Dev identity: what it is and what it is not

With no `tidecloak.json` in the project root and `NODDIE_DEV_IDENTITY=1` set, the app runs a
labelled local identity: RS256 tokens minted for the seeded accounts, per-policy AES keys in
`data/keys.json`, ciphertext prefixed `dev1:` rather than TideCloak's `ms1:`, and a dark red
banner on every screen. `/api/dev/*` and `/api/jwks` return 404 the moment a realm is
configured, and the public page's account list disappears in favour of a TideCloak redirect.

This exists so the register can be developed and judged without a licensed realm. The
governance rules, the state machine, the hash chain and the token-only gate are identical in
both modes. What is not real in dev mode is the identity and the key custody — so the honest
prefix is `dev1:`, not `ms1:`.

Acceptance criterion 2 ("the DB shows only `ms1:` ciphertext") therefore holds exactly when a
realm is configured and a custodian has recorded the places from their browser. In dev mode
the same column shows `dev1:`, which is the same claim with its real provenance attached.

## Verification run

`60 checks, 0 failed` against a running server and a seeded database, covering: policy
refusals for proponent/admin/Ray and the allowance for Joan/Lena; ciphertext in every
protected column; clearance returning public fields only; duplicate requests refused;
decisions blocked before notice; notice hash matching the downloaded PDF; the gate before and
after commit; ministerial consent having no effect; double-approval, early-commit, four-eyes
and non-custodian commit all refused; the refusal path; the three proofs; the intact audit
chain; and 401 for a missing or tampered token.

## Swapping in the realm

The Tide-facing seams are narrow:

- `lib/identity/mode.ts` — detects `tidecloak.json` and decides the mode.
- `lib/identity/verify.ts` — `verifyTideCloakToken` with a realm, local JWKS without one.
- `lib/identity/client.tsx` — mounts `TideCloakProvider` and maps `useTideCloak()` to the one
  interface the UI uses; `doEncrypt`/`doDecrypt` with signed policy bytes live here.
- `proxy.ts` — `createTideCloakProxy` route protection, pass-through without a realm.
- `app/api/policy/route.ts` — serves committed policy bytes instead of a dev key.

The README carries the full realm setup this repository needs: container, realm roles, the
five linked users, the elder quorum under IGA, and the two Forseti policies.

## v0.3 — multi-page task flows, top navbar, simulated TideCloak

The single dense dashboard is gone. The service is now a top navbar over discrete task flows,
and the identity layer is an explicit, labelled simulation of TideCloak with one flag to flip.

- **Navigation.** Two-row masthead (authority lockup + account, then Register / Requests /
  Transparency / Activity) and breadcrumbs on every page. No sidebar. The signed-in landing is
  an acknowledgement, the roles in your token, and the two or three tasks your roles permit.
- **Task flows.** Recording a place is Start → Public details → Protected details → Check your
  answers → Receipt. Lodging a works notice is Start → Affected place → Notice details → Check
  → Confirmation. A custodian decision is Decide → Check → Confirmation. Each step is its own
  URL, and nothing irreversible happens before the check screen. Opening a place, a request or
  a decision navigates to a page; nothing expands in place.
- **Confirmations state what they did NOT do.** A served notice says it created no permit; a
  recorded decision says it granted nothing; a commit says the role has not been written into
  anyone's token by this service.
- **Sign-in is a credential form.** `POST /api/auth/signin` with a username and password,
  checked against a scrypt hash with a per-user salt and a constant-time comparison, answered
  with an RS256 token verified against a JWKS on every protected route. The persona picker is
  gone. An unknown username and a wrong password return the same message, and the unknown-user
  path still spends the hashing work.
- **One flag, two backends.** `IDENTITY=mock|tidecloak`. Sixteen `// TIDECLOAK:` markers across
  fourteen files sit at the exact lines that change; the README maps each seam to its real
  replacement. The TideCloak path (`TideCloakProvider`, `useTideCloak`, `createTideCloakProxy`,
  `verifyTideCloakToken`, policy-enabled `doEncrypt`/`doDecrypt`) is wired, not stubbed — it
  activates on `tidecloak.json` plus the flag.
- **The simulation labels itself.** A non-dismissible banner on every signed-in screen, `dev1:`
  ciphertext rather than `ms1:`, and an issuer of `https://simulated.noddie.local/...`. The
  honest claim is that verification, role checks, four-eyes, the hash chain and the gate are
  real mechanics; the key custody is local.
- **Public Sans** carries the service; Fraunces is now scoped to the public page only.
- **Routes consolidated.** `/decisions`, `/applications`, `/check`, `/queue` and `/audit` are
  replaced by `/requests` (filtered by what needs your action) and `/activity`. The clearance
  check became the "affected place" step of the works-notice flow, which is where a proponent
  actually needs it.
- **Schema.** `user_ref` gains `passwordHash` and `passwordSalt` (migration
  `1_simulated_signin`). Both are dead under `IDENTITY=tidecloak`, and the schema says so.

Verification run after the restructure: **62 checks, 0 failed**, including the two new
credential checks (wrong password refused; unknown username refused with an identical message).

### Deviation from the brief, unchanged from v0.2

`pdf-lib` is still used for server-side PDFs rather than `@react-pdf/renderer` or Playwright —
real PDFs, real hashes, no headless browser. Tailwind was not adopted; §6 of the brief describes
a result, and the hand-built CSS system now implements it with gov-style boxy components, strong
focus rings, breadcrumbs and the check-your-answers pattern.

### Not available on this machine

The Tide MCP (Raziel) was not connected, so integration points were planned against the
installed `@tidecloak/nextjs` SDK — its front-channel guide and the type signatures of
`TideCloakProvider`, `useTideCloak()`, `createTideCloakProxy` and `verifyTideCloakToken` —
rather than from a playbook. The seam table in the README is derived from what those APIs
require.

## v0.4 — Noddie is the platform again, and more than one community proves it

The service chrome had drifted into calling itself "Ridgeline Basin Heritage Register", with a
masthead reading "An instrument of the Wattle Creek Traditional Owners Corporation". That
framed the product as one community’s in-house database, which the data model never agreed
with and which is the wrong claim for this project to make.

- **Renamed back to Noddie**, with the subtitle "each place held by its own Traditional Owner
  corporation". Ridgeline Basin is what it always was: the scenario’s region, labelled
  "indicative" on the map.
- **Issued documents put the corporation first.** A notice or instrument is now mastheaded
  with the holding corporation’s name, and the line beneath reads "Issued through the Noddie
  heritage register". The software does not sign a community’s consent.
- **A second corporation in the seed.** Stony Pass Aboriginal Corporation holds SP-04 and
  requires **all three** of its custodians to agree, against Wattle Creek’s two of three.
  Six new checks in `npm run verify` prove the threshold is read from the holding corporation:
  a request against SP-04 reports a threshold of 3, two approvals leave it pending, and the
  third carries it.
- **Recording a place now asks which corporation holds it**, and the register table shows the
  holder as a sortable column.

Known limit introduced by being honest about this: the `custodian` role is realm-wide, so in
this prototype a custodian can decide another corporation’s requests even though the
threshold applied is always the holder’s. Scoping custodianship per corporation is a
TideCloak roles/groups change, noted in the README.

Verification after the rename: **68 checks, 0 failed**.

### Bug found and fixed during the rename: a race on the hash chain

A verification run reported the chain broken at event 21, and the culprit turned out to be a
clearance check from a browser session that interleaved with the run. `record()` read the tip
of the chain and then extended it inside one transaction, but Read Committed does not stop two
transactions reading the same tip — and the unique constraint on `hash` only catches
byte-identical payloads, so two different events chaining off the same parent went straight
through.

Appends are now serialised on a transaction-scoped Postgres advisory lock, which makes "read
the tip, then extend it" atomic across every writer and every process. `npm run verify:race`
fires 24 overlapping writes through four different code paths and then recomputes the chain:
28 events, intact. Before the fix, a single interleaved request was enough to break it.
