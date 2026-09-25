-- Add avatar_url column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url TEXT;
