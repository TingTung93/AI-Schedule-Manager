"""Add department schedules and templates

Revision ID: 006_add_department_schedules
Revises: c7f8a9b1d2e3
Create Date: 2025-11-21 06:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '006_add_department_schedules'
down_revision: Union[str, None] = 'c7f8a9b1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create department_schedules and department_schedule_templates tables."""

    # Create department_schedules table
    op.create_table(
        'department_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('department_id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.Integer(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('notes', sa.Text(), nullable=True),

        # Primary key
        sa.PrimaryKeyConstraint('id'),

        # Foreign keys
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),

        # Unique constraint
        sa.UniqueConstraint('department_id', 'schedule_id', name='uq_department_schedule')
    )

    # Create indexes for department_schedules
    op.create_index('idx_dept_schedules_dept', 'department_schedules', ['department_id'])
    op.create_index('idx_dept_schedules_schedule', 'department_schedules', ['schedule_id'])
    op.create_index('idx_dept_schedules_created_by', 'department_schedules', ['created_by_user_id'])

    # Create department_schedule_templates table
    op.create_table(
        'department_schedule_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('department_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('template_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('pattern_type', sa.String(50), nullable=True),
        sa.Column('rotation_days', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),

        # Primary key
        sa.PrimaryKeyConstraint('id'),

        # Foreign keys
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),

        # Check constraints
        sa.CheckConstraint(
            "pattern_type IN ('weekly', 'rotating', 'custom') OR pattern_type IS NULL",
            name='valid_pattern_type'
        ),
        sa.CheckConstraint('rotation_days > 0 OR rotation_days IS NULL', name='positive_rotation_days')
    )

    # Create indexes for department_schedule_templates
    op.create_index('idx_dept_templates_dept', 'department_schedule_templates', ['department_id'])
    op.create_index('idx_dept_templates_active', 'department_schedule_templates', ['is_active'])
    op.create_index('idx_dept_templates_created_by', 'department_schedule_templates', ['created_by_user_id'])
    op.create_index('idx_dept_templates_pattern', 'department_schedule_templates', ['pattern_type'])


def downgrade() -> None:
    """Drop department_schedules and department_schedule_templates tables."""

    # Drop department_schedule_templates indexes
    op.drop_index('idx_dept_templates_pattern', table_name='department_schedule_templates')
    op.drop_index('idx_dept_templates_created_by', table_name='department_schedule_templates')
    op.drop_index('idx_dept_templates_active', table_name='department_schedule_templates')
    op.drop_index('idx_dept_templates_dept', table_name='department_schedule_templates')

    # Drop department_schedules indexes
    op.drop_index('idx_dept_schedules_created_by', table_name='department_schedules')
    op.drop_index('idx_dept_schedules_schedule', table_name='department_schedules')
    op.drop_index('idx_dept_schedules_dept', table_name='department_schedules')

    # Drop tables
    op.drop_table('department_schedule_templates')
    op.drop_table('department_schedules')
