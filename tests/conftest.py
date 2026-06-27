"""
Pytest fixtures that mock the non-deterministic AI jury using gltest's Direct Mode (direct_vm).
These patch GenVM's nondet entrypoints to return a fixed verdict, letting us exercise
the deterministic effect logic (slash, reclaim, state transitions) without live web/LLM calls.
"""

import json
import pytest
from gltest.types import MockedWebResponseData

def _verdict_payload(verdict: str, reason: str) -> str:
    return json.dumps({"verdict": verdict, "reason": reason})


@pytest.fixture
def monkeypatch_jury_kept(direct_vm):
    """Force every audit to return KEPT."""
    web_response: MockedWebResponseData = {
        "method": "GET",
        "status": 200,
        "body": "Independently verified: target met."
    }
    direct_vm.mock_web(".*", web_response)
    direct_vm.mock_llm(".*", _verdict_payload("KEPT", "Third-party report confirms the pledge is being honoured."))
    yield
    direct_vm.clear_mocks()


@pytest.fixture
def monkeypatch_jury_breached(direct_vm):
    """Force every audit to return BREACHED."""
    web_response: MockedWebResponseData = {
        "method": "GET",
        "status": 200,
        "body": "Investigation found violations in supply chain."
    }
    direct_vm.mock_web(".*", web_response)
    direct_vm.mock_llm(".*", _verdict_payload("BREACHED", "Documented violations contradict the public pledge."))
    yield
    direct_vm.clear_mocks()


@pytest.fixture
def monkeypatch_jury_unclear(direct_vm):
    """Force every audit to return UNCLEAR."""
    web_response: MockedWebResponseData = {
        "method": "GET",
        "status": 200,
        "body": "Generic homepage with no relevant data."
    }
    direct_vm.mock_web(".*", web_response)
    direct_vm.mock_llm(".*", _verdict_payload("UNCLEAR", "Evidence does not speak to the specific pledge."))
    yield
    direct_vm.clear_mocks()
