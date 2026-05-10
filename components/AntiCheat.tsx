"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { reportViolation } from "@/lib/api";
import { useFullscreen } from "@/hooks/useFullscreen";
import WarningModal from "./WarningModal";
import FaceMonitor from "./FaceMonitor";

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

  useEffect(() => {
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
      // 1. HARD LOCK: Block if already submitted, if we are ALREADY reporting, or if modal is showing.
      // We use both refs and state for maximum resilience.
      if (isSubmitted || isReporting.current || showModal) {
        console.log(`[ANTICHEAT] Blocking ${type} (Submitted: ${isSubmitted}, Reporting: ${isReporting.current}, Modal: ${showModal})`);
        return;
      }
      
      const now = Date.now();
      // 2. Strict Debounce: 8 seconds between violation events (longer window to allow UI/Network to settle)
      if (now - lastViolationTime.current < 8000) {
        console.log(`[ANTICHEAT] Debouncing ${type}`);
        return;
      }
      
      lastViolationTime.current = now;
      isReporting.current = true;
      setShowModal(true); // Show modal IMMEDIATELY with a loading state or pending message

      try {
        setModalMessage("📡 Synchronizing telemetry...");
        const res = await reportViolation(type, examName, metadata);
        
        // 3. Update state with actual count from backend
        setWarningCount(res.warning_count);
        setModalMessage(res.message);

        if (res.auto_submitted) {
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
          if (next >= 3) onAutoSubmit();
          return next;
        });
      } finally {
        // Unlock after delay
        setTimeout(() => {
          isReporting.current = false;
        }, 2000);
      }
    },
    [isSubmitted, onAutoSubmit, showModal, examName]
  );

  // ── Sync status on focus ─────────────────────────────────
  useEffect(() => {
    const handleFocus = () => {
      if (isSubmitted) return;
      // If we have warnings but no modal is showing, show it!
      if (warningCount > 0 && !showModal) {
        setShowModal(true);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [warningCount, showModal, isSubmitted]);

  // ── Tab visibility ────────────────────────────────────────
  useEffect(() => {
    if (!isStabilized) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && !isSubmitted) {
        triggerViolation("tab_switch");
      }
    };
    const handleBlur = () => {
      if (!isSubmitted) triggerViolation("window_blur");
    };
    const handleFsChange = () => {
      const isFs =
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement;
      if (!isFs && !isSubmitted) {
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
    const handleKey = (e: KeyboardEvent) => {
      if (isSubmitted) return;
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

    const handleCopy = (e: ClipboardEvent) => {
      if (!isSubmitted) e.preventDefault();
    };
    const handlePaste = (e: ClipboardEvent) => {
      if (!isSubmitted) e.preventDefault();
    };

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
      {isStabilized && (
        <FaceMonitor onViolation={triggerViolation} isSubmitted={isSubmitted} />
      )}
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
