"""Tests for the SDK settings compatibility shim.

Exercise the fallback path only (SDK 1.17.0) — the real-symbol path is
covered by the rest of the suite that imports from
``openhands.utils.sdk_settings_compat`` and uses the imported names.
"""

import pytest

from openhands.utils.sdk_settings_compat import (
    _HAS_DISCRIMINATED_UNION,
    validate_agent_settings,
)


@pytest.mark.skipif(
    _HAS_DISCRIMINATED_UNION,
    reason='Loud-fallback behaviour only applies when the SDK lacks ACP.',
)
def test_validate_agent_settings_refuses_acp_kind_on_old_sdk():
    """SDK 1.17.0 cannot honour ``kind='acp'`` — refuse loudly instead
    of silently coercing the payload to an LLM agent (which is what the
    reviewer flagged as a landmine in #14004).
    """
    with pytest.raises(RuntimeError, match='does not support ACP agents'):
        validate_agent_settings({'kind': 'acp', 'acp_server': 'claude-code'})


@pytest.mark.skipif(
    _HAS_DISCRIMINATED_UNION,
    reason='Fallback-only: on newer SDKs ``kind=llm`` is recognised by the union.',
)
def test_validate_agent_settings_accepts_llm_kind_on_old_sdk():
    """LLM settings still validate under the fallback — the sentinel is
    only about ACP kinds, not any-kind rejection.
    """
    # An empty dict should at minimum not raise the ACP RuntimeError;
    # real Pydantic validation of the flat AgentSettings shape still
    # applies.
    try:
        validate_agent_settings({})
    except RuntimeError as exc:  # pragma: no cover — guard only
        assert 'does not support ACP' not in str(exc)
