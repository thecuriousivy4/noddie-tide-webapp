# Deploying Noddie

GitHub stores this repository; it cannot run it. GitHub Pages serves static files only, and
Noddie needs a Node server (21 dynamic API routes), Prisma, and a live PostgreSQL database.
So the repo stays on GitHub and a host runs it from there.

The build is verified: `npm run build` succeeds, 10 static pages and 21 dynamic routes.

## Before you pick a host: the keys problem

Under `IDENTITY=mock` the app generates an RS256 signing key and one AES key per policy, and
writes them to `data/keys.json`. That file is gitignored and must not be committed.

A deployed instance cannot rely on it. Serverless filesystems are read-only and per-request,
and any host running two instances would have each generate its own keys — tokens signed by
one would fail verification on the other, and records sealed under one instance's policy key
could never be opened again.

Set `NODDIE_KEYS` instead. It pins one set of keys across every instance and restart:

```bash
npm run keys:export
```

Copy the single base64 line into the host's environment settings.

> **This value is a secret.** It carries the signing key and every policy key, so whoever
> holds it can mint tokens and open every sealed record. Put it in the host's encrypted
> environment settings and nowhere else — never in the repo, an issue, or a chat.

Under `IDENTITY=tidecloak` none of this applies: the signing key lives in the Tide network
and the app holds no key at all.

## Option A — Vercel + Neon (recommended)

Vercel has first-class Next.js support; Neon gives you a free Postgres. Two signups.

1. **Database.** Create a project at [neon.tech](https://neon.tech) and copy its pooled
   connection string.
2. **Schema and seed**, from your machine, pointed at the remote database:
   ```bash
   DATABASE_URL="<neon-url>" npx prisma migrate deploy
   DATABASE_URL="<neon-url>" npm run db:seed
   ```
3. **Import the repo** at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js;
   `postinstall` runs `prisma generate` for you.
4. **Environment variables** (all environments):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon pooled connection string |
   | `IDENTITY` | `mock` |
   | `NODDIE_KEYS` | the line from `npm run keys:export` |

5. **Deploy.** Then sign in as `joan` and confirm the register loads.

To reset the demo afterwards, run `python scripts/demo-stage.py` locally with `BASE` pointed
at the deployed URL, or re-run the seed.

## Option B — Railway or Render (one signup)

Both run a Node server with a persistent disk and can provision Postgres beside it, so the
app and database live in one place.

1. New project from the GitHub repo; add a PostgreSQL service.
2. Set `DATABASE_URL` to the internal connection string, `IDENTITY=mock`, and `NODDIE_KEYS`.
3. Build `npm run build`, start `npm run start`.
4. Run `npx prisma migrate deploy` and `npm run db:seed` once against the database.

A persistent disk means `data/keys.json` would survive here, but set `NODDIE_KEYS` anyway —
it is what keeps the keys stable across redeploys and any future second instance.

## Running the real realm

Everything above deploys the simulated identity, which labels itself on every screen. For
`IDENTITY=tidecloak` you also need a reachable TideCloak realm and `tidecloak.json` at the
project root. That file is gitignored, so supply it to the host as a secret rather than
committing it, and set `KC_BASE_URL` and `KC_REALM` to the realm.

## What not to deploy

- `data/` — runtime key material. Gitignored. Use `NODDIE_KEYS`.
- `tidecloak.json` — per-realm adapter config. Gitignored.
- `.env` — local only. Set variables in the host's settings.
