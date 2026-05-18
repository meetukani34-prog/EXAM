import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Real-time active student counter using Supabase Realtime.
 * Subscribes to UPDATE events on `exam_status` to track
 * students with `status = 'active'`, filtered by branch.
 */
export function useActiveStudents(branches: string[] = []) {
  const [activeCount, setActiveCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial fetch + realtime subscription
  useEffect(() => {
    // Initial count fetch
    async function fetchInitialCount() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "/api"}/faculty/live-monitor`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("faculty_token") || ""}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setActiveCount(data.active_count || 0);
        }
      } catch (e) {
        console.warn("[useActiveStudents] Initial fetch failed:", e);
      }
    }

    fetchInitialCount();

    // Realtime subscription for live updates
    const channel = supabase
      .channel("exam_status_active_counter")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exam_status",
        },
        () => {
          // Re-fetch count on any exam_status change
          fetchInitialCount();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [branches.join(",")]);

  return { activeCount, isConnected };
}
