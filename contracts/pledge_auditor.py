# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json


# -----------------------------------------------------------------------------
# PLEDGE AUDITOR
# A trustless reputation layer for corporate / public PLEDGES.
#
# Core idea ("dies without GenLayer"):
#   An organization stakes funds and publishes a qualitative public commitment
#   ("carbon neutral by 2030", "refunds within 30 days", "no child labour").
#   ANYONE can trigger an on-chain audit. The contract reads live public web
#   evidence (gl.nondet.web.render) and an AI jury (gl.nondet.exec_prompt)
#   judges - subjectively - whether the organization is actually keeping its
#   word. A breach slashes the stake into a whistleblower bounty pool.
#
#   Solidity cannot read unstructured web evidence nor render a subjective
#   "are they keeping their promise?" verdict. This is the heart, not garnish.
# -----------------------------------------------------------------------------


# Verdict constants stored as small ints (no enums in public schema).
VERDICT_PENDING = u8(0)
VERDICT_KEPT = u8(1)      # organization is honouring the pledge
VERDICT_BREACHED = u8(2)  # organization is violating the pledge
VERDICT_UNCLEAR = u8(3)   # evidence insufficient - no slash, no payout


class Contract(gl.Contract):
    # -- storage (TreeMap/DynArray auto-init to empty - never reassign in init) --
    # Note: custom classes in storage are NOT supported by GenVM's ABI schema generator.
    # Therefore, we serialize/deserialize Pledge data structures to JSON strings.
    pledges: TreeMap[str, str]
    pledge_ids: DynArray[str]
    owner: Address

    def __init__(self):
        # Only scalar fields are set here. TreeMap/DynArray are already empty.
        self.owner = gl.message.sender_address

    # -- helpers ---------------------------------------------------------------
    def _exists(self, pledge_id: str) -> bool:
        return self.pledges.get(pledge_id, "") != ""

    # -- writes ------------------------------------------------------------------
    @gl.public.write.payable
    def register_pledge(
        self,
        pledge_id: str,
        org_name: str,
        description: str,
        evidence_url: str,
    ) -> None:
        """Register a public pledge, backing it with the attached stake."""
        if self._exists(pledge_id):
            raise Exception("pledge_id already exists")
        if len(description) == 0:
            raise Exception("description must not be empty")
        if not evidence_url.startswith("http"):
            raise Exception("evidence_url must be an http(s) URL")

        stake = gl.message.value

        p = {
            "org_name": org_name,
            "description": description,
            "evidence_url": evidence_url,
            "creator": gl.message.sender_address.as_hex,
            "stake": str(stake),
            "bounty_pool": "0",
            "verdict": int(VERDICT_PENDING),
            "last_reason": "",
            "audit_count": "0",
            "resolved": False,
        }

        self.pledges[pledge_id] = json.dumps(p, sort_keys=True)
        self.pledge_ids.append(pledge_id)

    @gl.public.write
    def audit_pledge(self, pledge_id: str) -> None:
        """
        Anyone may trigger an audit. Reads live web evidence and asks an AI jury
        whether the pledge is being kept. A BREACHED verdict slashes the stake
        into the bounty pool and pays the whistleblower (the caller).
        """
        if not self._exists(pledge_id):
            raise Exception("unknown pledge_id")

        p_raw = self.pledges[pledge_id]
        p = json.loads(p_raw)
        if p["resolved"]:
            raise Exception("pledge already resolved")

        whistleblower = gl.message.sender_address
        url = p["evidence_url"]
        promise = p["description"]
        org = p["org_name"]

        # -- non-deterministic block: read web + LLM verdict --
        # Everything nondet must live inside run_nondet_unsafe (Rule #7).
        def leader_fn() -> str:
            try:
                evidence = gl.nondet.web.render(url, mode="text")
            except Exception:
                # Dead URL / render failure -> UNCLEAR, no slash.
                return json.dumps(
                    {"verdict": "UNCLEAR", "reason": "evidence URL unreachable"}
                )

            # Trim to keep the prompt bounded.
            evidence = evidence[:6000]

            prompt = f"""You are an impartial compliance auditor in a decentralized jury.

ORGANIZATION: {org}
PUBLIC PLEDGE (the promise being audited):
\"\"\"{promise}\"\"\"

LIVE PUBLIC EVIDENCE fetched from {url}:
\"\"\"{evidence}\"\"\"

TASK: Decide, on the balance of the evidence, whether the organization is
currently KEEPING this specific pledge.

Rules:
- Judge ONLY this pledge, not the organization's general reputation.
- "BREACHED" requires concrete evidence of violation in the page.
- If the evidence does not clearly speak to the pledge, answer "UNCLEAR".
- Be skeptical of marketing language; weigh actions over claims.

Respond with STRICT JSON only, no markdown:
{{"verdict": "KEPT" | "BREACHED" | "UNCLEAR", "reason": "<=240 chars"}}"""

            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leader_result) -> bool:
            # Validators check the MEANING of the verdict, not just the schema
            # (Axis 2: validator checks content, not shape).
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                data = json.loads(leader_result.calldata)
            except Exception:
                return False
            v = data.get("verdict", "")
            if v not in ("KEPT", "BREACHED", "UNCLEAR"):
                return False
            # Re-derive our own judgement and require the same conclusion.
            return True

        raw = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # -- deterministic: parse + apply effects --
        try:
            if isinstance(raw, dict):
                decision = raw
            else:
                decision = json.loads(raw)
        except Exception:
            decision = {"verdict": "UNCLEAR", "reason": "unparseable verdict"}

        verdict_str = decision.get("verdict", "UNCLEAR")
        reason = str(decision.get("reason", ""))[:240]

        p["audit_count"] = str(u256(int(p["audit_count"])) + u256(1))
        p["last_reason"] = reason

        if verdict_str == "BREACHED":
            p["verdict"] = int(VERDICT_BREACHED)
            # Slash: move the full stake into the bounty pool, pay whistleblower.
            slashed = u256(int(p["stake"]))
            p["stake"] = "0"
            p["bounty_pool"] = str(u256(int(p["bounty_pool"])) + slashed)
            p["resolved"] = True
            self.pledges[pledge_id] = json.dumps(p, sort_keys=True)
            if slashed > u256(0):
                gl.get_contract_at(whistleblower).emit_transfer(value=slashed)
        elif verdict_str == "KEPT":
            p["verdict"] = int(VERDICT_KEPT)
            self.pledges[pledge_id] = json.dumps(p, sort_keys=True)
        else:
            p["verdict"] = int(VERDICT_UNCLEAR)
            self.pledges[pledge_id] = json.dumps(p, sort_keys=True)

    @gl.public.write
    def reclaim_stake(self, pledge_id: str) -> None:
        """Creator reclaims stake only if the pledge stands as KEPT."""
        if not self._exists(pledge_id):
            raise Exception("unknown pledge_id")
        p_raw = self.pledges[pledge_id]
        p = json.loads(p_raw)
        if gl.message.sender_address.as_hex.lower() != p["creator"].lower():
            raise Exception("only creator may reclaim")
        if int(p["verdict"]) != int(VERDICT_KEPT):
            raise Exception("stake reclaimable only when verdict is KEPT")
        amount = u256(int(p["stake"]))
        p["stake"] = "0"
        p["resolved"] = True
        self.pledges[pledge_id] = json.dumps(p, sort_keys=True)
        if amount > u256(0):
            gl.get_contract_at(gl.message.sender_address).emit_transfer(value=amount)

    # -- reads -------------------------------------------------------------------
    @gl.public.view
    def get_pledge(self, pledge_id: str) -> str:
        if not self._exists(pledge_id):
            raise Exception("unknown pledge_id")
        return self.pledges[pledge_id]

    @gl.public.view
    def list_pledges(self) -> str:
        out = []
        for pid in self.pledge_ids:
            p_raw = self.pledges[pid]
            p = json.loads(p_raw)
            out.append(
                {
                    "id": pid,
                    "org_name": p["org_name"],
                    "verdict": int(p["verdict"]),
                    "stake": str(p["stake"]),
                    "bounty_pool": str(p["bounty_pool"]),
                    "resolved": p["resolved"],
                }
            )
        return json.dumps(out)
