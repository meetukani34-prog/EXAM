import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("c:/EXAM_new/EXAM/backend/.env")

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

student_id = "4a921577-594d-490b-b253-d64a77fd187c" # Meet
exam_title = "meet"

results_payload = {
    "student_id": student_id,
    "exam_name": exam_title,
    "answers": {"1": "A"},
    "score": 10.0,
    "total_marks": 10.0,
    "correct_count": 1,
    "wrong_count": 0,
    "submitted_at": "2026-05-19T14:20:00+00:00"
}

try:
    print("Testing upsert...")
    res = supabase.table("exam_results").upsert(results_payload, on_conflict="student_id,exam_name").execute()
    print("Upsert succeeded!", res.data)
except Exception as e:
    print("Upsert failed!")
    print(e)
