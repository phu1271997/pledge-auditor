# Verification pack — Pledge Auditor (judge / reviewer)

## Reviewer feedback addressed

> Please redeploy or reconfigure the live app to use the submitted Pledge
> Auditor contract and its actual methods… The current deployment is aimed at
> a different SLA contract, so the submitted pledge workflow cannot be verified live.

### Root cause

Production build at `https://pledge-auditor.vercel.app` had baked-in:

```text
VITE_CONTRACT_ADDRESS=0x4452EBa2A88F8e3708193253A6aDFC11B82366FC
```

That address is the **SLA Auto-Enforcer** contract (`create_agreement`, `settle`,
`list_agreements`, `get_agreement`) from a sibling project — not Pledge Auditor.

The UI already called Pledge methods (`register_pledge`, `audit_pledge`, …), so
the live workflow could not execute against the wrong contract.

### Fix

1. Frontend binds **only** to a Pledge Auditor address.
2. Hard-rejects the known SLA address `0x4452EBa2…`.
3. Deployment evidence panel + live `list_pledges()` health check.
4. Redeploy contract from `contracts/pledge_auditor.py` and set Vercel env to that address.
5. Redeploy Vercel so the bundle no longer embeds the SLA address.

---

## Deployed contract (fill after Studio deploy)

| Field | Value |
|---|---|
| Product | **Pledge Auditor** |
| Source | `contracts/pledge_auditor.py` |
| Address | `0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B` |
| Network | GenLayer Studionet |
| RPC | `https://studio.genlayer.com/api` |
| Live app | `https://pledge-auditor.vercel.app` (or updated public URL) |
| GitHub | https://github.com/phu1271997/pledge-auditor |

### Expected methods (Pledge Auditor)

| Method | Kind |
|---|---|
| `register_pledge(id, org, description, evidence_url)` | write payable |
| `audit_pledge(id)` | write (AI jury) |
| `reclaim_stake(id)` | write |
| `get_pledge(id)` | view |
| `list_pledges()` | view |
| `get_contract_info()` | view (identity) |

### Must NOT be (SLA Auto-Enforcer)

| Method | |
|---|---|
| `create_agreement` | SLA-only |
| `settle` | SLA-only |
| `list_agreements` / `get_agreement` | SLA-only |
| Address `0x4452EBa2A88F8e3708193253A6aDFC11B82366FC` | forbidden in this app |

---

## Studio redeploy procedure

1. https://studio.genlayer.com/run-debug  
2. Deploy `contracts/storage_test.py` → SUCCESS (optional sanity).  
3. Deploy **`contracts/pledge_auditor.py`** → Result **SUCCESS**.  
4. Copy address → set:

```bash
VITE_CONTRACT_ADDRESS=0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B
VITE_GENLAYER_RPC=https://studio.genlayer.com/api
```

5. Vercel → Project **pledge-auditor** → Settings → Environment Variables  
   - Update `VITE_CONTRACT_ADDRESS` (Production + Preview)  
   - **Remove** any value equal to `0x4452EBa2…`  
6. Redeploy production (Build must re-inject env — Vite bakes `import.meta.env` at build time).  
7. Open live app → Deployment evidence shows new address → health line green.

### Smoke path

1. `register_pledge` with stake + public evidence URL  
2. `list_pledges` shows the new id  
3. `audit_pledge` → verdict KEPT / BREACHED / UNCLEAR  
4. If KEPT: `reclaim_stake` as creator  

---

## Reply template for reviewers

```text
Thanks — live app was misconfigured to the SLA Auto-Enforcer address
0x4452EBa2A88F8e3708193253A6aDFC11B82366FC. That is fixed.

1) Live app (public): https://pledge-auditor.vercel.app
2) GitHub: https://github.com/phu1271997/pledge-auditor
3) Pledge Auditor contract: 0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B
   (redeployed from contracts/pledge_auditor.py)
   Methods: register_pledge, audit_pledge, reclaim_stake, get_pledge, list_pledges, get_contract_info
4) UI Deployment evidence panel shows the address + live list_pledges() health check.
5) App hard-rejects the SLA address if set by mistake.

Pledge workflow can be verified live: register → audit → reclaim (if KEPT).
```
