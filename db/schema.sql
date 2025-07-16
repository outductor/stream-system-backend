-- DJ Event Streaming System Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_name VARCHAR(100) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    passcode CHAR(4) NOT NULL CHECK (passcode ~ '^[0-9]{4}$'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure no overlapping reservations
    CONSTRAINT no_overlap EXCLUDE USING gist (
        tsrange(start_time, end_time) WITH &&
    ),
    
    -- Ensure start_time is before end_time
    CONSTRAINT valid_time_range CHECK (start_time < end_time),
    
    -- Ensure times are on 15-minute intervals
    CONSTRAINT start_time_interval CHECK (
        EXTRACT(MINUTE FROM start_time) IN (0, 15, 30, 45) AND
        EXTRACT(SECOND FROM start_time) = 0
    ),
    CONSTRAINT end_time_interval CHECK (
        EXTRACT(MINUTE FROM end_time) IN (0, 15, 30, 45) AND
        EXTRACT(SECOND FROM end_time) = 0
    ),
    
    -- Ensure maximum duration is 1 hour
    CONSTRAINT max_duration CHECK (
        end_time - start_time <= INTERVAL '1 hour'
    )
);

-- Index for faster queries by time
CREATE INDEX idx_reservations_start_time ON reservations(start_time);
CREATE INDEX idx_reservations_end_time ON reservations(end_time);

-- Stream sessions table (for tracking stream history)
CREATE TABLE IF NOT EXISTS stream_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    rtmp_key VARCHAR(255) NOT NULL,
    viewer_count INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0
);

-- Viewer stats table (for real-time viewer tracking)
CREATE TABLE IF NOT EXISTS viewer_stats (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    viewer_count INTEGER NOT NULL
);

-- Create a view for current/next DJ info
CREATE OR REPLACE VIEW current_next_dj AS
WITH current_dj AS (
    SELECT 
        dj_name,
        start_time,
        end_time
    FROM reservations
    WHERE start_time <= CURRENT_TIMESTAMP 
    AND end_time > CURRENT_TIMESTAMP
    ORDER BY start_time
    LIMIT 1
),
next_dj AS (
    SELECT 
        dj_name,
        start_time,
        end_time
    FROM reservations
    WHERE start_time > CURRENT_TIMESTAMP
    ORDER BY start_time
    LIMIT 1
)
SELECT 
    current_dj.dj_name as current_dj_name,
    current_dj.start_time as current_start_time,
    current_dj.end_time as current_end_time,
    next_dj.dj_name as next_dj_name,
    next_dj.start_time as next_start_time,
    next_dj.end_time as next_end_time
FROM 
    (SELECT 1) dummy
    LEFT JOIN current_dj ON true
    LEFT JOIN next_dj ON true;
