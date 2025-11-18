"""Split employee name into first_name and last_name

Revision ID: bb9b289e82c2
Revises: 004
Create Date: 2025-11-18 13:09:21.563480

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb9b289e82c2'
down_revision: Union[str, Sequence[str], None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - split name into first_name and last_name."""
    # Add new columns with nullable=True initially
    op.add_column('employees', sa.Column('first_name', sa.String(length=50), nullable=True))
    op.add_column('employees', sa.Column('last_name', sa.String(length=50), nullable=True))

    # Migrate existing data - split name into first_name and last_name
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE employees
        SET
            first_name = CASE
                WHEN position(' ' IN name) > 0 THEN split_part(name, ' ', 1)
                ELSE name
            END,
            last_name = CASE
                WHEN position(' ' IN name) > 0 THEN substring(name FROM position(' ' IN name) + 1)
                ELSE ''
            END
        WHERE name IS NOT NULL
    """))

    # Make columns not nullable after data migration
    op.alter_column('employees', 'first_name', nullable=False)
    op.alter_column('employees', 'last_name', nullable=False)

    # Create indexes on new columns
    op.create_index(op.f('ix_employees_first_name'), 'employees', ['first_name'], unique=False)
    op.create_index(op.f('ix_employees_last_name'), 'employees', ['last_name'], unique=False)

    # Drop old constraint
    op.drop_constraint('name_min_length', 'employees', type_='check')

    # Add new constraints for first_name and last_name
    op.create_check_constraint('first_name_min_length', 'employees', 'char_length(first_name) >= 1')
    op.create_check_constraint('last_name_min_length', 'employees', 'char_length(last_name) >= 1')

    # Drop old name column and its index
    op.drop_index('ix_employees_name', table_name='employees')
    op.drop_column('employees', 'name')


def downgrade() -> None:
    """Downgrade schema - merge first_name and last_name back to name."""
    # Add back the name column
    op.add_column('employees', sa.Column('name', sa.String(length=255), nullable=True))

    # Migrate data - combine first_name and last_name into name
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE employees
        SET name = first_name || ' ' || last_name
        WHERE first_name IS NOT NULL AND last_name IS NOT NULL
    """))

    # Make name column not nullable
    op.alter_column('employees', 'name', nullable=False)

    # Create index on name
    op.create_index('ix_employees_name', 'employees', ['name'], unique=False)

    # Drop new constraints
    op.drop_constraint('last_name_min_length', 'employees', type_='check')
    op.drop_constraint('first_name_min_length', 'employees', type_='check')

    # Add back old constraint
    op.create_check_constraint('name_min_length', 'employees', 'char_length(name) >= 2')

    # Drop new indexes and columns
    op.drop_index(op.f('ix_employees_last_name'), table_name='employees')
    op.drop_index(op.f('ix_employees_first_name'), table_name='employees')
    op.drop_column('employees', 'last_name')
    op.drop_column('employees', 'first_name')
