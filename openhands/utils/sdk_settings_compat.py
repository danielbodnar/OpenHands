"""SDK compatibility shim for the discriminated-union ``AgentSettings`` rework.

The rework (OpenHands/software-agent-sdk#2861) is merged to SDK ``main``
but not yet on PyPI — ``openhands-sdk==1.17.0`` (the pinned release)
still exposes only the flat ``AgentSettings`` class. This module
imports the new symbols when available and falls back to *loud* stubs
otherwise, so that:

- pre-commit / CI on the pinned release keep type-checking cleanly,
- editable-install dev envs see the real discriminated union,
- any runtime attempt to use ACP against SDK 1.17.0 fails fast with a
  clear error instead of silently coercing to LLM.

Delete this module and import directly from ``openhands.sdk.settings``
once the SDK ships a release that includes the new symbols.
"""

from typing import Any

try:
    from openhands.sdk.settings import (  # type: ignore[attr-defined]
        ACPAgentSettings,
        AgentSettingsConfig,
        LLMAgentSettings,
        default_agent_settings,
        export_agent_settings_schema,
        validate_agent_settings,
    )

    _HAS_DISCRIMINATED_UNION = True

except ImportError:
    _HAS_DISCRIMINATED_UNION = False
    from openhands.sdk.settings import AgentSettings

    # ``LLMAgentSettings`` is the new name for ``AgentSettings`` in the
    # rework; aliasing keeps type annotations and ``isinstance`` checks
    # valid without the new symbol.
    LLMAgentSettings = AgentSettings  # type: ignore[misc, assignment]

    class _ACPAgentSettingsStub:
        """Sentinel — SDK 1.17.0 cannot produce ACPAgentSettings instances.

        ``isinstance(x, _ACPAgentSettingsStub)`` is always ``False``,
        which is correct: there is no way to construct an ACP instance
        under SDK 1.17.0, so the branch it guards is dead code.
        """

    ACPAgentSettings = _ACPAgentSettingsStub  # type: ignore[misc, assignment]
    AgentSettingsConfig = AgentSettings  # type: ignore[misc, assignment]

    def default_agent_settings() -> AgentSettings:  # type: ignore[misc]
        return AgentSettings()

    def validate_agent_settings(  # type: ignore[misc]
        data: dict[str, Any],
    ) -> AgentSettings:
        # Refuse to silently coerce ACP settings to LLM. Without this
        # guard a user who persists ``kind='acp'`` under SDK 1.17.0
        # would see the ACP fields dropped and the agent start as LLM
        # — a silent failure mode the reviewer flagged in #14004.
        if isinstance(data, dict) and data.get('kind') == 'acp':
            raise RuntimeError(
                "Stored settings contain kind='acp' but the installed "
                'openhands-sdk does not support ACP agents. Upgrade to an '
                'SDK release that includes the discriminated-union rework '
                '(OpenHands/software-agent-sdk#2861).'
            )
        return AgentSettings.model_validate(data)

    def export_agent_settings_schema():  # type: ignore[misc]
        return AgentSettings.export_schema()


__all__ = [
    'ACPAgentSettings',
    'AgentSettingsConfig',
    'LLMAgentSettings',
    '_HAS_DISCRIMINATED_UNION',
    'default_agent_settings',
    'export_agent_settings_schema',
    'validate_agent_settings',
]
