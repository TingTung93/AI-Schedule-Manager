"""create department assignment history table

Revision ID: department_assignment_history
Revises:
Create Date: 2025-11-20

This migration creates the department_assignment_history table for
comprehensive audit logging of all department assignment changes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = 'department_assignment_history'
down_revision = None  # Update this with your latest migration ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create department_assignment_history table with proper indexes
    and foreign key constraints.
    """
    op.create_table(
        'department_assignment_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('from_department_id', sa.Integer(), nullable=True),
        sa.Column('to_department_id', sa.Integer(), nullable=True),
        sa.Column('changed_by_user_id', sa.Integer(), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('change_reason', sa.Text(), nullable=True),
        sa.Column('metadata', JSONB, nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(
            ['employee_id'],
            ['users.id'],
            ondelete='CASCADE',
            name='fk_department_assignment_history_employee_id_users'
        ),
        sa.ForeignKeyConstraint(
            ['from_department_id'],
            ['departments.id'],
            ondelete='SET NULL',
            name='fk_department_assignment_history_from_department_id_departments'
        ),
        sa.ForeignKeyConstraint(
            ['to_department_id'],
            ['departments.id'],
            ondelete='SET NULL',
            name='fk_department_assignment_history_to_department_id_departments'
        ),
        sa.ForeignKeyConstraint(
            ['changed_by_user_id'],
            ['users.id'],
            ondelete='SET NULL',
            name='fk_department_assignment_history_changed_by_user_id_users'
        )
    )

    # Create indexes for efficient querying
    op.create_index(
        'ix_department_assignment_history_id',
        'department_assignment_history',
        ['id'],
        unique=False
    )
    op.create_index(
        'ix_department_assignment_history_employee_id',
        'department_assignment_history',
        ['employee_id'],
        unique=False
    )
    op.create_index(
        'ix_department_assignment_history_changed_by_user_id',
        'department_assignment_history',
        ['changed_by_user_id'],
        unique=False
    )
    op.create_index(
        'ix_department_assignment_history_changed_at',
        'department_assignment_history',
        ['changed_at'],
        unique=False
    )


def downgrade() -> None:
    """
    Drop department_assignment_history table and all associated indexes.
    """
    op.drop_index('ix_department_assignment_history_changed_at', table_name='department_assignment_history')
    op.drop_index('ix_department_assignment_history_changed_by_user_id', table_name='department_assignment_history')
    op.drop_index('ix_department_assignment_history_employee_id', table_name='department_assignment_history')
    op.drop_index('ix_department_assignment_history_id', table_name='department_assignment_history')
    op.drop_table('department_assignment_history')
