"""Add performance indexes for employee queries

Revision ID: 008_employee_indexes
Revises: 007_add_phone_and_hire_date_to_users
Create Date: 2025-01-24

This migration adds database indexes to optimize employee query performance:
- department_id index (if not exists) for JOIN operations
- first_name, last_name indexes for search operations
- is_active index for filtering operations
- Composite index on (last_name, first_name) for sorting
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_employee_indexes'
down_revision = '007_add_phone_and_hire_date_to_users'
branch_labels = None
depends_on = None


def upgrade():
    """Add performance indexes for employee queries."""

    # Create index on department_id if it doesn't exist
    # This helps with JOIN operations and filtering by department
    op.create_index(
        'ix_users_department_id_performance',
        'users',
        ['department_id'],
        unique=False,
        if_not_exists=True
    )

    # Create index on first_name for search operations
    op.create_index(
        'ix_users_first_name_search',
        'users',
        ['first_name'],
        unique=False,
        if_not_exists=True
    )

    # Create index on last_name for search operations
    op.create_index(
        'ix_users_last_name_search',
        'users',
        ['last_name'],
        unique=False,
        if_not_exists=True
    )

    # Create composite index on (last_name, first_name) for efficient sorting
    # This index is especially useful for ORDER BY last_name, first_name queries
    op.create_index(
        'ix_users_last_name_first_name',
        'users',
        ['last_name', 'first_name'],
        unique=False,
        if_not_exists=True
    )

    # Create index on is_active for filtering active/inactive employees
    op.create_index(
        'ix_users_is_active_filter',
        'users',
        ['is_active'],
        unique=False,
        if_not_exists=True
    )

    # Create composite index on (is_active, department_id) for combined filtering
    # Useful for queries filtering by both status and department
    op.create_index(
        'ix_users_active_department',
        'users',
        ['is_active', 'department_id'],
        unique=False,
        if_not_exists=True
    )


def downgrade():
    """Remove performance indexes."""

    # Drop indexes in reverse order
    op.drop_index('ix_users_active_department', table_name='users', if_exists=True)
    op.drop_index('ix_users_is_active_filter', table_name='users', if_exists=True)
    op.drop_index('ix_users_last_name_first_name', table_name='users', if_exists=True)
    op.drop_index('ix_users_last_name_search', table_name='users', if_exists=True)
    op.drop_index('ix_users_first_name_search', table_name='users', if_exists=True)
    op.drop_index('ix_users_department_id_performance', table_name='users', if_exists=True)
