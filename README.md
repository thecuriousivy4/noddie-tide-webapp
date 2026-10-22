[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

**Noddie** — a heritage register where no dig is permitted unless the elders holding that Country agree. **No nod, no dig.**

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

In May 2020 Rio Tinto legally destroyed 46,000-year-old rock shelters at Juukan Gorge, on a consent signed seven years earlier — before the digs that revealed what was there.

Registers fail twice: consent goes stale, and protection demands disclosure. Noddie fixes both — consent becomes a quorum that must hold *now*, and the register holds what it cannot read.

### 2. Trust constraint insight

Protecting a site today means disclosing it — name, boundary, significance — into a database any officer with a login can read. Communities must surrender the secret to protect it. Most decline, so the register is incomplete, so bulldozers find what nobody recorded.

### 3. Value & impact

An elder records a women's-restricted site — knowledge she'd never hand a government database. Not even a fellow custodian can open it. Indigenous Data Sovereignty, in a schema.

Two corporations: one needs 2 of 3 elders, the other all 3. No endpoint here can change either number, and every request stamps its threshold into a hash-chained log.

### 4. Why TideCloak matters

Details are encrypted in an elder's browser under a Forseti policy; our server stores ciphertext it cannot open. Authority lives in a network-signed token, never a database column — so no administrator, minister or operator can switch on a permit.

### 5. Prototype & storytelling

An elder records a site — the server sees only ciphertext. A proponent searches her zones: *something is recorded here, call this number*. The Minister presses **Record consent** — the tally doesn't move. Two elders approve, the permit commits — and it still refuses her until her token is reissued.

Revocation runs the same machine in reverse: no one withdraws a permit alone.

**Demo:** _add link_ · `npm run verify`: 68 checks.

## Setup

```bash
npm install && npm run setup && npm run dev
```

Accounts, walkthrough, architecture: [DEVELOPING.md](DEVELOPING.md).
