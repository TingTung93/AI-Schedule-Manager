"""Add shift_definitions table for reusable shift templates

Revision ID: shift_definitions_001
Revises:
Create Date: 2025-01-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'shift_definitions_001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create shift_definitions table"""
    op.create_table(
        'shift_definitions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('abbreviation', sa.String(length=10), nullable=False),
        sa.Column('shift_type', sa.String(length=50), nullable=False, server_default='custom'),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=False, server_default='#1976d2'),
        sa.Column('required_staff', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('department_id', sa.Integer(), nullable=True),
        sa.Column('hourly_rate_multiplier', sa.Numeric(precision=4, scale=2), nullable=False, server_default='1.0'),
        sa.Column('required_qualifications', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('created_by_id', sa.Integer(), nullable=True),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),

        sa.CheckConstraint('start_time < end_time', name='valid_shift_definition_times'),
        sa.CheckConstraint('required_staff >= 1', name='positive_required_staff_def'),
        sa.CheckConstraint('hourly_rate_multiplier > 0', name='positive_rate_multiplier'),
        sa.CheckConstraint('length(abbreviation) >= 1 AND length(abbreviation) <= 10', name='valid_abbreviation_length'),
        sa.CheckConstraint(
            "shift_type IN ('morning', 'afternoon', 'evening', 'night', 'split', 'on-call', 'custom')",
            name='valid_shift_definition_type'
        ),

        sa.UniqueConstraint('name', name='uq_shift_definition_name'),
        sa.UniqueConstraint('abbreviation', name='uq_shift_definition_abbreviation'),
    )

    # Create indexes
    op.create_index('ix_shift_definitions_id', 'shift_definitions', ['id'])
    op.create_index('ix_shift_definitions_name', 'shift_definitions', ['name'])
    op.create_index('ix_shift_definitions_type', 'shift_definitions', ['shift_type'])
    op.create_index('ix_shift_definitions_active', 'shift_definitions', ['is_active'])
    op.create_index('ix_shift_definitions_dept_active', 'shift_definitions', ['department_id', 'is_active'])
    op.create_index('ix_shift_definitions_time_range', 'shift_definitions', ['start_time', 'end_time'])
    op.create_index('ix_shift_definitions_department_id', 'shift_definitions', ['department_id'])

    # Insert default shift definitions
    op.execute("""
        INSERT INTO shift_definitions (name, abbreviation, shift_type, start_time, end_time, color, required_staff, is_active, description, created_at, updated_at)
        VALUES
            ('Morning Shift', 'AM', 'morning', '06:00:00', '14:00:00', '#FFA726', 2, true, 'Standard morning shift (6 AM - 2 PM)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('Afternoon Shift', 'PM', 'afternoon', '14:00:00', '22:00:00', '#42A5F5', 2, true, 'Standard afternoon shift (2 PM - 10 PM)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('Night Shift', 'NIGHT', 'night', '22:00:00', '06:00:00', '#5C6BC0', 1, true, 'Overnight shift (10 PM - 6 AM)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('Day Shift', 'DAY', 'morning', '08:00:00', '17:00:00', '#66BB6A', 3, true, 'Standard day shift (8 AM - 5 PM)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('Evening Shift', 'EVE', 'evening', '17:00:00', '01:00:00', '#AB47BC', 2, true, 'Evening shift (5 PM - 1 AM)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO NOTHING;
    """)


def downgrade() -> None:
    """Drop shift_definitions table"""
    op.drop_index('ix_shift_definitions_department_id', table_name='shift_definitions')
    op.drop_index('ix_shift_definitions_time_range', table_name='shift_definitions')
    op.drop_index('ix_shift_definitions_dept_active', table_name='shift_definitions')
    op.drop_index('ix_shift_definitions_active', table_name='shift_definitions')
    op.drop_index('ix_shift_definitions_type', table_name='shift_definitions')
    op.drop_index('ix_shift_definitions_name', table_name='shift_definitions')
    op.drop_index('ix_shift_definitions_id', table_name='shift_definitions')

    op.drop_table('shift_definitions')
