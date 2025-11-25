"""Add phone and hire_date to users

Revision ID: 007_add_phone_and_hire_date
Revises: 006_add_department_schedules
Create Date: 2025-11-24 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '007_add_phone_and_hire_date'
down_revision: Union[str, None] = '006_add_department_schedules'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add phone and hire_date columns to users table."""

    # Add phone column after email
    op.add_column('users', sa.Column('phone', sa.String(length=20), nullable=True))

    # Add hire_date column
    op.add_column('users', sa.Column('hire_date', sa.Date(), nullable=True))

    # Create index on phone for faster lookups
    op.create_index('ix_users_phone', 'users', ['phone'], unique=False)


def downgrade() -> None:
    """Remove phone and hire_date columns from users table."""

    # Drop index first
    op.drop_index('ix_users_phone', table_name='users')

    # Drop columns
    op.drop_column('users', 'hire_date')
    op.drop_column('users', 'phone')
