"""Add auth tables (users, roles, permissions, login_attempts, refresh_tokens, audit_logs)

Revision ID: 003
Revises: 002
Create Date: 2025-11-12 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_login_attempt', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_successful_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('account_locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('email_verification_token', sa.String(length=255), nullable=True),
        sa.Column('email_verification_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('password_reset_token', sa.String(length=255), nullable=True),
        sa.Column('password_reset_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )

    # Create indexes for users table
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Create roles table
    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create indexes for roles table
    op.create_index('ix_roles_id', 'roles', ['id'], unique=False)
    op.create_index('ix_roles_name', 'roles', ['name'], unique=True)

    # Create permissions table
    op.create_table(
        'permissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('resource', sa.String(length=100), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create indexes for permissions table
    op.create_index('ix_permissions_id', 'permissions', ['id'], unique=False)
    op.create_index('ix_permissions_name', 'permissions', ['name'], unique=True)

    # Create user_roles join table
    op.create_table(
        'user_roles',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_user_roles_user_id'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name='fk_user_roles_role_id'),
        sa.PrimaryKeyConstraint('user_id', 'role_id')
    )

    # Create role_permissions join table
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name='fk_role_permissions_role_id'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], name='fk_role_permissions_permission_id'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )

    # Create login_attempts table
    op.create_table(
        'login_attempts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('failure_reason', sa.String(length=255), nullable=True),
        sa.Column('attempted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_login_attempts_user_id'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for login_attempts table
    op.create_index('ix_login_attempts_id', 'login_attempts', ['id'], unique=False)
    op.create_index('ix_login_attempts_email', 'login_attempts', ['email'], unique=False)
    op.create_index('ix_login_attempts_user_id', 'login_attempts', ['user_id'], unique=False)

    # Create refresh_tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_jti', sa.String(length=255), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_refresh_tokens_user_id'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_jti')
    )

    # Create indexes for refresh_tokens table
    op.create_index('ix_refresh_tokens_id', 'refresh_tokens', ['id'], unique=False)
    op.create_index('ix_refresh_tokens_token_jti', 'refresh_tokens', ['token_jti'], unique=True)
    op.create_index('ix_refresh_tokens_user_id', 'refresh_tokens', ['user_id'], unique=False)

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('resource', sa.String(length=100), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('failure_reason', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_audit_logs_user_id'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for audit_logs table
    op.create_index('ix_audit_logs_id', 'audit_logs', ['id'], unique=False)
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'], unique=False)
    op.create_index('ix_audit_logs_event_type', 'audit_logs', ['event_type'], unique=False)
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False)


def downgrade() -> None:
    # Drop audit_logs table
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_event_type', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_id', table_name='audit_logs')
    op.drop_table('audit_logs')

    # Drop refresh_tokens table
    op.drop_index('ix_refresh_tokens_user_id', table_name='refresh_tokens')
    op.drop_index('ix_refresh_tokens_token_jti', table_name='refresh_tokens')
    op.drop_index('ix_refresh_tokens_id', table_name='refresh_tokens')
    op.drop_table('refresh_tokens')

    # Drop login_attempts table
    op.drop_index('ix_login_attempts_user_id', table_name='login_attempts')
    op.drop_index('ix_login_attempts_email', table_name='login_attempts')
    op.drop_index('ix_login_attempts_id', table_name='login_attempts')
    op.drop_table('login_attempts')

    # Drop join tables
    op.drop_table('role_permissions')
    op.drop_table('user_roles')

    # Drop permissions table
    op.drop_index('ix_permissions_name', table_name='permissions')
    op.drop_index('ix_permissions_id', table_name='permissions')
    op.drop_table('permissions')

    # Drop roles table
    op.drop_index('ix_roles_name', table_name='roles')
    op.drop_index('ix_roles_id', table_name='roles')
    op.drop_table('roles')

    # Drop users table
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_table('users')
