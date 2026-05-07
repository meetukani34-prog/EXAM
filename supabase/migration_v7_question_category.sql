-- Add category column to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- (Optional) Backfill existing data based on keywords in exam_name
UPDATE questions 
SET category = 'aptitude' 
WHERE category = 'other' AND (
  exam_name ILIKE '%aptitude%' OR 
  exam_name ILIKE '%quant%' OR 
  exam_name ILIKE '%reasoning%' OR 
  exam_name ILIKE '%logical%' OR 
  exam_name ILIKE '%verbal%' OR 
  exam_name ILIKE '%english%' OR 
  exam_name ILIKE '%numerical%'
);

UPDATE questions 
SET category = 'programming' 
WHERE category = 'other' AND (
  exam_name ILIKE '%program%' OR 
  exam_name ILIKE '%code%' OR 
  exam_name ILIKE '%coding%' OR 
  exam_name ILIKE '%dsa%' OR 
  exam_name ILIKE '%algorithm%' OR 
  exam_name ILIKE '%python%' OR 
  exam_name ILIKE '%java%'
);
