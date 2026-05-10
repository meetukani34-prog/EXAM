-- ── Migration: Multi-Exam Support ────────────────────────────
-- Description: Updates exam_status and exam_results to support 
-- multiple exams per student by removing the unique constraint on student_id
-- and replacing it with a composite unique constraint on (student_id, exam_name).
-- Run this in your Supabase SQL Editor.

-- 1. Update exam_status
ALTER TABLE exam_status DROP CONSTRAINT IF EXISTS exam_status_student_id_key;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_status_student_exam_unique') THEN
    ALTER TABLE exam_status ADD CONSTRAINT exam_status_student_exam_unique UNIQUE (student_id, exam_name);
  END IF;
END $$;

-- 2. Update exam_results
-- First, add exam_name column if it doesn't exist
ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS exam_name TEXT DEFAULT 'Initial Assessment';

-- Remove old constraint and add new composite constraint
ALTER TABLE exam_results DROP CONSTRAINT IF EXISTS exam_results_student_id_key;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_results_student_exam_unique') THEN
    ALTER TABLE exam_results ADD CONSTRAINT exam_results_student_exam_unique UNIQUE (student_id, exam_name);
  END IF;
END $$;

-- 3. Update exam_config with branch
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'ALL';
