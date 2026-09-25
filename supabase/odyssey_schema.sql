-- Cognitive Odyssey: Treasure Hunt Schema
-- Designed for high-fidelity state persistence and real-time tracking

-- 1. Create the Odyssey Progress table
CREATE TABLE IF NOT EXISTS odyssey_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    current_round INTEGER DEFAULT 1,
    round_1_state JSONB DEFAULT '{}', -- Syntax Correction
    round_2_state JSONB DEFAULT '{}', -- Structural Alignment
    round_3_state JSONB DEFAULT '{}', -- Linguistic Logic
    round_4_state JSONB DEFAULT '{}', -- Algorithmic Pattern
    round_5_state JSONB DEFAULT '{}', -- Visual Manifestation
    is_completed BOOLEAN DEFAULT FALSE,
    completion_velocity BIGINT DEFAULT 0, -- Total time in milliseconds
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_entropy INTEGER DEFAULT 0, -- Count of failed attempts
    UNIQUE(student_id)
);

-- 2. Create the Odyssey Rounds configuration (optional, can be hardcoded in frontend)
-- For this "Weightless" architecture, we'll keep the round logic in the frontend/API
-- to minimize DB latency, but we'll track the "Keys" here if needed.

-- 3. Enable Realtime for Odyssey Progress
ALTER PUBLICATION supabase_realtime ADD TABLE odyssey_progress;

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_odyssey_student ON odyssey_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_odyssey_round ON odyssey_progress(current_round);
CREATE INDEX IF NOT EXISTS idx_odyssey_velocity ON odyssey_progress(completion_velocity) WHERE is_completed = TRUE;

-- 5. Helper Function for Admin Override
CREATE OR REPLACE FUNCTION force_unlock_round(target_student_id UUID, next_round INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE odyssey_progress 
    SET current_round = next_round,
        last_ping = NOW()
    WHERE student_id = target_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
