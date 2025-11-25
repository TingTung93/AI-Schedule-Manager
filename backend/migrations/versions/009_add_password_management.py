"""Add password management fields and history tracking

Revision ID: 009_add_password_management
Revises: 009
Create Date: 2024-11-24

This migration adds:
1. password_must_change and password_changed_at fields to users table
2. password_history table for tracking password changes
3. Indices for efficient password history queries
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_add_password_management'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add password management fields and password history table."""

    # Add password management fields to users table
    op.add_column('users', sa.Column('password_must_change', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True))

    # Create password_history table
    op.create_table(
        'password_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('change_method', sa.String(length=50), nullable=True),
        sa.Column('changed_by_user_id', sa.Integer(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id'], ondelete='SET NULL')
    )

    # Create indices for efficient queries
    op.create_index('idx_password_history_user_id', 'password_history', ['user_id'])
    op.create_index('idx_password_history_changed_at', 'password_history', ['changed_at'])
    op.create_index('idx_password_history_user_time', 'password_history', ['user_id', sa.text('changed_at DESC')])


def downgrade() -> None:
    """Remove password management fields and password history table."""

    # Drop indices
    op.drop_index('idx_password_history_user_time', table_name='password_history')
    op.drop_index('idx_password_history_changed_at', table_name='password_history')
    op.drop_index('idx_password_history_user_id', table_name='password_history')

    # Drop password_history table
    op.drop_table('password_history')

    # Remove password management fields from users table
    op.drop_column('users', 'password_changed_at')
    op.drop_column('users', 'password_must_change')
