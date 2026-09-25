-- ============================================================
-- Migration V14: Add 'year' column to students table
-- ============================================================

-- Add year column with default '1st Year' for new signups
ALTER TABLE students ADD COLUMN IF NOT EXISTS year TEXT DEFAULT '1st Year';

-- Set all existing students to '2nd Year'
UPDATE students SET year = '2nd Year' WHERE year IS NULL OR year = '1st Year';
