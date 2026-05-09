import asyncio
import os
import sys

# Add the project root to sys.path so we can import from db
sys.path.append(r"c:\EXAM_new\EXAM\backend")

from db.supabase_client import get_supabase

async def check_violations():
    db = get_supabase()
    try:
        res = db.table("violations").select("*, students(usn, name)").order("timestamp", desc=True).limit(20).execute()
        print("LAST 20 VIOLATIONS:")
        for v in res.data:
            print(f"[{v['timestamp']}] {v['students']['usn']} ({v['students']['name']}) - {v['type']} - Exam: {v.get('exam_name')}")
            
        status_res = db.table("exam_status").select("*, students(usn)").order("updated_at", desc=True).limit(10).execute()
        print("\nLAST 10 EXAM STATUSES:")
        for s in status_res.data:
            print(f"[{s['updated_at']}] {s['students']['usn']} - Exam: {s.get('exam_name')} - Warnings: {s['warnings']} - Status: {s['status']}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_violations())
