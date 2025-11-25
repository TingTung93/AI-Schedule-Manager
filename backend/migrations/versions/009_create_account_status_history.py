"""create_account_status_history_table

Revision ID: 009
Revises: 008
Create Date: 2024-11-25 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '009'
down_revision: Union[str, None] = '008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create account_status_history table for tracking account status changes."""
    op.create_table(
        'account_status_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('old_status', sa.String(length=50), nullable=True),
        sa.Column('new_status', sa.String(length=50), nullable=False),
        sa.Column('changed_by_id', sa.Integer(), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('metadata_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_id'], ['users.id'], ondelete='SET NULL')
    )

    # Create indexes for better query performance
    op.create_index('ix_account_status_history_id', 'account_status_history', ['id'])
    op.create_index('ix_account_status_history_user_id', 'account_status_history', ['user_id'])
    op.create_index('ix_account_status_history_changed_by_id', 'account_status_history', ['changed_by_id'])
    op.create_index('ix_account_status_history_changed_at', 'account_status_history', ['changed_at'])


def downgrade() -> None:
    """Drop account_status_history table and indexes."""
    op.drop_index('ix_account_status_history_changed_at', table_name='account_status_history')
    op.drop_index('ix_account_status_history_changed_by_id', table_name='account_status_history')
    op.drop_index('ix_account_status_history_user_id', table_name='account_status_history')
    op.drop_index('ix_account_status_history_id', table_name='account_status_history')
    op.drop_table('account_status_history')
