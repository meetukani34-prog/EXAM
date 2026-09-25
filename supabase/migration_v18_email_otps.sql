-- ============================================================
-- Migration V18: Email OTP Verification Table
-- Supports secure OTP dispatch & verification for Login & Signup
-- ============================================================

CREATE TABLE IF NOT EXISTS email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login', 'reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose ON email_otps(email, purpose, verified);
CREATE INDEX IF NOT EXISTS idx_email_otps_created ON email_otps(created_at);

-- RLS policies for email_otps table
ALTER TABLE email_otps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert to email_otps" ON email_otps;
CREATE POLICY "Allow public insert to email_otps" ON email_otps FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select on email_otps" ON email_otps;
CREATE POLICY "Allow public select on email_otps" ON email_otps FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public update on email_otps" ON email_otps;
CREATE POLICY "Allow public update on email_otps" ON email_otps FOR UPDATE TO anon, authenticated USING (true);
