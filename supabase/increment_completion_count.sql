-- ═══════════════════════════════════════════════════════════════
-- Orbital Clue Distribution — Supabase RPC Function
-- 
-- Purpose: Atomically increment a round's completion counter
-- and return the student's rank for modulo-based clue assignment.
--
-- Formula: ClueIndex = (current_count - 1) % Total_Clues
--
-- Usage from frontend:
--   const { data } = await supabase.rpc('increment_completion_count', { 
--     round: 3 
--   });
--   // data => 5 (the student's rank)
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Create the completion counter table (if not exists)
CREATE TABLE IF NOT EXISTS pyhunt_completion_counters (
  round INTEGER PRIMARY KEY,
  current_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial rows for all rounds
INSERT INTO pyhunt_completion_counters (round, current_count)
VALUES (1, 0), (2, 0), (3, 0), (4, 0), (5, 0)
ON CONFLICT (round) DO NOTHING;

-- Step 2: Create the atomic increment RPC function
CREATE OR REPLACE FUNCTION increment_completion_count(round INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  -- Atomic increment with row-level lock (safe for 200+ concurrent users)
  UPDATE pyhunt_completion_counters
  SET current_count = current_count + 1,
      updated_at = now()
  WHERE pyhunt_completion_counters.round = increment_completion_count.round
  RETURNING current_count INTO new_count;

  -- If no row existed for this round, insert and return 1
  IF new_count IS NULL THEN
    INSERT INTO pyhunt_completion_counters (round, current_count)
    VALUES (increment_completion_count.round, 1)
    ON CONFLICT (round) DO UPDATE SET current_count = pyhunt_completion_counters.current_count + 1
    RETURNING current_count INTO new_count;
  END IF;

  RETURN new_count;
END;
$$;

-- Step 3: Grant access to authenticated and anon users
GRANT EXECUTE ON FUNCTION increment_completion_count(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_completion_count(INTEGER) TO anon;

-- Step 4: (Optional) Reset function for new exam sessions
CREATE OR REPLACE FUNCTION reset_completion_counters()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pyhunt_completion_counters SET current_count = 0, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION reset_completion_counters() TO authenticated;
