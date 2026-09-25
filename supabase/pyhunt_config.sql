-- PyHunt Global Configuration
-- Stores clues, codes, and other round-specific parameters for all students

CREATE TABLE IF NOT EXISTS pyhunt_global_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT UNIQUE NOT NULL, -- 'rounds_config', 'mcqs', 'jumbles', 'auth'
    config_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pyhunt_global_config;

-- Initial Seed Data (if not exists)
INSERT INTO pyhunt_global_config (config_key, config_value)
VALUES 
('rounds_config', '[
    {"round": 1, "name": "MCQ", "clue": "Locate the physical node to find your code.", "code": "LIBRARY42"},
    {"round": 2, "name": "Jumble", "clue": "Order matters in logic.", "code": "LAB2CO"},
    {"round": 3, "name": "Palindrome", "clue": "The mirror speaks the truth.", "code": "HEX33"},
    {"round": 4, "name": "FizzBuzz", "clue": "Numbers dance in patterns.", "code": "F1ZZ"}
]'),
('mcqs', '[
    {"id": 1, "question": "What is the output of print(2**3)?", "options": ["6", "8", "9", "5"], "answer": 1}
]'),
('auth', '{"startCode": "PYHUNT67", "authorizedUsns": ""}');
