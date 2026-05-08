-- ── Migration: Support Fractional Scoring ────────────────────
-- Description: Updates scoring columns from INTEGER to NUMERIC 
-- to support fractional negative marks (e.g. -0.25).
-- Run this in your Supabase SQL Editor.

-- 1. Update exam_config table
ALTER TABLE exam_config 
  ALTER COLUMN negative_marks TYPE NUMERIC;

-- 2. Update exam_results table (to store fractional scores)
ALTER TABLE exam_results 
  ALTER COLUMN score TYPE NUMERIC;

-- 3. Update leaderboard view (if applicable) or ensure columns match
-- If you have a view for results, it will automatically reflect the change.
