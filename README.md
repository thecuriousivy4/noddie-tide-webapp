[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

**Noddie** — a heritage register where the permit to dig exists only while the elders who hold that Country still agree. **No nod, no dig.**

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

In May 2020, Rio Tinto destroyed 46,000-year-old rock shelters at Juukan Gorge. It was legal. The paperwork, signed seven years earlier, was in order. The Traditional Owners' objection had nowhere to live.

Noddie inverts that: consent stops being a form filed at approval and becomes a quorum that must hold at the moment of the dig.

### 2. Trust constraint insight

To protect a site today, you must first disclose it — name, boundary, significance — into a government database readable by every officer with a login. Communities must surrender the secret to protect it. Most reasonably decline, so the register is incomplete, so bulldozers find what nobody wrote down.

Break that trade-off, and a register can hold what was never safe to tell it.

### 3. Value & impact

Traditional Owner corporations get a register they needn't trust us to run. Proponents still get a fast, honest answer — *something is recorded here, call this number* — without learning what.

Our scenario has two corporations: one needs 2 of 3 elders, the other all 3. Neither threshold is in our code. It is their rule, in their row.

### 4. Why TideCloak matters

Details are encrypted in an elder's own browser under a Forseti policy; our server stores ciphertext it holds no key to open. Authority lives in a network-signed token, never a database column — so no administrator, no minister, no operator can switch a permit on.

### 5. Prototype & storytelling

Watch the Minister press **Record consent** — and nothing move. Then watch a committed permit get *refused* until the holder's token is reissued.

68 automated checks: `npm run verify`.

## Setup

```bash
npm install && npm run setup && npm run dev
```

Accounts, the seven-step walkthrough and architecture: [DEVELOPING.md](DEVELOPING.md).
