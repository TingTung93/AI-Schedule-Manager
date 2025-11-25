"""add_hourly_rate_and_max_hours_per_week

Revision ID: 010
Revises: 009_add_password_management
Create Date: 2025-11-24 20:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010'
down_revision: Union[str, Sequence[str], None] = '009_add_password_management'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add hourly_rate and max_hours_per_week columns to users table."""
    # Add hourly_rate column (NUMERIC(10, 2) for currency precision)
    op.add_column('users', sa.Column('hourly_rate', sa.Numeric(precision=10, scale=2), nullable=True))

    # Add max_hours_per_week column (INTEGER for whole hours)
    op.add_column('users', sa.Column('max_hours_per_week', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove hourly_rate and max_hours_per_week columns from users table."""
    op.drop_column('users', 'max_hours_per_week')
    op.drop_column('users', 'hourly_rate')
