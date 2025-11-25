"""Create role change history table

Revision ID: 008_create_role_change_history
Revises: 007_add_phone_and_hire_date
Create Date: 2025-11-25 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '008_create_role_change_history'
down_revision: Union[str, None] = '007_add_phone_and_hire_date'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create role_change_history table for audit trail."""

    op.create_table(
        'role_change_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('old_role', sa.String(length=50), nullable=True),
        sa.Column('new_role', sa.String(length=50), nullable=False),
        sa.Column('changed_by_id', sa.Integer(), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('metadata_json', postgresql.JSON(), nullable=True),

        # Primary key
        sa.PrimaryKeyConstraint('id'),

        # Foreign keys
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_id'], ['users.id'], ondelete='SET NULL'),
    )

    # Create indexes for efficient querying
    op.create_index('ix_role_change_history_id', 'role_change_history', ['id'])
    op.create_index('ix_role_change_history_user_id', 'role_change_history', ['user_id'])
    op.create_index('ix_role_change_history_changed_by_id', 'role_change_history', ['changed_by_id'])
    op.create_index('ix_role_change_history_changed_at', 'role_change_history', ['changed_at'])


def downgrade() -> None:
    """Drop role_change_history table."""

    # Drop indexes first
    op.drop_index('ix_role_change_history_changed_at', table_name='role_change_history')
    op.drop_index('ix_role_change_history_changed_by_id', table_name='role_change_history')
    op.drop_index('ix_role_change_history_user_id', table_name='role_change_history')
    op.drop_index('ix_role_change_history_id', table_name='role_change_history')

    # Drop table
    op.drop_table('role_change_history')
