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

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully at %', NOW();
END $$;
