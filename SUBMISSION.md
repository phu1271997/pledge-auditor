# SUBMISSION — Pledge Auditor

**Project name:** Pledge Auditor

**Description:** Trustless reputation layer for public qualitative promises. Organizations stake funds behind a pledge; anyone can trigger an on-chain audit. The Intelligent Contract reads live web evidence (`gl.nondet.web.render`) and an AI jury (`gl.nondet.exec_prompt`) decides KEPT / BREACHED / UNCLEAR under validator consensus. Breach slashes stake to the whistleblower; KEPT allows the creator to reclaim.

**GitHub:** https://github.com/phu1271997/pledge-auditor  

**Live app:** https://pledge-auditor.vercel.app  
*(Must be public; must bind to Pledge Auditor contract, not SLA Auto-Enforcer.)*

**Deployed contract:** `0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B` on GenLayer Studionet  
- Source: `contracts/pledge_auditor.py`  
- RPC: `https://studio.genlayer.com/api`  
- Methods: `register_pledge`, `audit_pledge`, `reclaim_stake`, `get_pledge`, `list_pledges`, `get_contract_info`

## Response to reviewer feedback

The previous live deployment baked `VITE_CONTRACT_ADDRESS=0x4452EBa2A88F8e3708193253A6aDFC11B82366FC`, which is the **SLA Auto-Enforcer** contract (`create_agreement` / `settle`), not Pledge Auditor. The UI already used pledge methods, so the submitted workflow could not be verified live.

**Fix:** Redeployed/reconfigured the app to the Pledge Auditor address from `contracts/pledge_auditor.py`, with:

- Hard rejection of the SLA address  
- On-app Deployment evidence panel  
- Live `list_pledges()` health check  
- Explicit method list for judges  

Details: [`docs/VERIFICATION.md`](docs/VERIFICATION.md)

## Local run

```bash
cd frontend
cp .env.example .env   # set VITE_CONTRACT_ADDRESS to Pledge Auditor only
npm install
npm run dev
```
