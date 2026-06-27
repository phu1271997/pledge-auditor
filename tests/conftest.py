"""
Pytest fixtures that mock the non-deterministic AI jury so tests are
deterministic. These patch GenVM's nondet entrypoints to return a fixed
verdict, letting us exercise the deterministic effect logic (slash, reclaim,
state transitions) without live web/LLM calls.

Adjust the import path of the mock helper to match your installed gltest
version if the runtime exposes nondet mocking differently.
"""

import json
import pytest


def _verdict_payload(verdict: str, reason: str) -> str:
    return json.dumps({"verdict": verdict, "reason": reason})


@pytest.fixture
def monkeypatch_jury_kept(gltest_runtime):
    """Force every audit to return KEPT."""
    gltest_runtime.mock_nondet(
        web_render=lambda url, mode="text": "Independently verified: target met.",
        exec_prompt=lambda prompt, **kw: _verdict_payload(
            "KEPT", "Third-party report confirms the pledge is being honoured."
        ),
    )
    yield
    gltest_runtime.reset_nondet()


@pytest.fixture
def monkeypatch_jury_breached(gltest_runtime):
    """Force every audit to return BREACHED."""
    gltest_runtime.mock_nondet(
        web_render=lambda url, mode="text": "Investigation found violations in supply chain.",
        exec_prompt=lambda prompt, **kw: _verdict_payload(
            "BREACHED", "Documented violations contradict the public pledge."
        ),
    )
    yield
    gltest_runtime.reset_nondet()


@pytest.fixture
def monkeypatch_jury_unclear(gltest_runtime):
    gltest_runtime.mock_nondet(
        web_render=lambda url, mode="text": "Generic homepage with no relevant data.",
        exec_prompt=lambda prompt, **kw: _verdict_payload(
            "UNCLEAR", "Evidence does not speak to the specific pledge."
        ),
    )
    yield
    gltest_runtime.reset_nondet()
