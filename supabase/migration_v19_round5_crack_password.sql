-- ============================================================
-- Migration V19: Update Round 5 to Crack Final Password (10-Step Interactive Workflow)
-- Run this in your Supabase SQL Editor to update Round 5 configuration
-- ============================================================

UPDATE tech_relay_config
SET 
  round_type = 'password',
  round_title = 'Crack Final Password',
  time_limit_seconds = 0,
  correct_answer = 'CRACK_PASSWORD_10_STEP',
  content = '{
    "workflow_type": "10_step_master_password",
    "description": "Sequential 10-step interactive master key assembly with uppercase transformation",
    "steps": [
      {"step": 1, "name": "Base Name", "desc": "Initial codename/identifier string"},
      {"step": 2, "name": "Number Addition", "desc": "Append numeric entropy value"},
      {"step": 3, "name": "Math Challenge", "question": "14 × 7", "answer": "98"},
      {"step": 4, "name": "Brand Logo Selection", "options": ["NEXUS", "OCTOCAT", "CYBER"]},
      {"step": 5, "name": "Color Choice", "options": ["CYAN", "VIOLET", "EMERALD"]},
      {"step": 6, "name": "Tech Tag", "options": ["TS", "PY", "GO", "RUST"]},
      {"step": 7, "name": "Special Symbol", "options": ["!", "#", "$", "&"]},
      {"step": 8, "name": "Verification Digit", "digit": "7"},
      {"step": 9, "name": "String Assembly", "desc": "Sequential combined token stream"},
      {"step": 10, "name": "Final Master Password", "desc": "UPPERCASE encoding & vault unlock"}
    ],
    "math_num1": 14,
    "math_num2": 7,
    "math_op": "×",
    "math_answer": "98",
    "verify_digit": "7"
  }'::jsonb
WHERE round_number = 5;
