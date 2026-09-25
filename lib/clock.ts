let skew = 0; // clientTime - serverTime
let synced = false;
let syncPromise: Promise<number> | null = null;

export async function syncClock(): Promise<number> {
  if (synced) return skew;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const start = Date.now();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
      // Fetch /api/health directly
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) {
        throw new Error(`Sync failed with status: ${res.status}`);
      }
      const data = await res.json();
      const end = Date.now();
      const rtt = end - start;
      
      // Server time estimated by adjusting for half-RTT
      const serverTime = new Date(data.timestamp).getTime() + Math.round(rtt / 2);
      skew = end - serverTime;
      synced = true;
      console.log(`[ClockSync] Client clock skew calculated: ${skew}ms (rtt: ${rtt}ms)`);
      return skew;
    } catch (error) {
      console.error("[ClockSync] Failed to sync clock:", error);
      return skew;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

export function getSyncTime(): number {
  return Date.now() - skew;
}

export function isSynced(): boolean {
  return synced;
}
