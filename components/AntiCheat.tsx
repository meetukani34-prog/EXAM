"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { reportViolation } from "@/lib/api";
import { useFullscreen } from "@/hooks/useFullscreen";
import WarningModal from "./WarningModal";
import { withRetry } from "@/lib/apiUtils";
import { supabase } from "@/lib/supabase";
// import FaceMonitor from "./FaceMonitor";

interface AntiCheatProps {
  isSubmitted: boolean;
  examName: string;
  onAutoSubmit: () => void;
}

export default function AntiCheat({ isSubmitted, examName, onAutoSubmit }: AntiCheatProps) {
  const [warningCount, setWarningCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const { enter: enterFullscreen } = useFullscreen();

  const [isStabilized, setIsStabilized] = useState(false);
  const isReporting = useRef(false);
  const lastViolationTime = useRef(0);
  // Track if auto-submit has been triggered to prevent multiple calls
  const hasAutoSubmitted = useRef(false);

  useEffect(() => {
    // ── Fetch Initial State ──
    async function syncViolationState() {
      const raw = localStorage.getItem("exam_student");
      if (!raw) return;
      const studentInfo = JSON.parse(raw);
      const studentId = studentInfo.id || studentInfo.student_id;
      if (!studentId) return;

      try {
        await withRetry(async () => {
          const { data, error } = await supabase
            .from('exam_status')
            .select('warnings, exam_name')
            .eq('student_id', studentId);
          
          if (error) throw error;
          
          const record = (data || []).find(r => 
            (r.exam_name || "").trim().toLowerCase() === examName.toLowerCase()
          );
          
          if (record) setWarningCount(record.warnings || 0);
        });
      } catch (err) {
        console.warn("[ANTICHEAT] Failed to sync initial warnings after retries:", err);
      }
    }
    syncViolationState();

    // ── Fidelity Stabilization ──
    // Delay monitoring for 3s after mount to ensure backend state settled
    const stabilizationTimer = setTimeout(() => {
      setIsStabilized(true);
      console.log("[ANTICHEAT] Stabilization complete. Monitoring active.");
    }, 3000);

    return () => clearTimeout(stabilizationTimer);
  }, []);

  const triggerViolation = useCallback(
    async (type: string, metadata?: Record<string, unknown>) => {
      // HARD LOCK: Block if submitted, already reporting, already auto-submitted, or modal showing
      if (isSubmitted || isReporting.current || hasAutoSubmitted.current) {
        console.log(`[ANTICHEAT] Blocking ${type} — already handled.`);
        return;
      }

      const now = Date.now();
      // Reduced debounce from 8s to 3s to be more sensitive to rapid distinct violations (like Esc)
      if (now - lastViolationTime.current < 3000) {
        console.log(`[AntiCheat] Ignoring duplicate violation '${type}' (debounced)`);
        return;
      }

      lastViolationTime.current = now;
      isReporting.current = true;
      setShowModal(true);

      try {
        setModalMessage("📡 Synchronizing telemetry...");
        const res = await withRetry(() => reportViolation(type, examName, metadata));

        // Update state with actual count from backend
        const count = res.warning_count ?? 1;
        setWarningCount(count);
        setModalMessage(res.message);

        if (res.auto_submitted && !hasAutoSubmitted.current) {
          hasAutoSubmitted.current = true;
          onAutoSubmit();
        }
      } catch (err) {
        console.error("[ANTICHEAT] Sync failed:", err);
        setWarningCount((prev) => {
          const next = prev + 1;
          setModalMessage(
            next >= 3
              ? "⚠️ Exam auto-submitted due to repeated violations."
              : next === 2
              ? "🚨 Final warning! One more violation will submit your exam."
              : "⚠️ Warning: Please stay on the exam tab."
          );
          if (next >= 3 && !hasAutoSubmitted.current) {
            hasAutoSubmitted.current = true;
            onAutoSubmit();
          }
          return next;
        });
      } finally {
        // Unlock after delay
        setTimeout(() => {
          isReporting.current = false;
        }, 2000);
      }
    },
    [isSubmitted, onAutoSubmit, examName]
  );

  // ── Tab visibility & blur (consolidated) ─────────────────
  useEffect(() => {
    if (!isStabilized || isSubmitted) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        triggerViolation("tab_switch");
      }
    };
    const handleBlur = () => {
      // Trigger violation on ANY window blur to catch screenshot tools and overlays
      triggerViolation("window_blur");
    };
    const handleFsChange = () => {
      const isFs =
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement ||
        !!(document as any).mozFullScreenElement ||
        !!(document as any).msFullscreenElement;
      
      if (!isFs && !isSubmitted) {
        triggerViolation("fullscreen_exit");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("mozfullscreenchange", handleFsChange);
    document.addEventListener("MSFullscreenChange", handleFsChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("mozfullscreenchange", handleFsChange);
      document.removeEventListener("MSFullscreenChange", handleFsChange);
    };
  }, [triggerViolation, isSubmitted, isStabilized]);

  // ── Right-click disable ───────────────────────────────────
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  // ── Copy / Paste / Select All / DevTools shortcuts ────────
  useEffect(() => {
    if (isSubmitted) return;

    const handleKey = (e: KeyboardEvent) => {
      // Specific check for Escape to catch fullscreen exits immediately
      if (e.key === "Escape") {
        const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement);
        if (isFs) {
          triggerViolation("keyboard_shortcut");
        }
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const blocked = ["c", "v", "a", "u", "s", "p"];
      if (ctrl && blocked.includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (e.key.toLowerCase() === "c") triggerViolation("copy_attempt");
        else if (e.key.toLowerCase() === "v") triggerViolation("paste_attempt");
        else triggerViolation("keyboard_shortcut");
      }
      // F12 DevTools
      if (e.key === "F12") {
        e.preventDefault();
        triggerViolation("keyboard_shortcut");
      }
      // PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        triggerViolation("keyboard_shortcut");
      }
    };

    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handlePaste = (e: ClipboardEvent) => e.preventDefault();

    document.addEventListener("keydown", handleKey);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
    };
  }, [isSubmitted, triggerViolation]);

  return (
    <>
      {/* {isStabilized && (
        <FaceMonitor onViolation={triggerViolation} isSubmitted={isSubmitted} />
      )} */}
      {showModal && (
        <WarningModal
          warningCount={warningCount}
          message={modalMessage}
          onDismiss={warningCount < 3 ? () => setShowModal(false) : undefined}
          onReenterFullscreen={() => enterFullscreen()}
        />
      )}
    </>
  );
}
