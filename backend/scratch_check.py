import asyncio
import os
import sys

# Add the project root to sys.path so we can import from db
sys.path.append(r"c:\EXAM_new\EXAM\backend")

from db.supabase_client import get_supabase

async def check_columns():
    db = get_supabase()
    try:
        # Probe for columns in exam_results
        res = db.table("exam_results").select("*").limit(1).execute()
        if res.data:
            print("COLUMNS IN exam_results:")
            print(list(res.data[0].keys()))
        else:
            print("Table exam_results is empty.")
            
        # Probe for columns in questions
        res_q = db.table("questions").select("*").limit(1).execute()
        if res_q.data:
            print("COLUMNS IN questions:")
            print(list(res_q.data[0].keys()))
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_columns())
