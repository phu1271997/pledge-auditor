# Changelog

## [0.1.0] — initial release
- Intelligent Contract `Contract` (Pledge Auditor): register, audit, reclaim.
- AI jury reads live web evidence and renders KEPT / BREACHED / UNCLEAR verdict.
## [0.2.0] — live-app rebind (reviewer fix)

### Fixed
- Production was pointing at **SLA Auto-Enforcer**
  `0x4452EBa2A88F8e3708193253A6aDFC11B82366FC` while calling Pledge methods.
- Frontend now hard-rejects that address and requires a real Pledge Auditor
  deploy of `contracts/pledge_auditor.py`.
- Deployment evidence panel + `list_pledges()` health check for judges.
- `get_pledge` returns `id`; `get_contract_info()` identity view.
- Docs: `docs/VERIFICATION.md`, `SUBMISSION.md`, `ANTIGRAVITY_PROMPT.md`.

## [0.1.0]

- Breach slashes stake into a whistleblower bounty pool.
- genlayer-js frontend covering the full user journey.
- Deploy + seed scripts.
- Test suite: happy path, breach/slash, and edge cases.
- Docs: ARCHITECTURE, SECURITY.
