import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface LiveAlert {
  id: string;
  student_id: string;
  student_usn?: string;
  student_name?: string;
  exam_name?: string;
  branch?: string;
  alert_type: string;
  message?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Zero-polling Supabase Realtime hook for live violation alerts.
 * Subscribes to INSERT events on the `live_alerts` table.
 * Alerts auto-dismiss after `dismissAfterMs` (default: 10s).
 */
export function useRealtimeAlerts(
  branches: string[] = [],
  dismissAfterMs: number = 10000
) {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // react-doctor-disable-next-line react-doctor/no-effect-leaks-listeners, react-doctor/effect-needs-cleanup
  useEffect(() => {
    const channel = supabase
      .channel("live_alerts_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_alerts",
        },
        (payload) => {
          const newAlert = payload.new as LiveAlert;

          // Filter by faculty's branches (if specified)
          if (
            branches.length > 0 &&
            !branches.includes("ALL") &&
            newAlert.branch &&
            !branches.includes(newAlert.branch)
          ) {
            return; // Skip alerts from other branches
          }

          setAlerts((prev) => [newAlert, ...prev].slice(0, 50));

          // Auto-dismiss after timeout
          if (dismissAfterMs > 0) {
            setTimeout(() => {
              dismissAlert(newAlert.id);
            }, dismissAfterMs);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branches.join(","), dismissAfterMs]);

  return { alerts, isConnected, dismissAlert };
}
