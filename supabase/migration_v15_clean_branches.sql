-- Migration v15: Normalize branches (remove -1, -2 year suffixes) and align student year
-- Run this in your Supabase SQL Editor

-- 1. Update students table
UPDATE students SET year = '1st Year' WHERE branch IN ('BCA-1', 'MBA-1') AND (year IS NULL OR year = '');
UPDATE students SET year = '2nd Year' WHERE branch IN ('BCA-2', 'MBA-2', 'MCA-2', 'BBA-2') AND (year IS NULL OR year = '');

UPDATE students SET branch = 'BCA' WHERE branch IN ('BCA-1', 'BCA-2');
UPDATE students SET branch = 'MBA' WHERE branch IN ('MBA-1', 'MBA-2');
UPDATE students SET branch = 'MCA' WHERE branch IN ('MCA-2');
UPDATE students SET branch = 'BBA' WHERE branch IN ('BBA-2');

-- 2. Update questions table
UPDATE questions SET branch = 'BCA' WHERE branch IN ('BCA-1', 'BCA-2');
UPDATE questions SET branch = 'MBA' WHERE branch IN ('MBA-1', 'MBA-2');
UPDATE questions SET branch = 'MCA' WHERE branch IN ('MCA-2');
UPDATE questions SET branch = 'BBA' WHERE branch IN ('BBA-2');

-- 3. Update faculty_subjects table (handles UNIQUE(faculty_id, branch) safely)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'faculty_subjects') THEN
    
    -- Clean duplicate BCA assignments for faculty
    DELETE FROM faculty_subjects fs1
    WHERE fs1.branch IN ('BCA-1', 'BCA-2')
      AND EXISTS (
        SELECT 1 FROM faculty_subjects fs2 
        WHERE fs2.faculty_id = fs1.faculty_id AND fs2.branch = 'BCA'
      );

    DELETE FROM faculty_subjects fs1
    WHERE fs1.branch = 'BCA-2'
      AND EXISTS (
        SELECT 1 FROM faculty_subjects fs2 
        WHERE fs2.faculty_id = fs1.faculty_id AND fs2.branch = 'BCA-1'
      );

    UPDATE faculty_subjects SET branch = 'BCA' WHERE branch IN ('BCA-1', 'BCA-2');

    -- Clean duplicate MBA assignments for faculty
    DELETE FROM faculty_subjects fs1
    WHERE fs1.branch IN ('MBA-1', 'MBA-2')
      AND EXISTS (
        SELECT 1 FROM faculty_subjects fs2 
        WHERE fs2.faculty_id = fs1.faculty_id AND fs2.branch = 'MBA'
      );

    DELETE FROM faculty_subjects fs1
    WHERE fs1.branch = 'MBA-2'
      AND EXISTS (
        SELECT 1 FROM faculty_subjects fs2 
        WHERE fs2.faculty_id = fs1.faculty_id AND fs2.branch = 'MBA-1'
      );

    UPDATE faculty_subjects SET branch = 'MBA' WHERE branch IN ('MBA-1', 'MBA-2');

    -- Clean duplicate MCA assignments for faculty
    DELETE FROM faculty_subjects fs1
    WHERE fs1.branch = 'MCA-2'
      AND EXISTS (
        SELECT 1 FROM faculty_subjects fs2 
        WHERE fs2.faculty_id = fs1.faculty_id AND fs2.branch = 'MCA'
      );

    UPDATE faculty_subjects SET branch = 'MCA' WHERE branch = 'MCA-2';

    -- Clean duplicate BBA assignments for faculty
    DELETE FROM faculty_subjects fs1
    WHERE fs1.branch = 'BBA-2'
      AND EXISTS (
        SELECT 1 FROM faculty_subjects fs2 
        WHERE fs2.faculty_id = fs1.faculty_id AND fs2.branch = 'BBA'
      );

    UPDATE faculty_subjects SET branch = 'BBA' WHERE branch = 'BBA-2';

  END IF;
END $$;
