/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./leaderboard.module.css";
import Skeleton from "@/components/Skeleton";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || "admin@examguard2024";

interface LeaderboardEntry {
  rank: number;
  student_id: string;
  usn: string;
  name: string;
  branch: string;
  score: number;
  total_marks: number;
  percentage: number;
  time_taken_seconds: number | null;
  submitted_at: string | null;
  exam_name: string;
}

function formatTime(secs: number | null): string {
  if (secs === null) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function pctColor(pct: number): string {
  if (pct >= 80) return "#34d399";
  if (pct >= 60) return "#fbbf24";
  if (pct >= 40) return "#fb923c";
  return "#f87171";
}

const CROWNS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [selectedExam, setSelectedExam] = useState<string>("ALL");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const prevRanks = useRef<Map<string, number>>(new Map());

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/leaderboard/admin`, {
        headers: { "x-admin-secret": ADMIN_SECRET },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      // Track rank deltas
      const newMap = new Map<string, number>();
      (data.entries as LeaderboardEntry[]).forEach((e) => newMap.set(e.student_id, e.rank));
      prevRanks.current = newMap;
      setEntries(data.entries);
      setUpdatedAt(data.updated_at);
    } catch {
      // swallow network errors silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();

    // Subscribe to Supabase realtime for live updates
    const channel = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_results" }, fetchLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_status" }, fetchLeaderboard)
      .subscribe();

    const interval = setInterval(fetchLeaderboard, 10_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchLeaderboard]);

  // Derive unique exams and branches for filters
  const exams = Array.from(new Set(entries.map(e => (e as any).exam_name))).filter(Boolean).sort();
  const branches = Array.from(new Set(entries.map(e => e.branch))).filter(Boolean).sort();

  // Filter and RE-RANK
  const filteredEntries = entries
    .filter(e => (selectedExam === "ALL" || e.exam_name === selectedExam))
    .filter(e => (selectedBranch === "ALL" || e.branch === selectedBranch))
    .map((e, index) => ({ ...e, rank: index + 1 }));

  const top3 = filteredEntries.slice(0, 3);
  const rest = filteredEntries.slice(3);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ flex: 1 }}>
          <div className={styles.title}>
            ⚡ Quantum Leaderboard
          </div>
          <div className={styles.subtitle}>
            Ranked by Accuracy × Velocity · {filteredEntries.length} matches
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select 
            className={styles.filterSelect}
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
          >
            <option value="ALL">All Quizzes</option>
            {exams.map(ex => <option key={ex as string} value={ex as string}>{ex as string}</option>)}
          </select>

          <select 
            className={styles.filterSelect}
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="ALL">All Branches</option>
            {branches.map(br => <option key={br} value={br}>{br}</option>)}
          </select>

          <div className={styles.liveIndicator}>
            <div className={styles.liveDot} />
            LIVE
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
          <Skeleton height={200} borderRadius={24} />
          <Skeleton height={80} borderRadius={16} />
          <Skeleton height={80} borderRadius={16} />
          <Skeleton height={80} borderRadius={16} />
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🌌</div>
          <p>No submissions yet. The leaderboard will crystallize as students complete their exam.</p>
        </div>
      ) : (
        <>
          {/* ── Podium (top 3) ── */}
          {top3.length > 0 && (
            <div className={styles.podium}>
              {top3.map((entry, i) => (
                <div
                  key={`${entry.student_id}-${entry.exam_name}`}
                  className={`${styles.podiumCard} ${styles[`rank${i + 1}` as "rank1" | "rank2" | "rank3"]}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={styles.podiumRank}>{entry.rank}</div>
                  <div className={styles.podiumCrown}>{CROWNS[i]}</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 4 }}>
                    <div className={styles.podiumBranch}>{entry.branch}</div>
                    <div className={styles.podiumBranch} style={{ background: 'rgba(0,242,255,0.1)', color: '#00f2ff' }}>{entry.exam_name}</div>
                  </div>
                  <div className={styles.podiumName}>{entry.name}</div>
                  <div className={styles.podiumUsn}>{entry.usn}</div>
                  <div className={styles.podiumScore}>{entry.percentage.toFixed(1)}%</div>
                  <div className={styles.podiumMeta}>
                    {entry.score}/{entry.total_marks} marks · {formatTime(entry.time_taken_seconds)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Full list ── */}
          {rest.length > 0 && (
            <div className={styles.rankList}>
              {rest.map((entry, i) => (
                <div
                  key={`${entry.student_id}-${entry.exam_name}`}
                  className={styles.rankCard}
                  style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                >
                  <div className={styles.rankNum}>{entry.rank}</div>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankName}>{entry.name}</div>
                    <div className={styles.rankMeta}>
                      <span className="mono" style={{ fontSize: 11 }}>{entry.usn}</span>
                      <span className="badge badge-neutral" style={{ fontSize: 10, padding: "2px 6px" }}>{entry.branch}</span>
                      <span className="badge" style={{ fontSize: 10, padding: "2px 6px", background: 'rgba(0,242,255,0.05)', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.1)' }}>{entry.exam_name}</span>
                      <span>⏱ {formatTime(entry.time_taken_seconds)}</span>
                    </div>
                  </div>
                  <div className={styles.rankScore}>
                    <div
                      className={styles.rankPct}
                      style={{ color: pctColor(entry.percentage) }}
                    >
                      {entry.percentage.toFixed(1)}%
                    </div>
                    <div className={styles.rankTime}>
                      {entry.score}/{entry.total_marks} marks
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
