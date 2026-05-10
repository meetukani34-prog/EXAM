-- Create the global configuration table for PyHunt
CREATE TABLE IF NOT EXISTS public.pyhunt_global_config (
    config_key TEXT PRIMARY KEY,
    config_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE pyhunt_global_config;

-- Add RLS policy to allow students to read (optional, as the backend usually handles this)
ALTER TABLE pyhunt_global_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for global config" ON pyhunt_global_config
    FOR SELECT USING (true);

-- Insert default rounds configuration
INSERT INTO pyhunt_global_config (config_key, config_value)
VALUES ('rounds_config', '[
    {"round": 1, "name": "MCQ", "clue": "Locate the physical node to find your code.", "code": "LIBRARY42"},
    {"round": 2, "name": "Jumble", "clue": "Order matters in logic.", "code": "LAB2CO"},
    {"round": 3, "name": "Palindrome", "clue": "The mirror speaks the truth.", "code": "HEX33"},
    {"round": 4, "name": "FizzBuzz", "clue": "Numbers dance in patterns.", "code": "F1ZZ"}
]')
ON CONFLICT (config_key) DO NOTHING;
