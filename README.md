[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

**Noddie** — a heritage register where no dig is permitted unless the elders holding that Country agree. **No nod, no dig.**

**[Live demo](https://noddie.onrender.com/)** · `joan` / `noddie-joan`

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

In May 2020 Rio Tinto legally destroyed 46,000-year-old rock shelters at Juukan Gorge, on a seven-year-old consent, predating the excavations that revealed what was there.

Registers fail twice: consent goes stale, and protection demands disclosure. Noddie fixes both — consent is a quorum that must hold *now*, and the register stores what it cannot read.

### 2. Trust constraint insight

To protect the secret you must surrender it: name, boundary and significance go into a database any officer with a login can read, and a minister has the final say. Many decline, so bulldozers find what nobody recorded.

### 3. Value & impact

An elder records a women's-restricted site she'd never hand a government database; not even a fellow custodian can open it. Proponents learn a site exists before plans are drawn, not mid-dig, and governments get a fuller register, holding no secrets.

### 4. Why TideCloak matters

Site details are encrypted in the elder's browser under a TideCloak policy; our server stores only ciphertext. Permit authority lives in a token signed by Tide's decentralised network, not a database column, so no administrator or minister can issue one alone. Each corporation sets its own quorum: 2-of-3 here, 3-of-3 there. With an ordinary login, our admin could.

### 5. Prototype & storytelling

**Key moment:** the Minister presses **Record consent**; the tally doesn't move.

1. An elder records a site; the server sees only ciphertext.
2. A proponent searches and sees only: *something is recorded here, call this number*.
3. Two elders approve; the permit commits, but the proponent stays blocked until her token is reissued.
4. Revocation runs in reverse: no one withdraws a permit alone.

[Video](demo.mp4) · `npm run verify`: 68 checks.

## Setup

```bash
npm install && npm run setup && npm run dev
```

[DEVELOPING.md](DEVELOPING.md) · [DEPLOY.md](DEPLOY.md)
