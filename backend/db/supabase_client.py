from supabase import create_client, Client
from core.config import get_settings

settings = get_settings()

def get_supabase() -> Client:
    """
    Supabase client using the service_role key.
    Created fresh per-request to avoid stale httpx connections 
    on Vercel which cause Cloudflare Worker Exceptions.
    """
    if not settings.supabase_url or not settings.supabase_service_key:
        print("CRITICAL: Supabase environment variables are MISSING!")
        raise ValueError("Supabase configuration is incomplete. Check Vercel environment variables.")
    return create_client(settings.supabase_url, settings.supabase_service_key)
