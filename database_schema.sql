-- Chronologicon Engine Database Schema
-- PostgreSQL DDL Script

-- Create database (run this separately if needed)
-- CREATE DATABASE chronologicon_db;

-- Connect to the database
-- \c chronologicon_db;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the historical_events table
CREATE TABLE historical_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_date - start_date)) / 60
    ) STORED,
    parent_event_id UUID REFERENCES historical_events(event_id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_historical_events_start_date ON historical_events(start_date);
CREATE INDEX idx_historical_events_end_date ON historical_events(end_date);
CREATE INDEX idx_historical_events_parent_id ON historical_events(parent_event_id);
CREATE INDEX idx_historical_events_name ON historical_events(event_name);
CREATE INDEX idx_historical_events_duration ON historical_events(duration_minutes);
CREATE INDEX idx_historical_events_date_range ON historical_events(start_date, end_date);

-- Create GIN index for JSONB metadata field
CREATE INDEX idx_historical_events_metadata ON historical_events USING GIN(metadata);

-- Create ingestion_jobs table to track file processing jobs
CREATE TABLE ingestion_jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    file_path VARCHAR(500),
    total_lines INTEGER DEFAULT 0,
    processed_lines INTEGER DEFAULT 0,
    error_lines INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on job status for quick lookups
CREATE INDEX idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX idx_ingestion_jobs_created_at ON ingestion_jobs(created_at);

-- Add constraint to ensure end_date is after start_date
ALTER TABLE historical_events 
ADD CONSTRAINT chk_date_order 
CHECK (end_date > start_date);

-- Add constraint to ensure status values are valid
ALTER TABLE ingestion_jobs 
ADD CONSTRAINT chk_job_status 
CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_historical_events_updated_at 
    BEFORE UPDATE ON historical_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingestion_jobs_updated_at 
    BEFORE UPDATE ON ingestion_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for events with their hierarchy depth
CREATE OR REPLACE VIEW events_with_hierarchy AS
WITH RECURSIVE event_hierarchy AS (
    -- Base case: root events (no parent)
    SELECT 
        event_id,
        event_name,
        description,
        start_date,
        end_date,
        duration_minutes,
        parent_event_id,
        metadata,
        0 as depth,
        ARRAY[event_id] as path
    FROM historical_events 
    WHERE parent_event_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child events
    SELECT 
        he.event_id,
        he.event_name,
        he.description,
        he.start_date,
        he.end_date,
        he.duration_minutes,
        he.parent_event_id,
        he.metadata,
        eh.depth + 1,
        eh.path || he.event_id
    FROM historical_events he
    JOIN event_hierarchy eh ON he.parent_event_id = eh.event_id
)
SELECT * FROM event_hierarchy;

-- Sample data for testing (optional)
-- INSERT INTO historical_events (event_id, event_name, description, start_date, end_date, parent_event_id) VALUES
-- ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Founding of ArchaeoData', 'Initial establishment of the company.', '2023-01-01T10:00:00Z', '2023-01-01T11:30:00Z', NULL),
-- ('f7e6d5c4-b3a2-1098-7654-3210fedcba98', 'Phase 1 Research', 'Early research on data fragmentation techniques.', '2023-01-01T10:30:00Z', '2023-01-01T11:00:00Z', 'a1b2c3d4-e5f6-7890-1234-567890abcdef'),
-- ('11223344-5566-7788-9900-aabbccddeeff', 'Internal Review Meeting', 'Reviewing initial research findings.', '2023-01-01T10:45:00Z', '2023-01-01T11:15:00Z', 'f7e6d5c4-b3a2-1098-7654-3210fedcba98');
