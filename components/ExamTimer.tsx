/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./ExamTimer.module.css";
import { getSyncTime } from "@/lib/clock";

interface ExamTimerProps {
  startTime: string;
  durationMinutes: number;
  onExpire: () => void;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  // If no hours, just mm:ss
  if (h === 0) return [m, s].map((v) => String(v).padStart(2, "0")).join(":");
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function ExamTimer({ startTime, durationMinutes, onExpire }: ExamTimerProps) {
  const [remaining, setRemaining] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(100);
  const expiredRef = useRef(false);
  // Use a ref for the callback so the timer interval doesn't restart on every render
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const totalMs = durationMinutes * 60 * 1000;
    
    function calcRemaining() {
      const endMs = new Date(startTime).getTime() + totalMs;
      const timeLeft = Math.max(0, endMs - getSyncTime());
      return Math.floor(timeLeft / 1000);
    }

    const initialSecs = calcRemaining();
    setRemaining(initialSecs);
    setPercentage(Math.max(0, Math.min(100, (initialSecs / (durationMinutes * 60)) * 100)));

    const id = setInterval(() => {
      const secs = calcRemaining();
      setRemaining(secs);
      setPercentage(Math.max(0, Math.min(100, (secs / (durationMinutes * 60)) * 100)));
      
      if (secs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(id);
        onExpireRef.current();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [startTime, durationMinutes]);

  // HSL Color logic: 120 is Green, 60 is Yellow, 0 is Red. 
  // We map 100% -> 120 hue, 0% -> 0 hue.
  const currentHue = Math.floor((percentage / 100) * 120);
  const barColor = `hsl(${currentHue}, 85%, 45%)`;
  const isUrgent = remaining <= 300; // 5 minutes

  return (
    <div className={styles.timerWrapper}>
      <div className={styles.timerHeader}>
        <span className={styles.label}>Time Remaining:</span>
        <span className={`${styles.time} ${isUrgent ? styles.urgentText : ""}`}>
          {formatTime(remaining)}
        </span>
      </div>
      <div className={styles.barContainer}>
        {/* Dynamic color fill sliding backwards */}
        <div 
          className={styles.barFill} 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 10px ${barColor.replace("45%)", "45%, 0.5)")}`
          }}
        />
        {/* Mock thumb matching user references */}
        <div className={styles.barThumb} style={{ left: `${percentage}%` }} />
        {/* Optional trailing limit indicators */}
      </div>
    </div>
  );
}
