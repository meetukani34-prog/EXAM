"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { reportViolation } from "@/lib/api";
import { useFullscreen } from "@/hooks/useFullscreen";
import WarningModal from "./WarningModal";
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
      try {
        const { data } = await supabase
          .from('exam_status')
          .select('warnings')
          .eq('student_id', (JSON.parse(localStorage.getItem("exam_student") || "{}")).id)
          .single();
        if (data) setWarningCount(data.warnings || 0);
      } catch (err) {
        console.warn("[ANTICHEAT] Failed to sync initial warnings:", err);
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
      // Strict Debounce: 8 seconds between violation events
      if (now - lastViolationTime.current < 8000) {
        console.log(`[ANTICHEAT] Debouncing ${type}`);
        return;
      }

      lastViolationTime.current = now;
      isReporting.current = true;
      setShowModal(true);

      try {
        setModalMessage("📡 Synchronizing telemetry...");
        const res = await reportViolation(type, examName, metadata);

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
      // Only count blur if page is still visible (prevents double-counting with tab_switch)
      if (document.visibilityState === "visible") {
        triggerViolation("window_blur");
      }
    };
    const handleFsChange = () => {
      const isFs =
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement;
      if (!isFs) {
        triggerViolation("fullscreen_exit");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
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
