"""Add departments table and update foreign keys

Revision ID: 002
Revises: 001
Create Date: 2025-11-12 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create departments table
    op.create_table(
        'departments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('settings', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['parent_id'], ['departments.id'], name='fk_departments_parent_id'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create indexes for departments
    op.create_index('ix_departments_id', 'departments', ['id'], unique=False)
    op.create_index('ix_departments_name', 'departments', ['name'], unique=True)
    op.create_index('ix_departments_parent_id', 'departments', ['parent_id'], unique=False)
    op.create_index('ix_departments_active', 'departments', ['active'], unique=False)

    # Add department_id column to employees table
    op.add_column('employees', sa.Column('department_id', sa.Integer(), nullable=True))
    op.create_index('ix_employees_department_id', 'employees', ['department_id'], unique=False)
    op.create_foreign_key('fk_employees_department_id', 'employees', 'departments', ['department_id'], ['id'])

    # Add department_id column to shifts table
    op.add_column('shifts', sa.Column('department_id', sa.Integer(), nullable=True))
    op.create_index('ix_shifts_department_id', 'shifts', ['department_id'], unique=False)
    op.create_foreign_key('fk_shifts_department_id', 'shifts', 'departments', ['department_id'], ['id'])


def downgrade() -> None:
    # Remove foreign keys
    op.drop_constraint('fk_shifts_department_id', 'shifts', type_='foreignkey')
    op.drop_constraint('fk_employees_department_id', 'employees', type_='foreignkey')

    # Drop indexes
    op.drop_index('ix_shifts_department_id', table_name='shifts')
    op.drop_index('ix_employees_department_id', table_name='employees')

    # Remove department_id columns
    op.drop_column('shifts', 'department_id')
    op.drop_column('employees', 'department_id')

    # Drop departments table indexes
    op.drop_index('ix_departments_active', table_name='departments')
    op.drop_index('ix_departments_parent_id', table_name='departments')
    op.drop_index('ix_departments_name', table_name='departments')
    op.drop_index('ix_departments_id', table_name='departments')

    # Drop departments table
    op.drop_table('departments')
