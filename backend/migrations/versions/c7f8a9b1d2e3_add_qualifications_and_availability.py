"""add_qualifications_and_availability

Revision ID: c7f8a9b1d2e3
Revises: bdfb51b08055
Create Date: 2025-11-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c7f8a9b1d2e3'
down_revision: Union[str, Sequence[str], None] = 'bdfb51b08055'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add qualifications and availability JSONB columns to users table."""
    # Add qualifications column (JSONB array of strings)
    op.add_column('users', sa.Column('qualifications', postgresql.JSON(astext_type=sa.Text()), nullable=True))

    # Add availability column (JSONB object with day keys and schedule values)
    op.add_column('users', sa.Column('availability', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Remove qualifications and availability columns from users table."""
    op.drop_column('users', 'availability')
    op.drop_column('users', 'qualifications')
