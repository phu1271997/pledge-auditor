# Security notes & threat model

## Trust assumptions
- The verdict is only as good as the evidence URL. A pledge pointing at a page
  the organization fully controls is weaker evidence than an independent source.
  The UI surfaces the evidence URL so observers can judge its credibility.

## Threats considered

| Threat | Mitigation |
|---|---|
| **Prompt injection** via the evidence page | Evidence is delimited and the jury is instructed to weigh actions over claims; a hardening milestone can add canary tokens. |
| **Griefing via repeated audits** | A BREACHED verdict resolves the pledge, ending further audits; KEPT/UNCLEAR audits are idempotent in effect. |
| **Reentrancy on payout** | State (`stake`, `resolved`, `bounty_pool`) is updated *before* `send_value`. |
| **Unauthorized reclaim** | `reclaim_stake` checks `sender == creator` and `verdict == KEPT`. |
| **Dead URL / malformed LLM output** | Both fall through to `UNCLEAR` with no fund movement. |

## Known limitations / future work
- Pull-withdrawal pattern for the whistleblower payout (currently push).
- Multi-source cross-referencing to reduce single-page manipulation.
- Stake-weighted appeal flow for contested verdicts.

These are intentionally left as future milestones rather than scope creep.
