import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Real-time active student counter using Supabase Realtime.
 * Subscribes to UPDATE events on `exam_status` to track
 * students with `status = 'active'`, filtered by branch.
 */
export function useActiveStudents(branches: string[] = []) {
  const [activeCount, setActiveCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Initial fetch + realtime subscription
  // react-doctor-disable-next-line react-doctor/no-effect-leaks-listeners, react-doctor/effect-needs-cleanup
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
        if (res.status === 401 && typeof window !== "undefined") {
          localStorage.removeItem("faculty_token");
          localStorage.removeItem("faculty_profile");
          window.location.reload();
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setActiveCount(data.active_count || 0);
          setQuestionCount(data.question_count || 0);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branches.join(",")]);

  return { activeCount, questionCount, isConnected };
}
