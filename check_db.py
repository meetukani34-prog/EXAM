import os
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

db = create_client(url, key)
res = db.table("questions").select("id, text, exam_name, faculty_id").execute()
print("Questions:")
for r in res.data:
    print(f"ID: {r.get('id')}, Exam: {r.get('exam_name')}, Faculty: {r.get('faculty_id')}")
