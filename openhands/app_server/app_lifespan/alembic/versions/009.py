"""Add agent_kind column to conversation_metadata table

Revision ID: 009
Revises: 008
Create Date: 2026-04-17 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '009'
down_revision: Union[str, None] = '008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add agent_kind column discriminating between LLM and ACP agents.

    Populated at conversation-start time from ``AgentSettings.agent_kind``.
    Downstream consumers (conversation-URL builder, live-status poller)
    branch on this to hit the right agent-server route —
    ``/api/conversations`` for ``"llm"``, ``/api/acp/conversations`` for
    ``"acp"``. The column is nullable for backwards compatibility with
    existing rows; readers coerce NULL → ``"llm"``.
    """
    op.add_column(
        'conversation_metadata',
        sa.Column('agent_kind', sa.String, nullable=True),
    )


def downgrade() -> None:
    """Drop the agent_kind column."""
    op.drop_column('conversation_metadata', 'agent_kind')
