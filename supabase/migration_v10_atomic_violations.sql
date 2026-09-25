-- 1. Add exam_name to violations table for better tracking
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='violations' AND column_name='exam_name') THEN
        ALTER TABLE violations ADD COLUMN exam_name TEXT DEFAULT 'Initial Assessment';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION report_student_violation(
    target_student_id UUID,
    target_exam_name TEXT,
    violation_type TEXT,
    violation_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
    new_warning_count INTEGER,
    is_auto_submitted BOOLEAN,
    response_message TEXT
) AS $$
DECLARE
    current_warn INTEGER;
    max_warn INTEGER := 3;
    student_name_val TEXT;
BEGIN
    -- 1. Fetch current warnings or initialize if missing
    SELECT warnings INTO current_warn 
    FROM exam_status 
    WHERE student_id = target_student_id AND LOWER(exam_name) = LOWER(target_exam_name)
    FOR UPDATE; -- Lock the row for this transaction

    IF NOT FOUND THEN
        -- Create the record if it doesn't exist
        INSERT INTO exam_status (student_id, exam_name, status, warnings, started_at)
        VALUES (target_student_id, target_exam_name, 'active', 1, NOW())
        RETURNING warnings INTO current_warn;
    ELSE
        -- Increment warnings
        current_warn := current_warn + 1;
        UPDATE exam_status 
        SET warnings = current_warn,
            last_active = NOW(),
            status = CASE WHEN current_warn >= max_warn THEN 'submitted'::text ELSE status END,
            submitted_at = CASE WHEN current_warn >= max_warn THEN NOW() ELSE submitted_at END
        WHERE student_id = target_student_id AND LOWER(exam_name) = LOWER(target_exam_name);
    END IF;

    -- 2. Log the violation in the violations table
    INSERT INTO violations (student_id, type, metadata, exam_name)
    VALUES (target_student_id, violation_type, violation_metadata, target_exam_name);

    -- 3. Prepare response
    new_warning_count := current_warn;
    is_auto_submitted := (current_warn >= max_warn);
    
    IF current_warn >= max_warn THEN
        response_message := '🚨 CRITICAL: Third violation detected. Your exam has been automatically submitted for review.';
    ELSIF current_warn = 2 THEN
        response_message := '🚨 FINAL WARNING: Second violation detected. One more violation will trigger automatic submission.';
    ELSE
        response_message := '⚠️ WARNING: Anomaly detected. Please maintain full-screen focus to ensure session integrity.';
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
