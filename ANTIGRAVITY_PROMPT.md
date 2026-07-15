# Prompt for Antigravity — finish Pledge Auditor resubmission

Copy everything below the line into Antigravity.

---

## Task

Finish shipping **Pledge Auditor** so GenLayer judges can verify the live app against the **correct** Intelligent Contract (not the SLA Auto-Enforcer).

Local repo (code already fixed for binding safety + deployment evidence UI):

`/Users/peter/Downloads/AI/Genlayer/pledge-auditor`

GitHub: https://github.com/phu1271997/pledge-auditor  
Live URL target: https://pledge-auditor.vercel.app  

### Reviewer problem (already diagnosed)

Production previously baked:

```text
VITE_CONTRACT_ADDRESS=0x4452EBa2A88F8e3708193253A6aDFC11B82366FC
```

That is **SLA Auto-Enforcer** (`create_agreement` / `settle`). The UI calls **Pledge** methods (`register_pledge` / `audit_pledge` / …), so the live workflow failed review.

### New Pledge Auditor contract (authoritative — already deployed)

| Field | Value |
|---|---|
| Address | `0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B` |
| Source | `contracts/pledge_auditor.py` |
| Network | GenLayer Studionet |
| RPC | `https://studio.genlayer.com/api` |
| Methods | `register_pledge`, `audit_pledge`, `reclaim_stake`, `get_pledge`, `list_pledges` (+ `get_contract_info` if this deploy includes it) |

**FORBIDDEN (never set on Vercel / .env):**  
`0x4452EBa2A88F8e3708193253A6aDFC11B82366FC`

## Steps (do in order)

### 1. Confirm local wiring

Working dir: `/Users/peter/Downloads/AI/Genlayer/pledge-auditor`

Ensure these all use `0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B` and RPC `https://studio.genlayer.com/api`:

- `frontend/.env`
- `frontend/.env.example`
- `SUBMISSION.md`
- `docs/VERIFICATION.md`
- `README.md` (if it still has a placeholder address)

Do **not** commit junk: `node_modules/`, `frontend/dist/` (if gitignored).

Optional schema check:

```bash
curl -s -X POST "https://studio.genlayer.com/api" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"gen_getContractSchema","params":["0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B"],"id":1}'
```

Expect Pledge methods (`register_pledge`, `list_pledges`, …).  
Must **not** be only `create_agreement` / `settle`.

### 2. Local build proof

```bash
cd /Users/peter/Downloads/AI/Genlayer/pledge-auditor/frontend
npm install
npm run build
```

Verify the production bundle binds the **new** address:

```bash
# Active binding must include the new address
grep -R "0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B" dist && echo "OK: new address in bundle"

# Must still contain pledge methods
grep -R "register_pledge" dist >/dev/null && echo "OK: pledge methods"

# SLA address may appear only as a FORBIDDEN/reject string in UI copy —
# but the app must NOT use it as VITE_CONTRACT_ADDRESS / active contract.
# Fail if the only/main contract assignment is still the SLA one without the new address.
grep -R "0x4452EBa2A88F8e3708193253A6aDFC11B82366FC" dist && echo "NOTE: SLA string may appear as ban-list; confirm new address also present"
```

Fix any build/type errors before continuing.

### 3. Commit + push public GitHub

```bash
cd /Users/peter/Downloads/AI/Genlayer/pledge-auditor
git status
git add -A
# keep node_modules / dist ignored via .gitignore

git commit -m "$(cat <<'EOF'
fix: rebind live app to Pledge Auditor 0xEe6E04C9…

Stop pointing production at SLA Auto-Enforcer 0x4452EBa2….
Wire 0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B, evidence panel, health check.
EOF
)"

git push origin main
```

Repo must stay **public**: https://github.com/phu1271997/pledge-auditor  
Do not force-push unless absolutely required and confirmed.

### 4. Vercel — reconfigure env + redeploy production

Project serving **https://pledge-auditor.vercel.app** (or create/link it to this repo).

| Setting | Value |
|---|---|
| Repository | `phu1271997/pledge-auditor` |
| Root Directory | **`frontend`** |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Deployment Protection | **OFF** (anonymous access) |

Environment variables — set on **Production and Preview**, **replace** old values:

```text
VITE_CONTRACT_ADDRESS=0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B
VITE_GENLAYER_RPC=https://studio.genlayer.com/api
```

Critical:

- Delete any env value equal to `0x4452EBa2A88F8e3708193253A6aDFC11B82366FC`
- Trigger a **new production deploy** after env change (Vite bakes `import.meta.env` at **build** time — changing env without rebuild is not enough)

CLI example if you use Vercel CLI from `frontend/`:

```bash
cd /Users/peter/Downloads/AI/Genlayer/pledge-auditor/frontend
vercel env add VITE_CONTRACT_ADDRESS production   # paste 0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B
vercel env add VITE_GENLAYER_RPC production       # paste https://studio.genlayer.com/api
# also set Preview if used
vercel --prod
```

### 5. Hard verification (must pass)

```bash
LIVE=https://pledge-auditor.vercel.app
curl -sI "$LIVE" | head -12
# Expect HTTP 200 (or public redirect). MUST NOT 302 to vercel.com/sso-api
```

Incognito / logged out of Vercel:

1. Page loads without login.  
2. **Deployment evidence** shows contract `0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B`.  
3. Health line is green: `list_pledges() OK` (not SLA method errors).  
4. Optional smoke: register a small-stake pledge → appears in list → (optional) audit.  

Bundle check on live assets:

```bash
# After deploy, fetch the main JS asset from the HTML and confirm it embeds 0xEe6E04C9…
curl -s "$LIVE" | grep -oE '/assets/[^"]+\.js'
# then curl that asset and grep for Ee6E04C9 and register_pledge
```

### 6. Update docs if live URL differs

If production URL is not `https://pledge-auditor.vercel.app`, replace it in `README.md`, `SUBMISSION.md`, `docs/VERIFICATION.md`, commit + push.

### 7. Return to the human

Paste back:

1. GitHub commit URL / SHA  
2. Final public live URL  
3. Proof: `curl -sI` first lines (no SSO)  
4. Confirmation live UI shows `0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B` and green `list_pledges()`  
5. Confirmation Vercel env no longer uses `0x4452EBa2…`  
6. Any blockers  

## Out of scope

- Do not redeploy SLA Auto-Enforcer or change its address into this app.  
- Do not enable Vercel password/SSO on production.  
- Do not use `http://127.0.0.1:4000/api` on Vercel.  
- Do not make the GitHub repo private.  

## Success criteria

- [ ] Public GitHub has the resubmission code + address docs  
- [ ] Vercel Production env = `0xEe6E04C93b98F2C5689d64C75C4C3c0322186a4B`  
- [ ] Fresh production build (not old cache with SLA address as active contract)  
- [ ] Live app public, evidence panel + `list_pledges()` health OK  
- [ ] Judges can run: register_pledge → audit_pledge → reclaim_stake (if KEPT)  

---

End of Antigravity prompt.
