-- Create support_requests table for storing help tickets from students
CREATE TABLE IF NOT EXISTS support_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usn TEXT NOT NULL,
    problem TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, resolved, closed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert (since they might not be logged in yet when they click help)
CREATE POLICY "Allow anonymous insert support_requests" 
ON support_requests FOR INSERT 
WITH CHECK (true);

-- Allow authenticated admins to view/update all requests
CREATE POLICY "Allow admins full access to support_requests"
ON support_requests FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
