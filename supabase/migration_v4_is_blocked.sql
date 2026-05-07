-- Add is_blocked column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
