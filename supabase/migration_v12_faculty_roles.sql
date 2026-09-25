-- ============================================================
-- Migration V12: Faculty Roles & Real-Time Alert Engine
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- TABLE: faculty
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculty_email ON faculty(email);

-- ============================================================
-- TABLE: faculty_subjects (Junction — faculty ↔ branches)
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty_subjects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id  UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  branch      TEXT NOT NULL,
  subject_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faculty_id, branch)
);

CREATE INDEX IF NOT EXISTS idx_faculty_subjects_faculty ON faculty_subjects(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_subjects_branch ON faculty_subjects(branch);

-- ============================================================
-- TABLE: live_alerts (Real-Time Event Bus)
-- ============================================================
CREATE TABLE IF NOT EXISTS live_alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  TEXT NOT NULL,
  student_usn TEXT,
  student_name TEXT,
  exam_name   TEXT,
  branch      TEXT,
  alert_type  TEXT NOT NULL,
  message     TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_alerts_branch ON live_alerts(branch);
CREATE INDEX IF NOT EXISTS idx_live_alerts_created ON live_alerts(created_at DESC);

-- ============================================================
-- REALTIME: Enable for live_alerts
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE live_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE faculty;

-- ============================================================
-- RLS: Faculty branch-isolated write access on questions
-- ============================================================

-- Faculty can INSERT questions only for their assigned branches
CREATE POLICY "Faculty insert own branch questions"
  ON questions FOR INSERT
  WITH CHECK (
    branch IN (
      SELECT fs.branch FROM faculty_subjects fs
      WHERE fs.faculty_id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    )
  );

-- Faculty can UPDATE questions only for their assigned branches
CREATE POLICY "Faculty update own branch questions"
  ON questions FOR UPDATE
  USING (
    branch IN (
      SELECT fs.branch FROM faculty_subjects fs
      WHERE fs.faculty_id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    )
  );

-- Faculty can DELETE questions only for their assigned branches
CREATE POLICY "Faculty delete own branch questions"
  ON questions FOR DELETE
  USING (
    branch IN (
      SELECT fs.branch FROM faculty_subjects fs
      WHERE fs.faculty_id = (current_setting('request.jwt.claims', true)::json->>'faculty_id')::uuid
    )
  );

-- ============================================================
-- RLS: live_alerts — open read for faculty, insert for backend
-- ============================================================
ALTER TABLE live_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read alerts"
  ON live_alerts FOR SELECT
  USING (true);

CREATE POLICY "Backend can insert alerts"
  ON live_alerts FOR INSERT
  WITH CHECK (true);

-- Allow service role full access (backend inserts alerts)
ALTER TABLE faculty DISABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_subjects DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGER: auto-update updated_at on faculty
-- ============================================================
CREATE TRIGGER update_faculty_updated_at
  BEFORE UPDATE ON faculty
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CLEANUP FUNCTION: Auto-purge alerts older than 24h
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS void AS $$
BEGIN
  DELETE FROM live_alerts WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
