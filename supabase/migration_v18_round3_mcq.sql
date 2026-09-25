-- ============================================================
-- Migration V18: Ensure Round 3 is configured as MCQ format
-- Run this in your Supabase SQL Editor if Round 3 still shows Code Error
-- ============================================================

UPDATE tech_relay_config
SET 
  round_type = 'mcq',
  round_title = 'Code & Logic Quiz',
  time_limit_seconds = 0,
  correct_answer = 'mcq_all',
  content = '{
    "questions": [
      {
        "question": "What is the output of print(type([])) in Python?",
        "options": ["<class ''list''>", "<class ''tuple''>", "<class ''dict''>", "<class ''set''>"],
        "correct": 0
      },
      {
        "question": "What is the output of 2 ** 3 ** 2 in Python?",
        "options": ["64", "512", "256", "36"],
        "correct": 1
      },
      {
        "question": "Which of the following is an immutable data type in Python?",
        "options": ["List", "Dictionary", "Tuple", "Set"],
        "correct": 2
      },
      {
        "question": "What does len(set([1, 2, 2, 3, 3, 3])) return?",
        "options": ["6", "3", "1", "Error"],
        "correct": 1
      },
      {
        "question": "In Python, which keyword combination is used to handle exceptions?",
        "options": ["try...catch", "try...except", "do...rescue", "handle...throw"],
        "correct": 1
      }
    ]
  }'::jsonb
WHERE round_number = 3;
