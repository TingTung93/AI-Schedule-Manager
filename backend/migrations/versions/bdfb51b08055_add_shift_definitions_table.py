"""add_shift_definitions_table

Revision ID: bdfb51b08055
Revises: bb9b289e82c2
Create Date: 2025-11-19 16:46:49.889243

"""
from typing import Sequence, Union
from datetime import time

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bdfb51b08055'
down_revision: Union[str, Sequence[str], None] = 'bb9b289e82c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create shift_definitions table
    op.create_table(
        'shift_definitions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('abbreviation', sa.String(length=10), nullable=False),
        sa.Column('shift_type', sa.String(length=20), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=False),
        sa.Column('required_staff', sa.Integer(), nullable=False),
        sa.Column('department_id', sa.Integer(), nullable=True),
        sa.Column('hourly_rate_multiplier', sa.Float(), nullable=False),
        sa.Column('required_qualifications', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
    )
    op.create_index(op.f('ix_shift_definitions_abbreviation'), 'shift_definitions', ['abbreviation'], unique=True)
    op.create_index(op.f('ix_shift_definitions_id'), 'shift_definitions', ['id'], unique=False)
    op.create_index(op.f('ix_shift_definitions_name'), 'shift_definitions', ['name'], unique=True)

    # Insert default shift definitions
    op.execute("""
        INSERT INTO shift_definitions (
            name, abbreviation, shift_type, start_time, end_time,
            color, required_staff, hourly_rate_multiplier, is_active, description
        ) VALUES
        ('Morning', 'AM', 'morning', '06:00:00', '14:00:00', '#FF9800', 1, 1.0, true, 'Morning shift from 6:00 AM to 2:00 PM'),
        ('Afternoon', 'PM', 'afternoon', '14:00:00', '22:00:00', '#2196F3', 1, 1.0, true, 'Afternoon shift from 2:00 PM to 10:00 PM'),
        ('Night', 'NIGHT', 'night', '22:00:00', '06:00:00', '#3F51B5', 1, 1.5, true, 'Night shift from 10:00 PM to 6:00 AM with 1.5x pay'),
        ('Day', 'DAY', 'custom', '08:00:00', '17:00:00', '#4CAF50', 1, 1.0, true, 'Standard day shift from 8:00 AM to 5:00 PM'),
        ('Evening', 'EVE', 'evening', '17:00:00', '01:00:00', '#9C27B0', 1, 1.25, true, 'Evening shift from 5:00 PM to 1:00 AM with 1.25x pay')
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_shift_definitions_name'), table_name='shift_definitions')
    op.drop_index(op.f('ix_shift_definitions_id'), table_name='shift_definitions')
    op.drop_index(op.f('ix_shift_definitions_abbreviation'), table_name='shift_definitions')
    op.drop_table('shift_definitions')
