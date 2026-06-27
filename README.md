# 🛡️ Pledge Auditor

**A trustless reputation layer for public promises — built on GenLayer.**

Organizations make qualitative public commitments all the time: *"carbon
neutral by 2030"*, *"refunds within 30 days"*, *"no child labour in our supply
chain"*, *"99.9% uptime"*. Today, nothing on-chain can verify whether those
promises are actually kept — because keeping them is a **subjective judgement
about unstructured, real-world evidence**.

Pledge Auditor turns each promise into a stake-backed, auditable on-chain
object. An organization stakes funds behind a pledge. **Anyone** can trigger an
audit. The Intelligent Contract reads the live public evidence URL directly
on-chain (`gl.nondet.web.render`) and a decentralized **AI jury**
(`gl.nondet.exec_prompt`) decides whether the promise is being kept. A breach
slashes the stake into a **whistleblower bounty pool**, paid to whoever
surfaced the violation.

> **Why this dies without GenLayer:** reading unstructured web evidence and
> rendering a subjective *"are they keeping their word?"* verdict is impossible
> on a traditional smart-contract chain. There is no oracle for "is this
> company honouring its pledge" — the judgement *is* the product, and only
> GenLayer can put that judgement on-chain trustlessly.

---

## How it works

```
Organization ──register_pledge(stake)──▶  Pledge stored on-chain
                                              │
Anyone ─────────audit_pledge()───────────────┤
                                              ▼
                          gl.nondet.web.render(evidence_url)   ← reads live web
                                              ▼
                          gl.nondet.exec_prompt(promise+evidence) ← AI jury
                                              ▼
                          validators reach consensus on the VERDICT
                                              ▼
              KEPT  → stake stays, creator may reclaim
              BREACHED → stake slashed → bounty paid to whistleblower
              UNCLEAR → no change (evidence insufficient)
```

The verdict consensus checks the **meaning** of the decision (KEPT / BREACHED /
UNCLEAR), not merely the JSON shape — two validators that "look valid" but
disagree on the actual verdict will not pass.

---

## Repository layout

```
contracts/
  pledge_auditor.py     # the Intelligent Contract (the heart of the project)
  storage_test.py       # minimal sanity contract — deploy first to verify env
frontend/
  src/genlayer.ts       # genlayer-js client — real reads/writes to the contract
  src/App.tsx           # full user journey UI
tests/
  test_pledge_auditor.py# happy path + breach + edge cases
  conftest.py           # fixtures mocking the AI jury for deterministic tests
scripts/
  deploy.ts             # deploy via genlayer-js / CLI
  seed.ts               # seed sample pledges for a non-empty demo
docs/
  ARCHITECTURE.md       # flow + consensus design
  SECURITY.md           # threat model
```

---

## Deploying on GenLayer Studio (fastest path)

1. Open <https://studio.genlayer.com/run-debug>.
2. **Settings → Reset Storage → Confirm**, then hard refresh (Cmd/Ctrl+Shift+R).
3. Deploy `contracts/storage_test.py` first and call `bump` / `get` to confirm
   the environment is healthy.
4. Deploy `contracts/pledge_auditor.py`.
5. Click the deploy transaction in the sidebar and confirm **Result: SUCCESS**
   (not just *Status: FINALIZED*).
6. Copy the contract address.

> The contract's first two lines (`# v0.2.16` and the `# { "Depends": … }`
> comment) are required — without them Studio falls back to an old runtime and
> throws `Contract Queues not found`.

### Deploying via CLI / CI

```bash
export DEPLOYER_PRIVATE_KEY=0x...      # a funded testnet key
npx tsx scripts/deploy.ts             # prints the deployed address
```

---

## Running the frontend

```bash
cd frontend
cp .env.example .env                  # then set VITE_CONTRACT_ADDRESS
npm install
npm run dev
```

The frontend uses **genlayer-js** to sign transactions, trigger audits, and
read verdicts back from the deployed contract. Deploy it live on Vercel/Netlify
and point `VITE_CONTRACT_ADDRESS` at your contract.

### Seeding demo data

```bash
DEPLOYER_PRIVATE_KEY=0x... VITE_CONTRACT_ADDRESS=0x... npx tsx scripts/seed.ts
```

---

## Testing

```bash
pip install genlayer-test
gltest tests/
```

Tests mock the non-deterministic jury so the deterministic effects (slashing,
reclaim gating, state transitions, input validation) are verified
deterministically. Covered: register/list, audit→KEPT→reclaim, audit→BREACHED→
slash-to-whistleblower, duplicate id, empty description, non-http URL, unknown
pledge, reclaim-requires-KEPT, non-creator-cannot-reclaim.

---

## Contract API

| Method | Type | Description |
|---|---|---|
| `register_pledge(id, org, description, evidence_url)` | write payable | Register a pledge, backing it with the attached stake. |
| `audit_pledge(id)` | write | Trigger the AI jury; applies KEPT/BREACHED/UNCLEAR effects. |
| `reclaim_stake(id)` | write | Creator reclaims stake only if the verdict stands as KEPT. |
| `get_pledge(id)` | view | Full pledge detail as JSON. |
| `list_pledges()` | view | Summary list of all pledges as JSON. |

---

## Status & disclaimers

Built for the GenLayer testnet (Bradbury). GenLayer is in active development;
runtime version pins, points, and policies may change — verify against official
sources before relying on anything here. This is a demonstration project, not
audited for production use.

## License

MIT
