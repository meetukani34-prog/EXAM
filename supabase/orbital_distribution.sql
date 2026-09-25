-- Track completions per round to assign atomic ranks for Orbital Distribution
CREATE TABLE IF NOT EXISTS round_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completion_rank INTEGER,
    UNIQUE(student_id, round_number)
);

-- RPC for Atomic Rank Assignment
-- This prevents race conditions by using the database's serialized execution
CREATE OR REPLACE FUNCTION increment_round_completion(target_student_id UUID, round_num INTEGER)
RETURNS INTEGER AS $$
DECLARE
    final_rank INTEGER;
BEGIN
    -- 1. Check if student already has a rank for this round (idempotency)
    SELECT completion_rank INTO final_rank 
    FROM round_submissions 
    WHERE student_id = target_student_id AND round_number = round_num;

    IF final_rank IS NULL THEN
        -- 2. Atomic increment: get current max rank for this round and add 1
        -- Using a subquery ensures we get the latest count within the transaction
        INSERT INTO round_submissions (student_id, round_number, completion_rank)
        SELECT target_student_id, round_num, COALESCE(MAX(completion_rank), 0) + 1
        FROM round_submissions
        WHERE round_number = round_num
        RETURNING completion_rank INTO final_rank;
    END IF;

    RETURN final_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS Policies for security
ALTER TABLE round_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own submissions"
ON round_submissions FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own submissions via RPC"
ON round_submissions FOR INSERT
WITH CHECK (auth.uid() = student_id);
