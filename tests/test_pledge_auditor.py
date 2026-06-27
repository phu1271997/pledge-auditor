"""
Test suite for the Pledge Auditor Intelligent Contract.

Run with GenLayer's test runner (gltest), which spins up a local GenVM and
mocks the non-deterministic web.render / exec_prompt calls so the AI jury is
deterministic during testing.

    pip install genlayer-test
    gltest tests/

Covers: happy path (register → audit KEPT → reclaim), the breach/slash path,
and the key edge cases the contract guards against.
"""

import json
import pytest
from gltest import get_contract_factory, create_account
from gltest.assertions import tx_execution_succeeded, tx_execution_failed


CONTRACT = "pledge_auditor.py"

VERDICT_PENDING = 0
VERDICT_KEPT = 1
VERDICT_BREACHED = 2
VERDICT_UNCLEAR = 3


def _deploy():
    factory = get_contract_factory(contract_file_path=CONTRACT)
    return factory.deploy(args=[])


# ── happy path ────────────────────────────────────────────────────────────────
def test_register_and_list():
    contract = _deploy()
    res = contract.register_pledge(
        args=["p1", "Acme Corp", "Refunds within 30 days", "https://acme.example/policy"],
        value=1000,
    )
    assert tx_execution_succeeded(res)

    listed = json.loads(contract.list_pledges(args=[]))
    assert len(listed) == 1
    assert listed[0]["id"] == "p1"
    assert listed[0]["org_name"] == "Acme Corp"
    assert listed[0]["verdict"] == VERDICT_PENDING


def test_audit_kept_then_reclaim(monkeypatch_jury_kept):
    """With the jury mocked to KEPT, creator can reclaim the stake."""
    contract = _deploy()
    contract.register_pledge(
        args=["p2", "Acme", "Carbon neutral by 2030", "https://acme.example/esg"],
        value=5000,
    )
    res = contract.audit_pledge(args=["p2"])
    assert tx_execution_succeeded(res)

    p = json.loads(contract.get_pledge(args=["p2"]))
    assert p["verdict"] == VERDICT_KEPT
    assert int(p["audit_count"]) == 1

    res2 = contract.reclaim_stake(args=["p2"])
    assert tx_execution_succeeded(res2)
    p2 = json.loads(contract.get_pledge(args=["p2"]))
    assert int(p2["stake"]) == 0
    assert p2["resolved"] is True


# ── breach / slash path ───────────────────────────────────────────────────────
def test_audit_breached_slashes_to_whistleblower(monkeypatch_jury_breached):
    contract = _deploy()
    contract.register_pledge(
        args=["p3", "BadCo", "No child labour in supply chain", "https://badco.example/report"],
        value=8000,
    )
    whistleblower = create_account()
    res = contract.connect(whistleblower).audit_pledge(args=["p3"])
    assert tx_execution_succeeded(res)

    p = json.loads(contract.get_pledge(args=["p3"]))
    assert p["verdict"] == VERDICT_BREACHED
    assert int(p["stake"]) == 0
    assert int(p["bounty_pool"]) == 8000
    assert p["resolved"] is True


# ── edge cases ────────────────────────────────────────────────────────────────
def test_duplicate_id_rejected():
    contract = _deploy()
    contract.register_pledge(
        args=["dup", "Org", "A promise", "https://x.example"], value=10
    )
    res = contract.register_pledge(
        args=["dup", "Org", "A promise", "https://x.example"], value=10
    )
    assert tx_execution_failed(res)


def test_empty_description_rejected():
    contract = _deploy()
    res = contract.register_pledge(
        args=["e1", "Org", "", "https://x.example"], value=10
    )
    assert tx_execution_failed(res)


def test_non_http_url_rejected():
    contract = _deploy()
    res = contract.register_pledge(
        args=["e2", "Org", "A promise", "ftp://x.example"], value=10
    )
    assert tx_execution_failed(res)


def test_audit_unknown_pledge_rejected():
    contract = _deploy()
    res = contract.audit_pledge(args=["nope"])
    assert tx_execution_failed(res)


def test_reclaim_requires_kept(monkeypatch_jury_breached):
    contract = _deploy()
    contract.register_pledge(
        args=["p4", "BadCo", "Promise", "https://badco.example"], value=100
    )
    contract.audit_pledge(args=["p4"])  # → BREACHED, resolved
    res = contract.reclaim_stake(args=["p4"])
    assert tx_execution_failed(res)


def test_non_creator_cannot_reclaim(monkeypatch_jury_kept):
    contract = _deploy()
    contract.register_pledge(
        args=["p5", "Org", "Promise", "https://x.example"], value=100
    )
    contract.audit_pledge(args=["p5"])
    stranger = create_account()
    res = contract.connect(stranger).reclaim_stake(args=["p5"])
    assert tx_execution_failed(res)
