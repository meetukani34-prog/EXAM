-- ============================================================
-- Migration V17: Tech Relay Tables
-- Sequential 5-round interactive technical challenge
-- ============================================================

-- ── tech_relay_config ─────────────────────────────────────────
-- Admin configures each round's content and correct answers
CREATE TABLE IF NOT EXISTS tech_relay_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_name TEXT NOT NULL DEFAULT 'Tech Relay',
  is_active BOOLEAN DEFAULT false,
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 5),
  round_title TEXT NOT NULL,
  round_type TEXT NOT NULL CHECK (round_type IN ('gadget', 'puzzle', 'debug', 'mcq', 'password')),
  content JSONB NOT NULL DEFAULT '{}',
  correct_answer TEXT,
  time_limit_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(relay_name, round_number)
);

-- ── tech_relay_progress ───────────────────────────────────────
-- Tracks each student's progression through the relay
CREATE TABLE IF NOT EXISTS tech_relay_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relay_name TEXT NOT NULL DEFAULT 'Tech Relay',
  current_round INTEGER NOT NULL DEFAULT 1,
  rounds_completed JSONB DEFAULT '[]',
  is_completed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(student_id, relay_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tech_relay_config_relay ON tech_relay_config(relay_name);
CREATE INDEX IF NOT EXISTS idx_tech_relay_progress_student ON tech_relay_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_tech_relay_progress_relay ON tech_relay_progress(relay_name);

-- RLS
ALTER TABLE tech_relay_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_relay_progress ENABLE ROW LEVEL SECURITY;

-- Public read for relay config (students need to see round content)
DROP POLICY IF EXISTS "public_read_tech_relay_config" ON tech_relay_config;
CREATE POLICY "public_read_tech_relay_config" ON tech_relay_config
  FOR SELECT USING (true);

-- Public access for progress (backend uses service role)
ALTER TABLE tech_relay_progress DISABLE ROW LEVEL SECURITY;

-- Updated_at trigger for config
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tech_relay_config_updated_at ON tech_relay_config;
CREATE TRIGGER update_tech_relay_config_updated_at
  BEFORE UPDATE ON tech_relay_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Supabase Realtime for live observer tracking
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tech_relay_progress;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;


