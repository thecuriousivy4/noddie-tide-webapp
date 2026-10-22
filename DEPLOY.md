# Deploying Noddie

GitHub stores this repository; it cannot run it. GitHub Pages serves static files only, and
Noddie needs a Node server (21 dynamic API routes), Prisma, and a live PostgreSQL database.
The repo stays on GitHub and a host runs it from there.

Verified before writing this: `npm run build` succeeds, and `npm run start` serves on the
`PORT` the host provides.

## First: the keys problem

Under `IDENTITY=mock` the app generates an RS256 signing key and one AES key per policy and
writes them to `data/keys.json`. That file is gitignored and must never be committed.

A deployed instance cannot rely on it. The build image is thrown away, so the first request
after each deploy would mint a **new** signing key — every existing session breaks, and every
record sealed under the old policy key becomes permanently unopenable.

Pin them instead:

```bash
npm run keys:export
```

Copy the single base64 line into the host's environment as `NODDIE_KEYS`.

> **This value is a secret.** It carries the signing key and every policy key, so whoever
> holds it can mint tokens and open every sealed record. Put it in the host's encrypted
> environment settings and nowhere else — never in the repo, an issue, or a chat.

Under `IDENTITY=tidecloak` none of this is reached: the signing key lives in the Tide network.

## Render (recommended — app and database in one place)

`render.yaml` in this repo is a Blueprint that provisions both services and wires
`DATABASE_URL` between them.

**1. Create the services.** In Render: **New → Blueprint**, select this repository, apply.
It creates the `noddie` web service and the `noddie-db` Postgres instance.

**2. Set the secret.** On the web service → **Environment**, add:

| Name | Value |
| --- | --- |
| `NODDIE_KEYS` | the line from `npm run keys:export` |

`DATABASE_URL` and `IDENTITY` are already set by the Blueprint.

**3. Migrate and seed**, once, from your machine. Copy the database's **External Database
URL** from its Render page (the internal URL only resolves inside Render):

```bash
DATABASE_URL="<external-url>" npx prisma migrate deploy
DATABASE_URL="<external-url>" npm run db:seed
```

The seed runs through `tsx`, a devDependency the build image drops, which is why this runs
locally rather than in `buildCommand`.

**4. Check it.** Open the service URL, sign in as `joan` / `noddie-joan`, and confirm the
register lists four places.

To re-stage the demo later, point the helper at the deployed host — edit `BASE` in
`scripts/demo-stage.py`, or just re-run the seed.

### Free-tier caveats

Worth knowing before this link goes in a submission:

- A **free web service sleeps after ~15 minutes idle**, and the next visitor waits roughly a
  minute for the cold start. A judge clicking an unattended link may think it is broken.
- A **free Postgres instance expires about 30 days** after creation.

Open the link yourself a minute before anyone else does, or take the paid starter instance,
which removes both problems.

## Vercel + Neon (alternative)

Vercel has first-class Next.js support but no database, so Neon supplies Postgres.

1. Create a Neon project; copy the **pooled** connection string.
2. Run the same `prisma migrate deploy` and `npm run db:seed` against it.
3. Import the repo at [vercel.com/new](https://vercel.com/new).
4. Set `DATABASE_URL`, `IDENTITY=mock` and `NODDIE_KEYS` for all environments.

`NODDIE_KEYS` matters more here, not less: Vercel runs many instances, and without it each
would sign tokens with a different key.

## Running the real realm

Everything above deploys the simulated identity, which labels itself on every screen. For
`IDENTITY=tidecloak` you also need a reachable TideCloak realm and `tidecloak.json` at the
project root. That file is gitignored — supply it to the host as a secret rather than
committing it — and set `KC_BASE_URL` and `KC_REALM`.

## Never deploy these

- `data/` — runtime key material. Gitignored. Use `NODDIE_KEYS`.
- `tidecloak.json` — per-realm adapter config. Gitignored.
- `.env` — local only. Set variables in the host's settings.
