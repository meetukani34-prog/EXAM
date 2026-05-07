import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(".env.local")
url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

try:
    res = supabase.table("students").select("*").limit(1).execute()
    print("Columns:", res.data[0].keys() if res.data else "No data")
except Exception as e:
    print("Error:", e)
