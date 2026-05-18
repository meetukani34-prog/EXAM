-- ============================================================
-- Migration V13: Faculty Question Categories & RLS
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Add categories array to faculty to restrict them by question type
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- 2. Update RLS policies on questions to check both branch AND categories
-- Drop existing policies from V12
DROP POLICY IF EXISTS "Faculty insert own branch questions" ON questions;
DROP POLICY IF EXISTS "Faculty update own branch questions" ON questions;
DROP POLICY IF EXISTS "Faculty delete own branch questions" ON questions;

-- Recreate with category restrictions
-- Note: if faculty.categories is empty, they cannot insert/update anything.
-- We check if the question's category is in the faculty's categories array.

CREATE POLICY "Faculty insert own branch questions"
  ON questions FOR INSERT
  WITH CHECK (
    branch IN (
      SELECT fs.branch FROM faculty_subjects fs
      WHERE fs.faculty_id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    ) AND
    category = ANY(
      SELECT unnest(f.categories) FROM faculty f
      WHERE f.id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    )
  );

CREATE POLICY "Faculty update own branch questions"
  ON questions FOR UPDATE
  USING (
    branch IN (
      SELECT fs.branch FROM faculty_subjects fs
      WHERE fs.faculty_id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    ) AND
    category = ANY(
      SELECT unnest(f.categories) FROM faculty f
      WHERE f.id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    )
  );

CREATE POLICY "Faculty delete own branch questions"
  ON questions FOR DELETE
  USING (
    branch IN (
      SELECT fs.branch FROM faculty_subjects fs
      WHERE fs.faculty_id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    ) AND
    category = ANY(
      SELECT unnest(f.categories) FROM faculty f
      WHERE f.id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    )
  );
