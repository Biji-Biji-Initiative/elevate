-- Database initialization script for MS Elevate LEAPS Tracker
-- This script runs automatically when the PostgreSQL container starts for the first time
-- It ensures the database is properly configured for development

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'MS Elevate LEAPS PostgreSQL database initialized successfully';
END
$$;