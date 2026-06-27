"""
Test suite for the Pledge Auditor Intelligent Contract using gltest's Direct Mode.
Runs in-memory and mocks the non-deterministic web.render / exec_prompt calls.

Run with:
    gltest tests/
"""

import json
import pytest

CONTRACT = "pledge_auditor.py"

VERDICT_PENDING = 0
VERDICT_KEPT = 1
VERDICT_BREACHED = 2
VERDICT_UNCLEAR = 3


@pytest.fixture
def contract(direct_deploy):
    # Deploy using direct mode helper
    return direct_deploy(CONTRACT)


# ── happy path ────────────────────────────────────────────────────────────────
def test_register_and_list(direct_vm, contract):
    direct_vm.value = 1000
    contract.register_pledge(
        "p1", "Acme Corp", "Refunds within 30 days", "https://acme.example/policy"
    )

    listed = json.loads(contract.list_pledges())
    assert len(listed) == 1
    assert listed[0]["id"] == "p1"
    assert listed[0]["org_name"] == "Acme Corp"
    assert listed[0]["verdict"] == VERDICT_PENDING


def test_audit_kept_then_reclaim(direct_vm, contract, monkeypatch_jury_kept):
    """With the jury mocked to KEPT, creator can reclaim the stake."""
    direct_vm.value = 5000
    contract.register_pledge(
        "p2", "Acme", "Carbon neutral by 2030", "https://acme.example/esg"
    )
    
    contract.audit_pledge("p2")

    p = json.loads(contract.get_pledge("p2"))
    assert p["verdict"] == VERDICT_KEPT
    assert int(p["audit_count"]) == 1

    # Reclaim stake (should succeed)
    contract.reclaim_stake("p2")
    p2 = json.loads(contract.get_pledge("p2"))
    assert int(p2["stake"]) == 0
    assert p2["resolved"] is True


# ── breach / slash path ───────────────────────────────────────────────────────
def test_audit_breached_slashes_to_whistleblower(direct_vm, contract, monkeypatch_jury_breached, direct_alice):
    direct_vm.value = 8000
    contract.register_pledge(
        "p3", "BadCo", "No child labour in supply chain", "https://badco.example/report"
    )
    
    # Prank/set the sender to whistleblower (Alice)
    direct_vm.sender = direct_alice
    contract.audit_pledge("p3")

    p = json.loads(contract.get_pledge("p3"))
    assert p["verdict"] == VERDICT_BREACHED
    assert int(p["stake"]) == 0
    assert int(p["bounty_pool"]) == 8000
    assert p["resolved"] is True


# ── edge cases ────────────────────────────────────────────────────────────────
def test_duplicate_id_rejected(direct_vm, contract):
    direct_vm.value = 10
    contract.register_pledge("dup", "Org", "A promise", "https://x.example")
    
    with pytest.raises(Exception, match="pledge_id already exists"):
        contract.register_pledge("dup", "Org", "A promise", "https://x.example")


def test_empty_description_rejected(direct_vm, contract):
    direct_vm.value = 10
    with pytest.raises(Exception, match="description must not be empty"):
        contract.register_pledge("e1", "Org", "", "https://x.example")


def test_non_http_url_rejected(direct_vm, contract):
    direct_vm.value = 10
    with pytest.raises(Exception, match="evidence_url must be an http"):
        contract.register_pledge("e2", "Org", "A promise", "ftp://x.example")


def test_audit_unknown_pledge_rejected(direct_vm, contract):
    with pytest.raises(Exception, match="unknown pledge_id"):
        contract.audit_pledge("nope")


def test_reclaim_requires_kept(direct_vm, contract, monkeypatch_jury_breached):
    direct_vm.value = 100
    contract.register_pledge("p4", "BadCo", "Promise", "https://badco.example")
    contract.audit_pledge("p4")  # -> BREACHED, resolved
    
    with pytest.raises(Exception, match="stake reclaimable only when verdict is KEPT"):
        contract.reclaim_stake("p4")


def test_non_creator_cannot_reclaim(direct_vm, contract, monkeypatch_jury_kept, direct_bob):
    direct_vm.value = 100
    contract.register_pledge("p5", "Org", "Promise", "https://x.example")
    contract.audit_pledge("p5")
    
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="only creator may reclaim"):
        contract.reclaim_stake("p5")
