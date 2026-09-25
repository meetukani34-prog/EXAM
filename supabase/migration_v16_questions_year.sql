-- Migration v16: Add year column to questions and exam_config tables
-- Run this in your Supabase SQL Editor

-- 1. Add year column to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS year TEXT DEFAULT '1st Year';

-- 2. Update existing questions to '1st Year' if null or empty
UPDATE questions SET year = '1st Year' WHERE year IS NULL OR year = '';

-- 3. Add year column to exam_config table
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS year TEXT DEFAULT 'ALL';

-- 4. Create index for fast filtering by branch and year
CREATE INDEX IF NOT EXISTS idx_questions_branch_year ON questions(branch, year);
