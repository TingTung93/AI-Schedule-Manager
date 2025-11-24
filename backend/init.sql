-- Initial database setup for AI Schedule Manager
-- This script runs automatically when the database container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET TIME ZONE 'UTC';

-- Create database user if needed (handled by POSTGRES_USER env var)

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE schedule_manager TO postgres;

-- Health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Database is healthy';
END;
$$ LANGUAGE plpgsql;

-- Create department assignment history table for audit trail
CREATE TABLE IF NOT EXISTS department_assignment_history (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    from_department_id INTEGER,
    to_department_id INTEGER,
    changed_by_user_id INTEGER NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    change_reason TEXT,
    change_metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for department assignment history
CREATE INDEX IF NOT EXISTS idx_dah_employee_id ON department_assignment_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_dah_changed_by_user_id ON department_assignment_history(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_dah_changed_at ON department_assignment_history(changed_at);

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully at %', NOW();
END $$;
