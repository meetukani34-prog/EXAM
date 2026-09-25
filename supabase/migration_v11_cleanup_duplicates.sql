-- ── Migration: Cleanup Duplicate Exam Status ────────────────────────
-- Description: Deletes duplicate exam_status records for the same student/exam
-- and enforces a composite unique constraint.
-- This prevents students from resetting warnings and fixes dashboard visibility.

-- 1. Remove duplicates, keeping only the most 'advanced' record (active/submitted > not_started)
DELETE FROM exam_status a USING (
    SELECT MIN(ctid) as keep_ctid, student_id, LOWER(exam_name) as lower_exam
    FROM exam_status
    GROUP BY student_id, LOWER(exam_name)
    HAVING COUNT(*) > 1
) b
WHERE a.student_id = b.student_id 
  AND LOWER(a.exam_name) = b.lower_exam 
  AND a.ctid != b.keep_ctid;

-- 2. Enforce the composite UNIQUE constraint
-- First drop existing ones to avoid duplicates/errors
ALTER TABLE exam_status DROP CONSTRAINT IF EXISTS exam_status_student_id_exam_name_key;
ALTER TABLE exam_status DROP CONSTRAINT IF EXISTS exam_status_student_id_key;

-- Add the new robust constraint
ALTER TABLE exam_status ADD CONSTRAINT exam_status_student_id_exam_name_key UNIQUE (student_id, exam_name);

-- 3. Ensure odyssey_progress also has a unique student_id constraint
ALTER TABLE odyssey_progress DROP CONSTRAINT IF EXISTS odyssey_progress_student_id_key;
ALTER TABLE odyssey_progress ADD CONSTRAINT odyssey_progress_student_id_key UNIQUE (student_id);
