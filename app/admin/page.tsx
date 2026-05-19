/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
"use client";
// Trigger commit for Vercel deployment refresh

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  fetchPublicExamConfig,
  fetchAdminQuestions,
  createAdminQuestion,
  updateAdminQuestion,
  deleteAdminQuestion,
  fetchAdminStudents,
  createAdminStudent,
  updateAdminStudent,
  deleteAdminStudent,
  deleteAllAdminStudents,
  resetAdminStudent,
  blockAdminStudent,
  unblockAdminStudent,
  exportResults,
  deleteAdminFolder,
  renameAdminFolder,
  editAdminFolderBranch,
  uploadQuestionImage,
  fetchBranchExamSummary,
  AdminQuestion,
  AdminStudent,
  BranchExamSummary,
  forceSubmitAdminStudent,
  cleanupStaleSessions,
  fetchSupportRequests,
  updateSupportRequestStatus,
  fetchViolationHistory,
  ViolationHistory,
  SupportRequest,
  ExamConfig,
  updateExamConfig,
  fetchAllExamConfigs,
  fetchPyHuntConfig,
  updatePyHuntConfig,
  resetOdysseyProgress,
  fetchPublicPyHuntConfig,
  GlobalConfigEntry,
} from "@/lib/api";
import { BRANCHES as BRANCH_LIST, BRANCH_IDS } from "@/lib/constants";
import styles from "./admin.module.css";
import adminStyles from "./admin-management.module.css";
import Skeleton from "@/components/Skeleton";

import LeaderboardPage from "./leaderboard/page";
import IngestPage from "./ingest/page";
import OrbitalControl from "./control/page";
import StudentExplorer from "@/components/admin/StudentExplorer";
import FacultyTab from "@/components/admin/FacultyTab";
import CodingInterface from "@/components/CodingInterface";
import { validateOutput } from "@/lib/logicUtils";
import { usePyodide } from "@/hooks/usePyodide";
import { useWasmCompiler } from "@/hooks/useWasmCompiler";

// ── Types ─────────────────────────────────────────────────────
// Use AdminStudent from lib/api

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function getElapsedTime(started: string | null, ended: string | null): string {
  if (!started) return "—";
  const t0 = new Date(started).getTime();
  const t1 = ended ? new Date(ended).getTime() : Date.now();
  const secs = Math.floor(Math.max(0, t1 - t0) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function isStale(lastActive: string | null): boolean {
  if (!lastActive) return true;
  return (Date.now() - new Date(lastActive).getTime()) > 10 * 60 * 1000; // 10 mins
}

const BRANCHES = BRANCH_IDS;
const ALL_BRANCH_DATA = BRANCH_LIST;
type Tab = "monitor" | "questions" | "students" | "leaderboard" | "ingest" | "control" | "support" | "pyhunt" | "explorer" | "faculty";
const ADMIN_AUTH_KEY = "examguard_admin_auth";

function getStoredAuth(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(ADMIN_AUTH_KEY) === "true"; } catch { return false; }
}

const ControlBtn = ({ label, icon, color, onClick, variant = "ghost" }: any) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontSize: "12px",
      fontWeight: 700,
      padding: "5px 12px",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "opacity 0.2s, transform 0.2s, background 0.2s",
      background: variant === "solid" ? color : `var(--bg-secondary)`,
      color: variant === "solid" ? "#fff" : color,
      border: `1px solid ${variant === "solid" ? color : "var(--border)"}`,
      textTransform: "uppercase",
      letterSpacing: "0.02em"
    }}
  >
    <span>{icon}</span> {label}
  </button>
);

// ── PyHunt Observer Component ──────────────────────────────────
// ── PyHunt Observer Component ──────────────────────────────────
function PyHuntObserver({ fetchStudentsGlobal }: { fetchStudentsGlobal: (examName?: string) => void }) {
  const [activeTab, setActiveTab] = useState('live_status');
  const [localStudents, setLocalStudents] = useState<AdminStudent[]>([]);
  const [odysseyData, setOdysseyData] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const activeTabRef = useRef(activeTab);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const fetchPyHuntStudents = useCallback(async () => {
    try {
      const data = await fetchAdminStudents("PyHunt");
      setLocalStudents(data || []);
    } catch (err) {
      console.error("Failed to fetch PyHunt students", err);
    }
  }, []);

  const fetchOdyssey = useCallback(async () => {
    setLoading(true);
    const { data, error, status } = await supabase
      .from('odyssey_progress')
      .select('*')
      .order('last_ping', { ascending: false });

    // Fetch last violations for each student via backend API
    const violData = await fetchViolationHistory();

    if (error && status === 404) {
      setTableMissing(true);
    } else {
      setTableMissing(false);
    }

    setOdysseyData(data || []);
    setViolations(violData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOdyssey();
    fetchPyHuntStudents();

    let timerId: any = null;

    const sub = supabase.channel('odyssey_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'odyssey_progress' }, () => {
      if (activeTabRef.current !== 'live_status') return;

      const now = Date.now();
      if (now - lastSyncRef.current < 5000) return; // 5s throttle for better live feel

      const jitter = Math.random() * 2000 + 500; // 0.5 - 2.5s jitter
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        if (activeTabRef.current === 'live_status') {
          fetchOdyssey();
          fetchPyHuntStudents();
          lastSyncRef.current = Date.now();
        }
      }, jitter);
    }).subscribe();

    return () => {
      supabase.removeChannel(sub);
      if (timerId) clearTimeout(timerId);
    };
  }, [fetchOdyssey, fetchPyHuntStudents]);

  const handleForceUnlock = async (studentId: string, nextRound: number) => {
    await supabase.rpc('force_unlock_round', { target_student_id: studentId, next_round: nextRound });
    fetchOdyssey();
  };

  const handleReExam = async (s: AdminStudent) => {
    if (!confirm(`Reset exam for ${s.name}? This will clear all progress and rounds.`)) return;
    try {
      await resetAdminStudent(s.student_id);
      await resetOdysseyProgress(s.student_id);

      fetchStudentsGlobal();
      fetchOdyssey();
      fetchPyHuntStudents();
    } catch (err: any) { alert("Failed to reset: " + err.message); }
  };

  const handleToggleBlock = async (s: AdminStudent) => {
    const action = s.is_blocked ? "unblock" : "block";
    if (!confirm(`Are you sure you want to ${action} ${s.name}?`)) return;
    try {
      if (s.is_blocked) await unblockAdminStudent(s.student_id);
      else await blockAdminStudent(s.student_id);
      fetchStudentsGlobal();
      fetchPyHuntStudents();
    } catch (err: any) { alert(`Failed to ${action}: ` + err.message); }
  };

  const handleDeleteStudent = async (s: AdminStudent) => {
    if (!confirm(`Are you sure you want to remove ${s.name} from PyHunt? This will clear their PyHunt progress but keep their student account intact.`)) return;
    try {
      // 1. Clear odyssey progress
      await supabase.from('odyssey_progress').delete().eq('student_id', s.student_id);

      // 2. Clear exam status for PyHunt (Case-insensitive robust delete)
      await supabase.from('exam_status').delete().eq('student_id', s.student_id).ilike('exam_name', 'pyhunt');

      // 3. Clear exam results for PyHunt
      await supabase.from('exam_results').delete().eq('student_id', s.student_id).ilike('exam_name', 'pyhunt');

      fetchStudentsGlobal();
      fetchOdyssey();
      fetchPyHuntStudents();
    } catch (err: any) { alert("Failed to remove from PyHunt: " + err.message); }
  };

  // ── PyHunt Configuration State ──
  const [configs, setConfigs] = useState<any[]>([
    { round: 1, name: "MCQ", clue: "Locate the physical node to find your code.", code: "LIBRARY42", description: "Validate the initial logic chain via multi-vector analysis." },
    { round: 2, name: "Jumble", clue: "Order matters in logic.", code: "LAB2CO", description: "Arrange the corrupted code blocks into a functional sequence." },
    { round: 3, name: "Palindrome", clue: "The mirror speaks the truth.", code: "HEX33", description: "Implement a recursion-stable symmetry check." },
    { round: 4, name: "FizzBuzz", clue: "Numbers dance in patterns.", code: "F1ZZ", description: "Execute a multi-stage FizzBuzz data filter." },
  ]);
  const [mcqs, setMcqs] = useState<any[]>([
    { id: 1, question: "What is the output of print(2**3)?", options: ["6", "8", "9", "5"], answer: 1 },
  ]);
  const [jumbles, setJumbles] = useState<any[]>([
    { id: 1, blocks: ["def hello():", "  print('world')", "hello()"], target: "def hello():\n  print('world')\nhello()" },
  ]);
  const [codingChallenges, setCodingChallenges] = useState<any>({
    3: [{ id: 1, prompt: "", imageUrl: "", target_output: "", test_cases: "[]" }],
    4: [{ id: 2, prompt: "", imageUrl: "", target_output: "", test_cases: "[]" }]
  });
  const [globalAuth, setGlobalAuth] = useState<any>({ startCode: "PYHUNT67", authorizedUsns: "" });
  const [labelConfig, setLabelConfig] = useState<any>({ phase: "Phase", orbit: "Orbit" });

  const fetchAllConfigs = useCallback(async () => {
    try {
      const data = await fetchPyHuntConfig();
      if (data) {
        const rounds = data.find((c: any) => c.config_key === 'rounds_config')?.config_value;
        if (rounds) setConfigs(rounds);
        const m = data.find((c: any) => c.config_key === 'mcqs')?.config_value;
        if (m) setMcqs(m);
        const a = data.find((c: any) => c.config_key === 'auth')?.config_value;
        if (a) setGlobalAuth(a);
        const j = data.find((c: any) => c.config_key === 'jumbles')?.config_value;
        if (j) setJumbles(j);
        const l = data.find((c: any) => c.config_key === 'labels')?.config_value;
        if (l) setLabelConfig(l || { phase: "Phase", orbit: "Orbit" });
        const cc = data.find((c: any) => c.config_key === 'coding_challenges')?.config_value;
        if (cc) setCodingChallenges(cc);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  }, []);

  useEffect(() => {
    fetchAllConfigs();
  }, [fetchAllConfigs]);

  const updateConfig = async (round: number, field: string, val: string) => {
    const updated = configs.map((c: any) => c.round === round ? { ...c, [field]: val } : c);
    setConfigs(updated);
    try {
      await updatePyHuntConfig('rounds_config', updated);
    } catch (err: any) {
      alert("Failed to save config: " + err.message);
    }
  };
  const updateMcq = async (id: number, field: string, val: any) => {
    const updated = mcqs.map((q: any) => q.id === id ? { ...q, [field]: val } : q);
    setMcqs(updated);
    try {
      await updatePyHuntConfig('mcqs', updated);
    } catch (err: any) {
      alert("Failed to save MCQ: " + err.message);
    }
  };
  const addMcq = async () => {
    const updated = [...mcqs, { id: Date.now(), question: "", options: ["", "", "", ""], answer: 0 }];
    setMcqs(updated);
    await updatePyHuntConfig('mcqs', updated);
  };
  const removeMcq = async (id: number) => {
    const updated = mcqs.filter((q: any) => q.id !== id);
    setMcqs(updated);
    await updatePyHuntConfig('mcqs', updated);
  };
  const addJumble = async () => {
    const updated = [...jumbles, { id: Date.now(), blocks: [], target: "" }];
    setJumbles(updated);
    await updatePyHuntConfig('jumbles', updated);
  };
  const removeJumble = async (id: number) => {
    const updated = jumbles.filter((j: any) => j.id !== id);
    setJumbles(updated);
    await updatePyHuntConfig('jumbles', updated);
  };
  const saveGlobalAuth = async (newAuth: any) => {
    setGlobalAuth(newAuth);
    try {
      await updatePyHuntConfig('auth', newAuth);
    } catch (err: any) {
      alert("Failed to save Auth: " + err.message);
    }
  };
  const saveJumbles = async (newJumbles: any) => {
    setJumbles(newJumbles);
    try {
      await updatePyHuntConfig('jumbles', newJumbles);
    } catch (err: any) {
      alert("Failed to save Jumble: " + err.message);
    }
  };
  const updateCodingChallenge = async (round: number, id: number, field: string, val: any) => {
    const updated = {
      ...codingChallenges,
      [round]: codingChallenges[round].map((c: any) => c.id === id ? { ...c, [field]: val } : c)
    };
    setCodingChallenges(updated);
    await updatePyHuntConfig('coding_challenges', updated);
  };
  const addCodingChallenge = async (round: number) => {
    const updated = {
      ...codingChallenges,
      [round]: [...(codingChallenges[round] || []), { id: Date.now(), prompt: "", imageUrl: "", target_output: "", test_cases: "[]" }]
    };
    setCodingChallenges(updated);
    await updatePyHuntConfig('coding_challenges', updated);
  };
  const removeCodingChallenge = async (round: number, id: number) => {
    const updated = {
      ...codingChallenges,
      [round]: codingChallenges[round].filter((c: any) => c.id !== id)
    };
    setCodingChallenges(updated);
    await updatePyHuntConfig('coding_challenges', updated);
  };
  const saveLabelConfig = async (newLabels: any) => {
    setLabelConfig(newLabels);
    try {
      await updatePyHuntConfig('labels', newLabels);
    } catch (err: any) {
      alert("Failed to save Labels: " + err.message);
    }
  };

  const participants = localStudents
    .map(s => {
      const progress = odysseyData.find(p => p.student_id === s.student_id);
      const lastViol = violations.find(v => v.student_id === s.student_id);
      return {
        ...s,
        pyhunt: progress || null,
        last_violation_record: lastViol || null
      };
    })
    .filter(p => p.pyhunt !== null || p.status !== 'not_started')
    .sort((a, b) => (b.pyhunt?.current_round || 0) - (a.pyhunt?.current_round || 0));

  const TABS = [
    { id: "clues", label: "🔑 Clues & Codes" },
    { id: "mcq", label: "📄 MCQ Questions" },
    { id: "jumble", label: "🧩 Code Jumble" },
    { id: "r3", label: "🐍 Round 3 Code" },
    { id: "r4", label: "🔢 Round 4 Code" },
    { id: "live_status", label: "🏃 Live Status" },
  ];

  return (
    <div className={adminStyles.pyhuntShell}>
      <header style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--accent)' }}>🐍</span> PyHunt Configuration
          </h2>
          <p style={{ opacity: 0.6, fontSize: 14, marginTop: 8 }}>
            Changes are saved to the global database and immediately visible to all students in real-time.
          </p>
        </div>
        <button
          className={adminStyles.saveAllBtn}
          onClick={async () => {
            const btn = document.activeElement as HTMLButtonElement;
            const originalText = btn.innerText;
            btn.innerText = "🔄 SYNCING...";
            btn.disabled = true;

            try {
              // Re-sync all current local states via backend API
              await Promise.all([
                updatePyHuntConfig('rounds_config', configs),
                updatePyHuntConfig('mcqs', mcqs),
                updatePyHuntConfig('auth', globalAuth),
                updatePyHuntConfig('jumbles', jumbles),
                updatePyHuntConfig('labels', labelConfig),
                updatePyHuntConfig('coding_challenges', codingChallenges)
              ]);

              btn.innerText = "✅ SYNCHRONIZED";
            } catch (err: any) {
              console.error("Sync failed:", err);
              btn.innerText = "❌ FAILED";
              alert("Synchronization failed: " + (err.message || "Unknown error"));
            }

            setTimeout(() => {
              btn.innerText = originalText;
              btn.disabled = false;
            }, 2000);
          }}
        >
          💾 Save All Changes
        </button>
      </header>

      <div className={adminStyles.configTabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${adminStyles.configTab} ${activeTab === t.id ? adminStyles.configTabActive : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'live_status' ? (
        <div className={adminStyles.liveStatusCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              🏃 REAL-TIME STUDENT PROGRESS
            </h3>
            <button className={adminStyles.refreshBtn} onClick={() => { fetchOdyssey(); fetchPyHuntStudents(); }} disabled={loading}>
              🔄 {loading ? "Syncing…" : "Refresh"}
            </button>
          </div>

          {/* Entropy Dashboard Widget */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
            <div style={{ padding: 16, background: 'rgba(0, 242, 255, 0.05)', borderRadius: 12, border: '1px solid rgba(0, 242, 255, 0.1)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 4 }}>TOTAL GUIDANCE BEACONS</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>
                {odysseyData.reduce((acc, curr) => acc + (curr.hints_taken || 0), 0)}
              </div>
            </div>
            <div style={{ padding: 16, background: 'rgba(0, 242, 255, 0.05)', borderRadius: 12, border: '1px solid rgba(0, 242, 255, 0.1)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 4 }}>COGNITIVE ENTROPY (AVG)</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>
                {odysseyData.length > 0 ? (odysseyData.reduce((acc, curr) => acc + (curr.hints_taken || 0), 0) / odysseyData.length).toFixed(2) : "0.00"}
              </div>
            </div>
            <div style={{ padding: 16, background: 'rgba(0, 242, 255, 0.05)', borderRadius: 12, border: '1px solid rgba(0, 242, 255, 0.1)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 4 }}>FRICTION SENSOR</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>
                {(odysseyData.reduce((acc, curr) => acc + (curr.hints_taken || 0), 0) / odysseyData.length) > 0.5 ? "⚠️ HIGH FRICTION" : "✅ STABLE"}
              </div>
            </div>
          </div>


          <div className={adminStyles.tableWrapper}>
            <table className={adminStyles.pyhuntTable}>
              <thead>
                <tr>
                  <th>STUDENT NAME</th>
                  <th>{labelConfig.orbit.toUpperCase()} / {labelConfig.phase.toUpperCase()}</th>
                  <th>ROUND STATUS</th>
                  <th>WARNINGS</th>
                  <th>TOTAL TIME</th>
                  <th>MARKS</th>
                  <th>HINTS</th>
                  <th>PROGRESS</th>
                  <th>STATUS</th>

                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {participants.map(p => {
                  const isCompleted = p.pyhunt?.is_completed === true || p.status === 'submitted';
                  const currentRound = p.pyhunt?.current_round || 1;

                  // Calculate total time
                  let totalTime = "—";
                  if (p.started_at) {
                    const start = new Date(p.started_at).getTime();
                    const end = p.submitted_at ? new Date(p.submitted_at).getTime() : Date.now();
                    const diffMs = end - start;
                    const mins = Math.floor(diffMs / 60000);
                    const secs = Math.floor((diffMs % 60000) / 1000);
                    totalTime = `${mins}m ${secs}s`;
                  }

                  // Points (Show Round 1 MCQ marks if available)
                  let points = "—";
                  let r1State = p.pyhunt?.round_1_state || p.round_1_state;
                  if (typeof r1State === 'string') {
                    try { r1State = JSON.parse(r1State); } catch (e) { }
                  }

                  if (r1State && typeof r1State === 'object' && r1State.mcq_score !== undefined) {
                    points = `${r1State.mcq_score}/${r1State.mcq_total || 0}`;
                  } else if (p.score !== undefined && p.score !== null) {
                    points = `${p.score}/${p.total_marks || 100}`;
                  }

                  return (
                    <tr key={p.student_id} className={isCompleted ? adminStyles.rowFinished : ""}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.5 }}>{p.usn}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={adminStyles.roundBadge}>{isCompleted ? "✓" : currentRound}</span>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            {isCompleted ? "ALL COMPLETE" : (configs.find((c: any) => c.round === currentRound)?.name || "Entry")}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${adminStyles.statusTag} ${isCompleted ? adminStyles.tagSuccess : adminStyles.tagWarning}`}>
                          {isCompleted ? "COMPLETED" : "IN PROGRESS"}
                        </span>
                      </td>
                      <td>
                        <span className={adminStyles.warningCount}>{p.warnings}/3</span>
                      </td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>
                        {totalTime}
                      </td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: isCompleted ? 'var(--success, #22c55e)' : 'var(--text-muted)' }}>
                        {points}
                      </td>
                      <td>
                        <span className={adminStyles.warningCount} style={{ background: (p.pyhunt?.hints_taken || 0) > 0 ? 'rgba(0, 242, 255, 0.1)' : 'rgba(255,255,255,0.05)', color: (p.pyhunt?.hints_taken || 0) > 0 ? 'var(--accent)' : 'inherit' }}>
                          {p.pyhunt?.hints_taken || 0}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {(() => {
                          if (isCompleted) return "100%";
                          if (currentRound === 1 && r1State) {
                            return `Q${(r1State.current_index || 0) + 1} (${r1State.answered_count || 0}/${r1State.mcq_total || 0})`;
                          }
                          return `Orbit ${currentRound}`;
                        })()}
                      </td>

                      <td>
                        <span className={`${adminStyles.liveStatus} ${isCompleted ? adminStyles.statusFinished : (p.status === 'active' ? adminStyles.statusActive : adminStyles.statusPending)}`}>
                          {isCompleted ? "FINISHED" : (p.is_blocked ? "STOPPED" : (p.status === 'not_started' ? "NOT STARTED" : "ACTIVE"))}
                        </span>
                      </td>
                      <td>
                        <div className={adminStyles.actionGroup}>
                          <button className={`${adminStyles.actionBtn} ${adminStyles.btnReset}`} onClick={() => handleReExam(p)}>RESET</button>
                          <button className={`${adminStyles.actionBtn} ${adminStyles.btnStop}`} onClick={() => handleToggleBlock(p)}>
                            {p.is_blocked ? "RESUME" : "STOP"}
                          </button>
                          <button className={`${adminStyles.actionBtn} ${adminStyles.btnDelete}`} onClick={() => handleDeleteStudent(p)}>DELETE</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PyHuntConfig
          activeTab={activeTab}
          configs={configs}
          setConfigs={setConfigs}
          mcqs={mcqs}
          setMcqs={setMcqs}
          jumbles={jumbles}
          setJumbles={setJumbles}
          globalAuth={globalAuth}
          setGlobalAuth={setGlobalAuth}
          updateConfig={updateConfig}
          updateMcq={updateMcq}
          addMcq={addMcq}
          removeMcq={removeMcq}
          saveGlobalAuth={saveGlobalAuth}
          saveJumbles={saveJumbles}
          addJumble={addJumble}
          removeJumble={removeJumble}
          labelConfig={labelConfig}
          saveLabelConfig={saveLabelConfig}
          codingChallenges={codingChallenges}
          updateCodingChallenge={updateCodingChallenge}
          addCodingChallenge={addCodingChallenge}
          removeCodingChallenge={removeCodingChallenge}
        />
      )}
    </div>
  );
}

function PyHuntConfig({
  activeTab, configs, mcqs, jumbles, globalAuth, updateConfig, updateMcq, addMcq, removeMcq,
  saveGlobalAuth, saveJumbles, addJumble, removeJumble, labelConfig, saveLabelConfig,
  codingChallenges, updateCodingChallenge, addCodingChallenge, removeCodingChallenge
}: any) {
  const [previewChallenge, setPreviewChallenge] = useState<any>(null);
  const [previewCode, setPreviewCode] = useState("");
  const [previewOutput, setPreviewOutput] = useState("");
  const [previewTestResults, setPreviewTestResults] = useState<any[]>([]);
  const [previewLanguage, setPreviewLanguage] = useState<"python" | "c" | "cpp">("python");
  const { runCode: runPythonSingleCode, runTestSuite: runPythonTestSuite, loading: pyLoading } = usePyodide(activeTab === 'r3' || activeTab === 'r4');
  const { runC_Cpp, runTestSuite: runWasmTestSuite, isCompiling } = useWasmCompiler();

  const handleRunPreview = async () => {
    if (!previewChallenge) return;
    setPreviewOutput("Initializing Logic...");

    let testCases: any[] = [];
    try {
      if (previewChallenge.test_cases) {
        let parsed = previewChallenge.test_cases;
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }

        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && parsed[0].test_cases && Array.isArray(parsed[0].test_cases)) {
            testCases = parsed[0].test_cases;
          } else {
            testCases = parsed;
          }
        } else if (parsed && typeof parsed === 'object' && (parsed as any).test_cases) {
          testCases = (parsed as any).test_cases;
        }
      }
    } catch (e) {
      setPreviewOutput("ERROR: Invalid Test Cases JSON");
      return;
    }

    // Default validation: exact match on trimmed output
    const validateFn = (stdout: string, expected: string) => stdout.trim() === expected.trim();

    if (Array.isArray(testCases) && testCases.length > 0) {
      let finalResults = "";
      let results: any[] = [];
      if (previewLanguage === "python") {
        const suiteRes = await runPythonTestSuite(previewCode, testCases, validateFn);
        results = suiteRes.results;
      } else {
        const suiteRes = await runWasmTestSuite(previewCode, testCases, validateFn);
        results = suiteRes.results;
      }

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.error) {
          finalResults += `❌ CASE ${i + 1}: ERROR\n   ${r.error}\n`;
        } else {
          finalResults += `${r.passed ? '✅' : '❌'} CASE ${i + 1} ${r.passed ? 'PASSED' : 'FAILED'}\n   Output: ${r.actual}\n`;
        }
      }
      setPreviewTestResults(results);
      setPreviewOutput(finalResults);
    } else {
      if (previewLanguage === "python") {
        const res = await runPythonSingleCode(previewCode);
        setPreviewOutput(res.error ? `ERROR: ${res.error}` : res.stdout || "Success (No Output)");
      } else {
        const res = await runC_Cpp(previewCode);
        setPreviewOutput(res.error ? `ERROR: ${res.error}` : res.stdout || "Success (No Output)");
      }
    }
  };

  return (
    <div className={adminStyles.configContent}>
      {previewChallenge && (
        <div className={adminStyles.modalOverlay} onClick={() => setPreviewChallenge(null)} onKeyDown={e => { if (e.key === 'Enter') setPreviewChallenge(null); }}  role="button" tabIndex={0}>
          <div className={adminStyles.modal} style={{ maxWidth: '90vw', width: '1200px', height: '85vh', padding: '20px', background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Live IDE Preview</h3>
              <button onClick={() => setPreviewChallenge(null)} className={adminStyles.actionBtn} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>✕ Close Preview</button>
            </div>
            <div style={{ height: 'calc(100% - 60px)' }}>
              <CodingInterface
                problem={previewChallenge}
                code={previewCode}
                setCode={setPreviewCode}
                output={previewOutput}
                onRun={handleRunPreview}
                onSubmit={handleRunPreview}
                pyLoading={pyLoading}
                isCompiling={isCompiling}
                currentRound={previewChallenge.round}
                labelConfig={labelConfig}
                testResults={previewTestResults}
                selectedLanguage={previewLanguage}
                onLanguageChange={(lang) => {
                  setPreviewLanguage(lang);
                  const starter = lang === 'python'
                    ? (previewChallenge.starter_code || '')
                    : lang === 'c'
                    ? (previewChallenge.starter_code_c || '')
                    : (previewChallenge.starter_code_cpp || '');
                  setPreviewCode(starter);
                }}
              />
            </div>
          </div>
        </div>
      )}
      {activeTab === "clues" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className={adminStyles.configCard}>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--accent)', fontSize: 16 }}>🌍 GLOBAL PROTOCOL</h4>
            <div className={adminStyles.inputGroup}>
              <label className={adminStyles.inputLabel}>INITIAL ACCESS CODE (ORBIT 0)</label>
              <textarea
                className={adminStyles.configTextarea}
                style={{ minHeight: 60, height: 60 }}
                value={globalAuth.startCode}
                onChange={(e) => saveGlobalAuth({ ...globalAuth, startCode: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>{labelConfig.phase.toUpperCase()} LABEL</label>
                <input
                  className={adminStyles.configInput}
                  value={labelConfig.phase}
                  onChange={(e) => saveLabelConfig({ ...labelConfig, phase: e.target.value })}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>{labelConfig.orbit.toUpperCase()} LABEL</label>
                <input
                  className={adminStyles.configInput}
                  value={labelConfig.orbit}
                  onChange={(e) => saveLabelConfig({ ...labelConfig, orbit: e.target.value })}
                />
              </div>
            </div>
          </div>
          {configs.map((c: any) => (
            <div key={c.round} className={adminStyles.configCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}>{labelConfig.phase} {c.round}: {c.name}</h4>
                <div className={adminStyles.codeBadge}>🔒 GATE KEY: {c.code || "PENDING"}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className={adminStyles.inputGroup}>
                  <label className={adminStyles.inputLabel}>{labelConfig.phase.toUpperCase()} NAME</label>
                  <textarea
                    className={adminStyles.configTextarea}
                    style={{ minHeight: 44, height: 44, padding: '10px 16px' }}
                    value={c.name}
                    onChange={(e) => updateConfig(c.round, 'name', e.target.value)}
                  />
                </div>
                <div className={adminStyles.inputGroup}>
                  <label className={adminStyles.inputLabel}>{labelConfig.phase.toUpperCase()} DESCRIPTION</label>
                  <textarea
                    className={adminStyles.configTextarea}
                    style={{ minHeight: 60, height: 60 }}
                    value={c.description || ""}
                    onChange={(e) => updateConfig(c.round, 'description', e.target.value)}
                  />
                </div>
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>CLUE (VISIBLE AT GATE)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.clue}
                  onChange={(e) => updateConfig(c.round, 'clue', e.target.value)}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>CLUE VARIANTS (ORBITAL NODES - PIPE SEPARATED)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  style={{ minHeight: 60, height: 60 }}
                  value={c.clue_variants || ""}
                  onChange={(e) => updateConfig(c.round, 'clue_variants', e.target.value)}
                  placeholder="Clue A | Clue B | Clue C | Clue D"
                />
                <p style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                  Use '|' to separate clues for different ranks (Rank 1 gets first clue, Rank 2 gets second, etc.)
                </p>
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>{labelConfig.orbit.toUpperCase()} UNLOCK CODE</label>
                <input
                  type="text"
                  className={adminStyles.configInput}
                  value={c.code}
                  onChange={(e) => updateConfig(c.round, 'code', e.target.value)}
                  placeholder="Code A | Code B | Code C"
                />
                <p style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                  Use '|' to separate codes for each clue variant. If only one code is provided, it applies to all.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className={adminStyles.inputGroup}>
                  <label className={adminStyles.inputLabel}>ROUND PROMPT</label>
                  <textarea
                    className={adminStyles.configTextarea}
                    value={c.prompt || ""}
                    onChange={(e) => updateConfig(c.round, 'prompt', e.target.value)}
                    style={{ height: 100 }}
                  />
                </div>
                <div className={adminStyles.inputGroup}>
                  <label className={adminStyles.inputLabel}>ROUND IMAGE URL</label>
                  <textarea
                    className={adminStyles.configTextarea}
                    value={c.imageUrl || ""}
                    onChange={(e) => updateConfig(c.round, 'imageUrl', e.target.value)}
                    style={{ height: 100 }}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "mcq" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: '#fff', margin: 0 }}>Active MCQ Set (Round 1)</h4>
            <button className="btn btn-primary" onClick={addMcq} style={{ fontSize: 12, padding: '8px 16px' }}>+ Add Question</button>
          </div>
          {mcqs.map((q: any, idx: number) => (
            <div key={q.id} className={adminStyles.configCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className={adminStyles.codeBadge}>QUESTION {idx + 1}</span>
                <button onClick={() => removeMcq(q.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>DELETE</button>
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>QUESTION TEXT</label>
                <textarea
                  className={adminStyles.configTextarea}
                  style={{ minHeight: 80 }}
                  value={q.question}
                  onChange={(e) => updateMcq(q.id, 'question', e.target.value)}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>OPTIONAL QUESTION IMAGE URL</label>
                <input
                  className={adminStyles.configInput}
                  value={q.imageUrl || ""}
                  onChange={(e) => updateMcq(q.id, 'imageUrl', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {q.options.map((opt: string, optIdx: number) => (
                  <div key={optIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={`ans-${q.id}`}
                      checked={q.answer === optIdx}
                      onChange={() => updateMcq(q.id, 'answer', optIdx)}
                    />
                    <input
                      className={adminStyles.configInput}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...q.options];
                        newOpts[optIdx] = e.target.value;
                        updateMcq(q.id, 'options', newOpts);
                      }}
                      placeholder={`Option ${optIdx + 1}`}
                      style={{ padding: '8px 12px', fontSize: 13 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "jumble" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: '#fff', margin: 0 }}>Code Jumble Parameters (Round 2)</h4>
            <button className="btn btn-primary" onClick={addJumble} style={{ fontSize: 12, padding: '8px 16px' }}>+ Add Jumble</button>
          </div>
          {jumbles.map((j: any, idx: number) => (
            <div key={j.id} className={adminStyles.configCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className={adminStyles.codeBadge}>JUMBLE CHALLENGE {idx + 1}</span>
                <button onClick={() => removeJumble(j.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>DELETE</button>
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>ROUND 2 JUMBLE CODE (FOR STUDENT TO ARRANGE)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={j.target}
                  onChange={(e) => {
                    const val = e.target.value;
                    saveJumbles(jumbles.map((item: any) => item.id === j.id ? { ...item, target: val, blocks: val.split('\n').filter((l: string) => l.trim()) } : item));
                  }}
                  style={{ height: 200 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "r3" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: '#fff', margin: 0 }}>Round 3: Logic Sequence Challenges</h4>
            <button className={adminStyles.addMcqBtn} onClick={() => addCodingChallenge(3)}>+ ADD CHALLENGE</button>
          </div>
          {(codingChallenges[3] || []).map((c: any, idx: number) => (
            <div key={c.id} className={adminStyles.configCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className={adminStyles.codeBadge}>CHALLENGE {idx + 1}</span>
                  <button
                    className={adminStyles.actionBtn}
                    style={{ background: 'rgba(0, 242, 255, 0.1)', color: '#00f2ff', borderColor: 'rgba(0, 242, 255, 0.2)' }}
                    onClick={() => {
                      setPreviewChallenge({ ...c, round: 3 });
                      setPreviewLanguage("python");
                      setPreviewCode(c.starter_code || "# Write test code here...");
                      setPreviewOutput("");
                    }}
                  >
                    👁️ LIVE PREVIEW
                  </button>
                </div>
                <button onClick={() => removeCodingChallenge(3, c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>DELETE</button>
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>QUESTION / PROMPT</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.prompt || ""}
                  onChange={(e) => updateCodingChallenge(3, c.id, 'prompt', e.target.value)}
                  placeholder="Describe the challenge..."
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>OPTIONAL IMAGE URL</label>
                <input
                  className={adminStyles.configInput}
                  value={c.imageUrl || ""}
                  onChange={(e) => updateCodingChallenge(3, c.id, 'imageUrl', e.target.value)}
                  placeholder="https://example.com/image.png"
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>OPTIONAL TARGET OUTPUT (FALLBACK)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.target_output || ""}
                  onChange={(e) => updateCodingChallenge(3, c.id, 'target_output', e.target.value)}
                  placeholder="e.g., palindrome: true"
                  style={{ minHeight: 80, fontFamily: 'monospace' }}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>TEST CASES (JSON ARRAY)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.test_cases || "[]"}
                  onChange={(e) => updateCodingChallenge(3, c.id, 'test_cases', e.target.value)}
                  placeholder='[{"input": "radar", "expected": "palindrome: true"}]'
                  style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>CLUE (VISIBLE AT GATE)</label>
                <input
                  className={adminStyles.configInput}
                  value={c.clue || ""}
                  onChange={(e) => updateCodingChallenge(3, c.id, 'clue', e.target.value)}
                  placeholder="Enter the clue for this challenge..."
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>ASSIGNED CLUE VARIANTS (Separated by |)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.clue_variants || ""}
                  onChange={(e) => updateCodingChallenge(3, c.id, 'clue_variants', e.target.value)}
                  placeholder="Variant 1 | Variant 2 | Variant 3"
                  style={{ minHeight: 60 }}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>UNLOCK CODE(S) (Use | for multiple)</label>
                <input
                  className={adminStyles.configInput}
                  value={c.unlock_code || ""}
                  onChange={(e) => updateCodingChallenge(3, c.id, 'unlock_code', e.target.value)}
                  placeholder="e.g., SECRET123 or CODE1|CODE2"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "r4" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: '#fff', margin: 0 }}>Round 4: Final Sequence Challenges</h4>
            <button className={adminStyles.addMcqBtn} onClick={() => addCodingChallenge(4)}>+ ADD CHALLENGE</button>
          </div>
          {(codingChallenges[4] || []).map((c: any, idx: number) => (
            <div key={c.id} className={adminStyles.configCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className={adminStyles.codeBadge}>CHALLENGE {idx + 1}</span>
                  <button
                    className={adminStyles.actionBtn}
                    style={{ background: 'rgba(0, 242, 255, 0.1)', color: '#00f2ff', borderColor: 'rgba(0, 242, 255, 0.2)' }}
                    onClick={() => {
                      setPreviewChallenge({ ...c, round: 4 });
                      setPreviewLanguage("python");
                      setPreviewCode(c.starter_code || "# Write test code here...");
                      setPreviewOutput("");
                    }}
                  >
                    👁️ LIVE PREVIEW
                  </button>
                </div>
                <button onClick={() => removeCodingChallenge(4, c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>DELETE</button>
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>QUESTION / PROMPT</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.prompt || ""}
                  onChange={(e) => updateCodingChallenge(4, c.id, 'prompt', e.target.value)}
                  placeholder="Describe the FizzBuzz challenge..."
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>OPTIONAL IMAGE URL</label>
                <input
                  className={adminStyles.configInput}
                  value={c.imageUrl || ""}
                  onChange={(e) => updateCodingChallenge(4, c.id, 'imageUrl', e.target.value)}
                  placeholder="https://example.com/image.png"
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>OPTIONAL TARGET OUTPUT (FALLBACK)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.target_output || ""}
                  onChange={(e) => updateCodingChallenge(4, c.id, 'target_output', e.target.value)}
                  placeholder="e.g., 1, 2, Fizz, 4, Buzz"
                  style={{ minHeight: 80, fontFamily: 'monospace' }}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>TEST CASES (JSON ARRAY)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.test_cases || "[]"}
                  onChange={(e) => updateCodingChallenge(4, c.id, 'test_cases', e.target.value)}
                  placeholder='[{"input": "3", "expected": "1, 2, Fizz"}]'
                  style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>CLUE (VISIBLE AT GATE)</label>
                <input
                  className={adminStyles.configInput}
                  value={c.clue || ""}
                  onChange={(e) => updateCodingChallenge(4, c.id, 'clue', e.target.value)}
                  placeholder="Enter the clue for this challenge..."
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>ASSIGNED CLUE VARIANTS (Separated by |)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.clue_variants || ""}
                  onChange={(e) => updateCodingChallenge(4, c.id, 'clue_variants', e.target.value)}
                  placeholder="Variant 1 | Variant 2 | Variant 3"
                  style={{ minHeight: 60 }}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>UNLOCK CODE(S) (Use | for multiple)</label>
                <input
                  className={adminStyles.configInput}
                  value={c.unlock_code || ""}
                  onChange={(e) => updateCodingChallenge(4, c.id, 'unlock_code', e.target.value)}
                  placeholder="e.g., SECRET123 or CODE1|CODE2"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Data-Stream Export Animation ──────────────────────────────
function ExportButton({ quizzes }: { quizzes: BranchExamSummary[] }) {
  const [phase, setPhase] = useState<"idle" | "streaming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doExport = async (name?: string) => {
    setShowMenu(false);
    if (phase === "streaming") return;
    setPhase("streaming");
    setError(null);
    try {
      const blob = await exportResults(name === "all" ? undefined : name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `results_${name || "all"}_${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setPhase("done");
      setTimeout(() => setPhase("idle"), 3000);
    } catch (e: any) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const quizNames = Array.from(new Set(quizzes.map(q => q.exam_name)));

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <button
          id="export-btn"
          onClick={() => setShowMenu(!showMenu)}
          disabled={phase === "streaming"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: phase === "streaming" ? "not-allowed" : "pointer",
            border: "1px solid rgba(139,92,246,0.35)",
            background: phase === "done"
              ? "rgba(16,185,129,0.12)"
              : "rgba(139,92,246,0.1)",
            color: phase === "done" ? "#34d399" : "#a78bfa",
            transition: "opacity 0.3s ease, transform 0.3s ease, background 0.3s ease",
            position: "relative",
            overflow: "hidden",
            zIndex: 1,
          }}
        >
          {phase === "streaming" && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.25), transparent)",
                backgroundSize: "200% 100%",
                animation: "shimmerExport 1s linear infinite",
              }}
            />
          )}
          <span style={{ fontSize: 16 }}>
            {phase === "streaming" ? "☁️" : phase === "done" ? "✓" : "📊"}
          </span>
          {phase === "streaming" ? "Streaming data…" : phase === "done" ? "Downloaded!" : "Export Results"}
        </button>
        {error && <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>}
      </div>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 240,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              padding: "8px",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", padding: "4px 8px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Select Quiz to Download
            </div>
            <button
              className={styles.menuItem}
              onClick={() => doExport("all")}
              style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}
            >
              <span style={{ opacity: 0.6 }}>📦</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>All Results (Universal)</span>
            </button>
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {quizNames.length === 0 ? (
                <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>No quizzes discovered</div>
              ) : quizNames.map(name => (
                <button
                  key={name}
                  className={styles.menuItem}
                  onClick={() => doExport(name)}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}
                >
                  <span style={{ opacity: 0.6 }}>📝</span>
                  <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [initialized, setInitialized] = useState(false);
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState("");
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "submitted" | "not_started">("all");
  const [search, setSearch] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<Tab>("monitor");
  const [liveStats, setLiveStats] = useState({ answers: 0, violations: 0, submittals: 0 });
  const [odysseyData, setOdysseyData] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<BranchExamSummary[]>([]);
  const [quizFilter, setQuizFilter] = useState<string>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthed(getStoredAuth());
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    try {
      if (authed) localStorage.setItem(ADMIN_AUTH_KEY, "true");
      else localStorage.removeItem(ADMIN_AUTH_KEY);
    } catch { }
  }, [authed, initialized]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const secret = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin@examguard2024";
    if (pass === secret) {
      setAuthed(true);
    } else {
      setPassError("Incorrect admin password.");
    }
  };

  const fetchStudents = useCallback(async (examName?: string) => {
    try {
      const data = await fetchAdminStudents(examName);
      setStudents(data || []);
      setLastUpdate(new Date());
      const violations = (data || []).filter((s: any) => s.status === "active").reduce((a: number, s: any) => a + (s.warnings || 0), 0);
      setLiveStats({ answers: 0, violations, submittals: (data || []).filter((s: any) => s.status === "submitted").length });
    } catch (err) {
      console.error("[ADMIN] fetchStudents:", err);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;

    // 1. Fetch Students and Quizzes (Discovery)
    const syncEverything = async () => {
      try {
        fetchStudents();

        const [qs, configs] = await Promise.all([
          fetchAdminQuestions(),
          fetchAllExamConfigs()
        ]);

        const list: BranchExamSummary[] = [];
        const seen = new Set<string>();

        // 1. Group questions by branch/exam
        qs.forEach((q: AdminQuestion) => {
          const key = `${q.branch}-${q.exam_name}`;
          if (!seen.has(key)) {
            const config = configs.find((c: any) => c.exam_title === q.exam_name);
            list.push({
              branch: q.branch,
              exam_name: q.exam_name,
              question_count: qs.filter(x => x.branch === q.branch && x.exam_name === q.exam_name).length,
              is_active: config ? config.is_active : true
            } as any);
            seen.add(key);
          }
        });

        // 2. Add configs that might not have questions yet
        configs.forEach((c: any) => {
          if (!list.find((x: any) => x.exam_name === (c.exam_title || c.exam_name))) {
            list.push({
              branch: "CS",
              exam_name: c.exam_title || c.exam_name,
              question_count: 0,
              is_active: c.is_active
            } as any);
          }
        });

        setQuizzes(list);
      } catch (err) {
        console.error("[ADMIN] Sync Error:", err);
      }
    };

    syncEverything();

    // 2. Real-time subscriptions for status updates
    const channel = supabase
      .channel("admin-exam-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_status" }, () => fetchStudents())
      .subscribe();

    const statusInterval = setInterval(() => fetchStudents(quizFilter === "all" ? undefined : quizFilter), 5000);
    const discoveryInterval = setInterval(syncEverything, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(statusInterval);
      clearInterval(discoveryInterval);
    };
  }, [authed, fetchStudents, quizFilter]);

  const handleCleanup = async () => {
    if (!confirm("This will reset all sessions idle for > 4 hours to 'Not Started'. Continue?")) return;
    setLoading(true);
    try {
      const { count } = await cleanupStaleSessions();
      alert(`Successfully cleaned up ${count} stale sessions.`);
      fetchStudents(quizFilter === "all" ? undefined : quizFilter);
    } catch (err: any) {
      alert("Cleanup failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSubmit = async (s: AdminStudent) => {
    if (!confirm(`Force submit exam for ${s.name}? This will calculate score based on currently saved answers.`)) return;
    try {
      await forceSubmitAdminStudent(s.student_id);
      fetchStudents(quizFilter === "all" ? undefined : quizFilter);
    } catch (err: any) {
      alert("Force submit failed: " + err.message);
    }
  };

  const total = students.length;
  const active = students.filter((s) => s.status === "active" && !isStale(s.last_active)).length;
  const idle = students.filter((s) => s.status === "active" && isStale(s.last_active)).length;
  const submitted = students.filter((s) => s.status === "submitted").length;
  const notStarted = students.filter((s) => s.status === "not_started").length;
  const flagged = students.filter((s) => s.warnings >= 2).length;

  const visible = students
    .filter((s) => filter === "all" || s.status === filter)
    .filter((s) => quizFilter === "all" || s.exam_name === quizFilter)
    .filter((s) => !search.trim() || s.usn.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()));

  if (!initialized) {
    return (
      <div className="page-center">
        <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={60} borderRadius={12} />
          <Skeleton height={200} borderRadius={12} />
          <Skeleton height={50} borderRadius={12} />
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="page-center" style={{ background: "linear-gradient(160deg, #0d0d1a 0%, #0f0f23 100%)", minHeight: "100vh" }}>
        <div className={styles.loginCard} style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
          borderRadius: 24,
          padding: "48px 40px",
          width: "100%",
          maxWidth: 400,
        }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "#e2e8f0", marginBottom: 8 }}>
              EXAM Admin
            </h1>
            <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>ExamGuard Control Node, Staff Only</p>
          </div>
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              id="admin-password-input"
              type="password"
              placeholder="Admin password"
              value={pass}
              onChange={(e) => setPass(e.target.value)} className={adminStyles.input}
              style={{
                background: "var(--bg-input) !important",
                border: "1px solid var(--border)",
                color: "var(--text-primary) !important"
              }}
            />
            {passError && <p className="text-danger" style={{ fontSize: 13 }}>{passError}</p>}
            <button type="submit" className="btn btn-primary btn-lg" style={{ background: "var(--accent)", border: "none", borderRadius: 12 }}>
              Access Command Node
            </button>
          </form>
        </div>
      </div>
    );
  }

  const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
    { id: "monitor", label: "Monitor", icon: "📡" },
    // { id: "pyhunt", label: "PyHunt", icon: "🐍" },
    { id: "explorer", label: "Explorer", icon: "🛰️" },
    { id: "support", label: "SOS", icon: "🆘" },
    { id: "leaderboard", label: "Leaderboard", icon: "⚡" },
    { id: "questions", label: "Questions", icon: "📋" },
    { id: "students", label: "Students", icon: "👥" },
    { id: "faculty", label: "Faculty", icon: "👨‍🏫" },
    { id: "ingest", label: "Harvester", icon: "🌌" },
    { id: "control", label: "Control", icon: "🛸" },
  ];

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.menuToggle}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            )}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="url(#adminGrad)" />
              <path d="M8 12h16M8 16h10M8 20h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <div>
              <h1 className={styles.title} style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>
                EXAM Admin
              </h1>
              <p className={styles.subtitle} style={{ fontSize: 12 }}>
                Live Exam Monitor · Updated {timeAgo(lastUpdate.toISOString())}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className={`${adminStyles.tabs} ${styles.desktopNav}`}>
          {TAB_CONFIG.map((t) => (
            <button
              key={t.id}
              className={`${adminStyles.tab} ${activeTab === t.id ? adminStyles.tabActive : ""}`}
              onClick={() => setActiveTab(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className={styles.headerRight}>
          {activeTab === "monitor" && <ExportButton quizzes={quizzes} />}
          <button className="btn btn-outline" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setAuthed(false)}>
            Logout
          </button>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={styles.sidebarOverlay}
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={styles.sidebar}
            >
              <div className={styles.sidebarHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="8" fill="url(#adminGradSide)" />
                    <path d="M8 12h16M8 16h10M8 20h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="adminGradSide" x1="0" y1="0" x2="32" y2="32">
                        <stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>Command Center</span>
                </div>
              </div>
              <nav className={styles.sidebarNav}>
                {TAB_CONFIG.map((t) => (
                  <button
                    key={t.id}
                    className={`${styles.sidebarItem} ${activeTab === t.id ? styles.sidebarItemActive : ""}`}
                    onClick={() => {
                      setActiveTab(t.id);
                      setIsSidebarOpen(false);
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </nav>
              <div className={styles.sidebarFooter}>
                <button className="btn btn-outline" style={{ width: "100%" }} onClick={() => setAuthed(false)}>
                  Logout System
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── PyHunt Observer Node ── */}
      {/* {activeTab === "pyhunt" && (
        <PyHuntObserver fetchStudentsGlobal={fetchStudents} />
      )} */}
      {activeTab === "monitor" && (
        <>
          {/* ── Canva-Style 3 Hero Stat Cards ── */}
          <div className={styles.heroStatsGrid}>
            {/* Active Students */}
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "22px 24px",
              display: "flex",
              alignItems: "center",
              gap: 18,
              boxShadow: "var(--shadow-card)",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "var(--accent-glow)",
                border: "1px solid var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>👥</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1 }}>
                  {active}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginLeft: 8 }}>
                    ({idle} stale/idle)
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>Active Students</div>
              </div>
            </div>

            {/* Total Violations */}
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "22px 24px",
              display: "flex",
              alignItems: "center",
              gap: 18,
              boxShadow: "var(--shadow-card)",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "var(--warning-bg)",
                border: "1px solid var(--warning)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>⚠️</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--warning)", lineHeight: 1 }}>
                  {students.reduce((sum, s) => sum + (s.warnings || 0), 0)}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>Total Violations</div>
              </div>
            </div>

            {/* Completed Quizzes */}
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "22px 24px",
              display: "flex",
              alignItems: "center",
              gap: 18,
              boxShadow: "var(--shadow-card)",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "var(--success-bg)",
                border: "1px solid var(--success)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>✅</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--success)", lineHeight: 1 }}>
                  {submitted}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>Completed Quizzes</div>
              </div>
            </div>
          </div>

          {/* ── Live Quiz Channels (Global Status) ── */}
          <div style={{ padding: "20px 24px 0" }}>
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "20px",
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              boxShadow: "var(--shadow-card)"
            }}>
              <div style={{ width: "100%", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  🛰️ Network Channels
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", opacity: 0.6 }}>
                  Manage activation in the "Control" tab
                </span>
              </div>
              {Array.from(new Set(quizzes.map(q => q.exam_name))).map(name => {
                const q = quizzes.find((x: any) => x.exam_name === name);
                const isActive = (q as any)?.is_active;
                return (
                  <div key={name} style={{
                    background: "var(--bg-secondary)",
                    border: `1px solid ${isActive ? "var(--success)" : "var(--danger)"}`,
                    borderRadius: 12,
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "opacity 0.3s ease, transform 0.3s ease, background 0.3s ease"
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: isActive ? "var(--success)" : "var(--danger)",
                      boxShadow: isActive ? "0 0 10px var(--success)" : "none"
                    }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {name}
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                        <span style={{ fontSize: 12, opacity: 0.6 }}>{q?.question_count || 0} Questions</span>
                        <span style={{
                          fontSize: 12,
                          color: isActive ? "var(--success)" : "var(--danger)",
                          fontWeight: 600,
                          letterSpacing: "0.02em"
                        }}>
                          {isActive ? "LIVE" : "INACTIVE"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {quizzes.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 0" }}>
                  No quizzes detected in the network.
                </div>
              )}
            </div>
          </div>

          {/* ── Violation Alerts Feed ── */}
          <ViolationAlertsFeed />

          {/* Controls */}
          <div className={styles.controls}>
            <input type="text" className={adminStyles.input} placeholder="Search by name or USN…" value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 300 }} />

            <select
              className={adminStyles.input}
              style={{ maxWidth: 200, padding: "8px 12px", cursor: "pointer" }}
              value={quizFilter}
              onChange={(e) => setQuizFilter(e.target.value)}
            >
              <option value="all">All Quizzes</option>
              {Array.from(new Set([
                ...quizzes.map(q => q.exam_name),
                ...students.map(s => s.exam_name).filter(Boolean)
              ])).sort().map(name => (
                <option key={name as string} value={name as string}>{name as string}</option>
              ))}
            </select>

            <div className={styles.filters}>
              {(["all", "active", "submitted", "not_started"] as const).map((f) => (
                <button key={f} className={`btn ${filter === f ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setFilter(f)} style={{ fontSize: 12, padding: "6px 14px" }}>
                  {f === "not_started" ? "Not Started" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <button className="btn btn-outline" onClick={handleCleanup} style={{ fontSize: 12, padding: "6px 14px", border: "1px dashed var(--warning)", color: "var(--warning)" }}>
                🧹 Cleanup Stale
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th><th>USN NO.</th><th>Name</th><th>Exam</th><th>Email</th>
                    <th>Branch</th><th>Warnings</th><th>Status</th><th>Start Time</th><th>Total Time</th>
                    <th>Submitted At</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No students found.</td></tr>
                  ) : visible.map((s, i) => (
                    <tr key={s.student_id} className={s.warnings >= 3 ? styles.rowDanger : s.warnings >= 2 ? styles.rowWarning : ""}>
                      <td className="mono text-muted" style={{ fontSize: 12 }}>{i + 1}</td>
                      <td><span className="mono" style={{ fontSize: 13 }}>{s.usn}</span></td>
                      <td>{s.name}</td>
                      <td>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: s.exam_name === "PyHunt" ? "var(--accent-glow)" : "var(--bg-secondary)",
                          color: s.exam_name === "PyHunt" ? "var(--accent)" : "var(--text-primary)",
                          border: `1px solid ${s.exam_name === "PyHunt" ? "var(--accent)" : "var(--border)"}`,
                          textTransform: 'uppercase'
                        }}>
                          {s.exam_name || "—"}
                          {s.exam_name === "PyHunt" && s.current_round && s.status === 'active' && (
                            <span style={{ marginLeft: 4, opacity: 0.8 }}>- R{s.current_round}</span>
                          )}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.email || "—"}</td>
                      <td><span className="badge badge-neutral">{s.branch}</span></td>
                      <td><WarningBadge count={s.warnings} /></td>
                      <td><StatusBadge status={s.status} lastActive={s.last_active} isBlocked={s.is_blocked} examName={s.exam_name} round={s.current_round} /></td>
                      <td style={{ fontSize: 12 }}>{s.started_at ? new Date(s.started_at).toLocaleTimeString() : "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{getElapsedTime(s.started_at, s.submitted_at)}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString() : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {s.status === "active" && (
                            <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => handleForceSubmit(s)}>
                              Submit
                            </button>
                          )}
                          <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => resetAdminStudent(s.student_id).then(() => fetchStudents(quizFilter === "all" ? undefined : quizFilter))}>
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── New Feature Tabs ── */}
      {activeTab === "leaderboard" && <LeaderboardPage />}
      {activeTab === "ingest" && <IngestPage />}
      {activeTab === "control" && <OrbitalControl />}
      {activeTab === "questions" && <QuestionsTab />}
      {activeTab === "students" && <StudentsTab students={students} load={fetchStudents} />}
      {activeTab === "explorer" && <StudentExplorer />}
      {activeTab === "faculty" && <FacultyTab />}
      {activeTab === "support" && <SupportTab />}
    </div>
  );
}

// ── Violation Alerts Feed ─────────────────────────────────────
function ViolationAlertsFeed() {
  const [alerts, setAlerts] = useState<ViolationHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchViolationHistory();
      setAlerts(data);
    } catch (err) {
      console.error("Failed to fetch violations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 5000); // 5s polling for live monitor
    return () => clearInterval(interval);
  }, [loadAlerts]);

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}>
        {/* Panel header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>Real-time Security Stream</span>
          </div>
          <span style={{
            fontSize: 12, fontWeight: 600,
            padding: "2px 10px",
            borderRadius: 999,
            background: alerts.length > 0 ? "var(--danger-bg)" : "var(--bg-secondary)",
            color: alerts.length > 0 ? "var(--danger)" : "var(--text-muted)",
            border: alerts.length > 0 ? "1px solid var(--danger)" : "1px solid var(--border)",
          }}>
            {alerts.length} events logged
          </span>
        </div>

        {/* Alert list */}
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {loading && alerts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
              ✅ No violations recorded in this session
            </div>
          ) : (
            alerts.map((alert, i) => (
              <div
                key={alert.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom: i < alerts.length - 1 ? "1px solid var(--border)" : "none",
                  background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)",
                  transition: "background 0.2s",
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0, marginTop: 2,
                }}>
                  {alert.type.includes("Face") ? "👤" : "⚡"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>
                    {alert.student_name}
                    <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{alert.usn}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 600, marginBottom: 2 }}>
                    {alert.type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Mission: {alert.exam_name} • {new Date(alert.created_at).toLocaleTimeString()}
                  </div>
                </div>

                {/* Counter index (descending) */}
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
                  opacity: 0.8,
                  fontFamily: "monospace"
                }}>
                  #{alerts.length - i}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function StatusBadge({ status, lastActive, isBlocked, examName, round }: { status: string; lastActive: string | null; isBlocked?: boolean; examName?: string | null; round?: number | null }) {
  if (isBlocked) return <span className="badge badge-danger">🛑 STOPPED</span>;
  const idle = lastActive ? (Date.now() - new Date(lastActive).getTime()) > 60_000 : false;
  if (status === "submitted") return <span className="badge badge-success">✓ Submitted</span>;
  if (status === "active" && idle) return <span className="badge badge-warning">⏸ Idle</span>;
  if (status === "active") {
    if (examName === "PyHunt" && round) {
      return <span className="badge badge-success">● PyHunt R{round}</span>;
    }
    return <span className="badge badge-success">● Active</span>;
  }
  return <span className="badge badge-neutral">○ Not Started</span>;
}

function WarningBadge({ count }: { count: number }) {
  if (count === 0) return <span className="badge badge-neutral">0</span>;
  if (count === 1) return <span className="badge badge-warning">⚠ 1</span>;
  if (count === 2) return <span className="badge" style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid var(--warning)" }}>⚠ 2</span>;
  return <span className="badge badge-danger">🔴 {count}</span>;
}

// ── Questions Tab (unchanged logic, kept here) ────────────────
function QuestionsTab() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [configs, setConfigs] = useState<ExamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "aptitude" | "programming" | "other">("all");
  const [subCategory, setSubCategory] = useState<"jumble" | "compiler" | "mcq">("compiler");
  const [previewChallenge, setPreviewChallenge] = useState<any>(null);
  const [previewCode, setPreviewCode] = useState("");
  const [previewOutput, setPreviewOutput] = useState("");
  const [previewTestResults, setPreviewTestResults] = useState<any[]>([]);
  const [previewLanguage, setPreviewLanguage] = useState<"python" | "c" | "cpp">("python");
  const { runCode: runPreviewCode, loading: previewLoading } = usePyodide();
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "upcoming" | "inactive">("all");
  const [formData, setFormData] = useState<Omit<AdminQuestion, "id">>({
    text: "",
    options: ["", "", "", ""],
    branch: "CS",
    correct_answer: "",
    order_index: 0,
    marks: 1,
    exam_name: "General Assessment",
    image_url: "",
    audio_url: "",
    programming_type: "compiler"
  });
  const [folderBranchModal, setFolderBranchModal] = useState<{ name: string, branches: string[] } | null>(null);
  const [formCategory, setFormCategory] = useState<"aptitude" | "programming" | "other">("other");
  const [challengeTargetOutput, setChallengeTargetOutput] = useState("");
  const [challengeTestCases, setChallengeTestCases] = useState<string>("[]");
  const [challengeStarterCode, setChallengeStarterCode] = useState("");
  const [challengeStarterCodeC, setChallengeStarterCodeC] = useState("");
  const [challengeStarterCodeCpp, setChallengeStarterCodeCpp] = useState("");
  const [adminActiveLangTab, setAdminActiveLangTab] = useState<"python" | "c" | "cpp">("python");
  const [challengeClue, setChallengeClue] = useState("");
  const [challengeClueVariants, setChallengeClueVariants] = useState("");
  const [challengeUnlockCode, setChallengeUnlockCode] = useState("");
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const isCodingChallenge = formCategory === "programming" && (formData.programming_type === "compiler" || formData.programming_type === "jumble");
  const isSaveDisabled = isCodingChallenge ? !formData.text : (!formData.text || !formData.correct_answer || formData.options.some((o) => !o));
  const [schedulingExam, setSchedulingExam] = useState<string | null>(null);

  const handleRunPreview = async () => {
    if (!previewChallenge) return;
    setPreviewOutput("Initializing Logic...");

    let testCases: any[] = [];
    try {
      if (previewChallenge.test_cases) {
        let parsed = previewChallenge.test_cases;
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && parsed[0].test_cases && Array.isArray(parsed[0].test_cases)) {
            testCases = parsed[0].test_cases;
          } else {
            testCases = parsed;
          }
        } else if (parsed && typeof parsed === 'object' && (parsed as any).test_cases) {
          testCases = (parsed as any).test_cases;
        }
      }
    } catch (e) {
      setPreviewOutput("ERROR: Invalid Test Cases JSON");
      return;
    }

    if (Array.isArray(testCases) && testCases.length > 0) {
      let finalResults = "";
      const results = [];
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const res: any = await runPreviewCode(previewCode, tc.input || "");
        const expected = (tc.expected || tc.output || tc.expected_output || "").toString().trim();
        const actual = (res.stdout || "").toString().trim();
        const passed = validateOutput(res.stdout, expected);

        results.push({
          input: tc.input, expected: expected, actual: actual,
          passed: passed, error: res.error
        });

        if (res.error) finalResults += `❌ CASE ${i + 1}: ERROR\n   ${res.error}\n`;
        else finalResults += `${passed ? '✅' : '❌'} CASE ${i + 1} ${passed ? 'PASSED' : 'FAILED'}\n   Output: ${actual}\n`;
      }
      setPreviewTestResults(results);
      setPreviewOutput(finalResults);
    } else {
      const res: any = await runPreviewCode(previewCode);
      setPreviewOutput(res.error ? `ERROR: ${res.error}` : res.stdout || "Success (No Output)");
    }
  };
  const [scheduleData, setScheduleData] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    autoActive: true
  });


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qData, cData] = await Promise.all([
        fetchAdminQuestions(),
        fetchPublicExamConfig()
      ]);
      setQuestions(qData);
      setConfigs(cData);
    }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddNewQuestionClick = () => {
    setEditing(null);
    if (selectedCategory === "programming") {
      setFormCategory("programming");
      setFormData({
        text: "",
        options: ["", "", "", ""],
        branch: "CS",
        correct_answer: subCategory === "compiler" ? "COMPILER" : "",
        order_index: questions.length,
        marks: subCategory === "compiler" ? 10 : 1,
        exam_name: "Coding Challenge",
        image_url: "",
        audio_url: "",
        programming_type: subCategory
      });
      if (subCategory === "compiler") {
        setChallengeTargetOutput("");
        setChallengeTestCases("[]");
        setChallengeStarterCode("");
        setChallengeStarterCodeC("");
        setChallengeStarterCodeCpp("");
        setAdminActiveLangTab("python");
        setChallengeClue("");
        setChallengeClueVariants("");
        setChallengeUnlockCode("");
      }
    } else {
      setFormCategory(selectedCategory === "all" ? "other" : selectedCategory);
      setFormData({
        text: "",
        options: ["", "", "", ""],
        branch: "CS",
        correct_answer: "",
        order_index: questions.length,
        marks: 1,
        exam_name: "General Assessment",
        image_url: "",
        audio_url: "",
        programming_type: "compiler"
      });
    }
    setShowModal(true);
  };

  const handleEditClick = (q: AdminQuestion) => {
    setEditing(q);
    setFormCategory((q.category as any) || 'other');
    const type = q.programming_type || "compiler";
    setFormData({
      ...q,
      programming_type: type
    });

    if (q.category === "programming" && type === "compiler") {
      let parsed = {
        target_output: "",
        test_cases: "[]",
        starter_code: "",
        starter_code_c: "",
        starter_code_cpp: "",
        clue: "",
        clue_variants: "",
        unlock_code: ""
      };
      if (q.options && q.options.length > 0) {
        try {
          parsed = JSON.parse(q.options[0]);
        } catch (e) {
          console.warn("Failed to parse compiler options:", e);
        }
      }
      setChallengeTargetOutput(parsed.target_output || "");
      setChallengeTestCases(parsed.test_cases || "[]");
      setChallengeStarterCode(parsed.starter_code || "");
      setChallengeStarterCodeC(parsed.starter_code_c || "");
      setChallengeStarterCodeCpp(parsed.starter_code_cpp || "");
      setAdminActiveLangTab("python");
      setChallengeClue(parsed.clue || "");
      setChallengeClueVariants(parsed.clue_variants || "");
      setChallengeUnlockCode(parsed.unlock_code || "");
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.text) return alert("Please enter question text");
    if (!formData.branch) return alert("Please select a branch");

    const isCodingChallenge = formCategory === "programming" && (formData.programming_type === "compiler" || formData.programming_type === "jumble");

    if (!isCodingChallenge) {
      if (formData.options.some((o) => !o)) return alert("All options must be filled");
      if (!formData.correct_answer) return alert("Please select a correct answer");
    }

    try {
      let finalOptions = formData.options;
      let finalCorrectAnswer = formData.correct_answer;

      if (isCodingChallenge) {
        const challengeData = {
          target_output: challengeTargetOutput,
          test_cases: challengeTestCases,
          starter_code: challengeStarterCode,
          starter_code_c: challengeStarterCodeC,
          starter_code_cpp: challengeStarterCodeCpp,
          clue: challengeClue,
          clue_variants: challengeClueVariants,
          unlock_code: challengeUnlockCode
        };
        finalOptions = [JSON.stringify(challengeData)];
        finalCorrectAnswer = "COMPILER";
      }

      const payload = {
        ...formData,
        category: formCategory,
        options: finalOptions,
        correct_answer: finalCorrectAnswer,
        programming_type: formCategory === "programming" ? formData.programming_type : undefined
      };

      if (editing) await updateAdminQuestion(editing.id, payload);
      else await createAdminQuestion(payload);
      
      setShowModal(false); 
      setEditing(null);
      setFormData({ text: "", options: ["", "", "", ""], branch: "CS", correct_answer: "", order_index: questions.length, marks: 1, exam_name: "General Assessment", image_url: "", audio_url: "" });
      setFormCategory("other");
      setChallengeTargetOutput("");
      setChallengeTestCases("[]");
      setChallengeStarterCode("");
      setChallengeStarterCodeC("");
      setChallengeStarterCodeCpp("");
      setChallengeClue("");
      setChallengeClueVariants("");
      setChallengeUnlockCode("");
      load();
    } catch { alert("Failed to save question"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await deleteAdminQuestion(id);
      setQuestions(questions.filter((q) => q.id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`WARNING: This will permanently delete the entire Isolation Node '${folderName}' and ALL questions inside it. Continue?`)) return;
    try {
      setLoading(true);
      await deleteAdminFolder(folderName);
      setQuestions(questions.filter((q) => q.exam_name !== folderName));
      setExpandedClusters(prev => ({ ...prev, [folderName]: false }));
    } catch (error: any) {
      alert(`Failed to delete folder: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFolder = async (folderName: string) => {
    const newName = prompt(`Enter new name for Isolation Node '${folderName}':`, folderName);
    if (!newName || newName.trim() === folderName) return;

    try {
      setLoading(true);
      await renameAdminFolder(folderName, newName.trim());
      // Update local state: find and update all questions in this folder
      setQuestions(questions.map(q =>
        q.exam_name === folderName ? { ...q, exam_name: newName.trim() } : q
      ));
      setExpandedClusters(prev => {
        const next = { ...prev };
        delete next[folderName];
        next[newName.trim()] = true;
        return next;
      });
    } catch (error: any) {
      alert(`Failed to rename folder: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditBranchFolder = (folderName: string) => {
    // Find unique branches currently assigned to this folder
    const currentBranches = questions
      .filter(q => q.exam_name === folderName)
      .map(q => q.branch || "CS")
      .filter((v, i, a) => a.indexOf(v) === i); // Get unique branches

    setFolderBranchModal({ name: folderName, branches: currentBranches.length ? currentBranches : ["CS"] });
  };

  const handleSaveFolderBranch = async () => {
    if (!folderBranchModal) return;
    if (folderBranchModal.branches.length === 0) return alert("Please select at least one branch");
    try {
      setLoading(true);
      await editAdminFolderBranch(folderBranchModal.name, folderBranchModal.branches);
      load(); // Reload all to get updated branch mapping
      setFolderBranchModal(null);
    } catch (error: any) {
      alert(`Failed to update branch: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleActivation = async (title: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      await updateExamConfig({ exam_title: title, is_active: !currentStatus });
      // Update local state immediately for snappy UI
      setConfigs(prev => prev.map(c => c.exam_title === title ? { ...c, is_active: !currentStatus } : c));
      // If title didn't exist in configs, add it
      if (!configs.find((c: any) => c.exam_title === title)) {
        load();
      }
    } catch (error) {
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAttempts = async (title: string, current: number) => {
    const val = prompt(`Set max attempts for ${title}:`, current.toString());
    if (val === null) return;
    const num = parseInt(val);
    if (isNaN(num)) return alert("Invalid number");
    try {
      setLoading(true);
      await updateExamConfig({ exam_title: title, max_attempts: num });
      setConfigs(prev => prev.map(c => c.exam_title === title ? { ...c, max_attempts: num } : c));
    } catch { alert("Failed to update attempts"); }
    finally { setLoading(false); }
  };

  const handleUpdateTimings = async (title: string, current: number) => {
    const val = prompt(`Set duration (minutes) for ${title}:`, current.toString());
    if (val === null) return;
    const num = parseInt(val);
    if (isNaN(num)) return alert("Invalid number");
    try {
      setLoading(true);
      await updateExamConfig({ exam_title: title, duration_minutes: num });
      setConfigs(prev => prev.map(c => c.exam_title === title ? { ...c, duration_minutes: num } : c));
    } catch { alert("Failed to update timings"); }
    finally { setLoading(false); }
  };

  const handleUpdateSchedule = (title: string, start: string | null, end: string | null) => {
    setSchedulingExam(title);
    let sDate = "", sTime = "", eDate = "", eTime = "";
    if (start) {
      const d = new Date(start);
      sDate = d.toISOString().split('T')[0];
      sTime = d.toTimeString().slice(0, 5);
    }
    if (end) {
      const d = new Date(end);
      eDate = d.toISOString().split('T')[0];
      eTime = d.toTimeString().slice(0, 5);
    }
    setScheduleData({ startDate: sDate, startTime: sTime, endDate: eDate, endTime: eTime, autoActive: true });
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (!schedulingExam) return;
    try {
      setLoading(true);
      const { startDate, startTime, endDate, endTime, autoActive } = scheduleData;

      const s = (startDate && startTime) ? new Date(`${startDate}T${startTime}`).toISOString() : null;
      const e = (endDate && endTime) ? new Date(`${endDate}T${endTime}`).toISOString() : null;

      await updateExamConfig({
        exam_title: schedulingExam,
        scheduled_start: s,
        scheduled_end: e,
        is_active: autoActive ? true : undefined
      });

      setConfigs(prev => prev.map(c => c.exam_title === schedulingExam ? { ...c, scheduled_start: s, scheduled_end: e, is_active: autoActive ? true : c.is_active } : c));
      setShowScheduleModal(false);
    } catch { alert("Failed to update schedule"); }
    finally { setLoading(false); }
  };
  // ── Category classification ──
  function getCategory(examName: string): "aptitude" | "programming" | "other" {
    if (examName === "Meet") return "aptitude";
    const n = examName.toLowerCase();
    if (n.includes("aptitude") || n.includes("quant") || n.includes("reasoning") || n.includes("logical") || n.includes("verbal") || n.includes("english") || n.includes("comprehension") || n.includes("maths") || n.includes("numerical")) return "aptitude";
    if (n.includes("program") || n.includes("code") || n.includes("coding") || n.includes("dsa") || n.includes("algorithm") || n.includes("data structure") || n.includes("python") || n.includes("java") || n.includes("c++") || n.includes("javascript") || n.includes("cs") || n.includes("ds") || n === "hii" || n === "meet") return "programming";
    return "other";
  }

  // New: prefer q.category, fallback to inference
  const getQCategory = (q: AdminQuestion) => q.category || getCategory(q.exam_name || "");

  const filteredQuestions = questions.filter((q) => {
    const branchMatch = selectedBranch === "All" || q.branch === selectedBranch;
    let categoryMatch = selectedCategory === "all" || getQCategory(q) === selectedCategory;

    if (categoryMatch && selectedCategory === "programming") {
      const type = q.programming_type || "compiler";
      if (type !== subCategory) categoryMatch = false;
    }

    if (selectedStatus === "all") return branchMatch && categoryMatch;

    const conf = configs.find((c: any) => c.exam_title === q.exam_name);
    const now = Date.now();

    let statusMatch = false;
    if (selectedStatus === "active") {
      const start = conf?.scheduled_start ? new Date(conf.scheduled_start).getTime() : 0;
      const end = conf?.scheduled_end ? new Date(conf.scheduled_end).getTime() : Infinity;
      statusMatch = (conf?.is_active !== false) && start <= now && end >= now;
    } else if (selectedStatus === "upcoming") {
      const start = conf?.scheduled_start ? new Date(conf.scheduled_start).getTime() : 0;
      statusMatch = (conf?.is_active !== false) && start > now;
    } else if (selectedStatus === "inactive") {
      const end = conf?.scheduled_end ? new Date(conf.scheduled_end).getTime() : Infinity;
      statusMatch = (conf?.is_active === false) || (end < now);
    }

    return branchMatch && categoryMatch && statusMatch;
  });



  const branchFiltered = selectedBranch === "All" ? questions : questions.filter((q) => q.branch === selectedBranch);

  // Category counts
  const catCounts = {
    all: branchFiltered.length,
    aptitude: branchFiltered.filter(q => getQCategory(q) === "aptitude").length,
    programming: branchFiltered.filter(q => getQCategory(q) === "programming").length,
    other: branchFiltered.filter(q => getQCategory(q) === "other").length,
  };

  // Group by exam_name and branch
  const clusters: Record<string, AdminQuestion[]> = {};
  filteredQuestions.forEach(q => {
    const name = q.exam_name || "Uncategorized";
    const branch = q.branch || "CS";
    const clusterKey = `${name}|${branch}`;
    if (!clusters[clusterKey]) clusters[clusterKey] = [];
    clusters[clusterKey].push(q);
  });

  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const toggleCluster = (key: string) => setExpandedClusters(prev => ({ ...prev, [key]: !prev[key] }));

  // Palette for category cards, cycles through 4 colors
  const CARD_PALETTE = [
    { bg: "var(--bg-secondary)", border: "var(--border)", accent: "var(--accent)", icon: "📐", skillColor: "var(--bg-primary)", skillText: "var(--text-primary)" },
    { bg: "var(--bg-secondary)", border: "var(--border)", accent: "var(--violet)", icon: "🧠", skillColor: "var(--bg-primary)", skillText: "var(--text-primary)" },
    { bg: "var(--bg-secondary)", border: "var(--border)", accent: "var(--success)", icon: "📖", skillColor: "var(--bg-primary)", skillText: "var(--text-primary)" },
    { bg: "var(--bg-secondary)", border: "var(--border)", accent: "var(--warning)", icon: "💻", skillColor: "var(--bg-primary)", skillText: "var(--text-primary)" },
  ];

  function inferDifficulty(name: string): "Easy" | "Medium" | "Hard" {
    const n = name.toLowerCase();
    if (n.includes("final") || n.includes("advanced") || n.includes("hard") || n.includes("logical") || n.includes("programming")) return "Hard";
    if (n.includes("mid") || n.includes("aptitude") || n.includes("medium") || n.includes("intermediate")) return "Medium";
    return "Easy";
  }

  function inferDescription(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("aptitude") || n.includes("quant")) return "Tests mathematical reasoning, numerical ability, and problem-solving skills with numbers, percentages, ratios, and basic arithmetic operations.";
    if (n.includes("logical") || n.includes("reasoning")) return "Evaluates analytical thinking, pattern recognition, and logical deduction abilities through puzzles, sequences, and reasoning problems.";
    if (n.includes("english") || n.includes("comprehension") || n.includes("language")) return "Assesses language proficiency, reading comprehension, grammar, vocabulary, and written communication skills.";
    if (n.includes("program") || n.includes("code") || n.includes("cs") || n.includes("computer")) return "Tests programming concepts, algorithms, data structures, and coding logic across multiple programming languages.";
    if (n.includes("final")) return "Comprehensive final assessment covering all topics from the semester. Tests deep understanding and application of core concepts.";
    if (n.includes("mid")) return "Mid-semester evaluation covering syllabus units 1 to 3. Tests understanding of foundational concepts and skill application.";
    return `Assessment covering key topics in ${name}. Evaluates conceptual understanding and practical application skills.`;
  }

  function inferSkills(name: string, branches: string[]): string[] {
    const n = name.toLowerCase();
    const branchTag = branches[0] || "General";
    if (n.includes("aptitude") || n.includes("quant")) return ["Arithmetic", "Algebra", "Geometry", "Data Interpretation", "Percentages"];
    if (n.includes("logical") || n.includes("reasoning")) return ["Pattern Recognition", "Analytical Thinking", "Problem Solving", "Critical Reasoning"];
    if (n.includes("english") || n.includes("comprehension")) return ["Reading Comprehension", "Grammar", "Vocabulary", "Sentence Formation"];
    if (n.includes("program") || n.includes("code") || n.includes("computer")) return ["Algorithms", "Data Structures", "Programming Logic", "Code Optimization"];
    return [branchTag, "Core Concepts", "Application", "Analysis"];
  }

  const DIFF_COLORS: Record<string, { bg: string; text: string }> = {
    Easy: { bg: "var(--success-bg)", text: "var(--success)" },
    Medium: { bg: "var(--warning-bg)", text: "var(--warning)" },
    Hard: { bg: "var(--danger-bg)", text: "var(--danger)" },
  };

  return (
    <div className={adminStyles.managementPage}>
      <div className={adminStyles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 className={adminStyles.headerTitle}>Questions ({filteredQuestions.length})</h2>
          <select className={adminStyles.input} style={{ width: 140, height: 36, padding: "0 8px", fontSize: 13 }}
            value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            <option value="All">All Branches</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleAddNewQuestionClick}>
          + Add Question
        </button>
      </div>

      {/* ── Category Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {([
          { key: "all" as const, label: "All", emoji: "\ud83d\udccb" },
          { key: "aptitude" as const, label: "Aptitude", emoji: "\ud83e\udde0" },
          { key: "programming" as const, label: "Programming", emoji: "\ud83d\udcbb" },
          { key: "other" as const, label: "Other", emoji: "\ud83d\udcc2" },
        ]).map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: selectedCategory === cat.key ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: selectedCategory === cat.key ? 'var(--bg-secondary)' : 'var(--bg-card)',
              color: selectedCategory === cat.key ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {cat.emoji} {cat.label} ({catCounts[cat.key]})
          </button>
        ))}
      </div>

      {selectedCategory === 'programming' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, marginTop: -10 }}>
           <button
            onClick={() => setSubCategory('jumble')}
            style={{
              padding: '6px 16px',
              borderRadius: '99px',
              border: '1px solid var(--border)',
              background: subCategory === 'jumble' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: subCategory === 'jumble' ? '#fff' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            🧩 Code Jumble
          </button>
           <button
            onClick={() => setSubCategory('compiler')}
            style={{
              padding: '6px 16px',
              borderRadius: '99px',
              border: '1px solid var(--border)',
              background: subCategory === 'compiler' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: subCategory === 'compiler' ? '#fff' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            📁 Coding Challenges
          </button>
           <button
            onClick={() => setSubCategory('mcq')}
            style={{
              padding: '6px 16px',
              borderRadius: '99px',
              border: '1px solid var(--border)',
              background: subCategory === 'mcq' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: subCategory === 'mcq' ? '#fff' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            📝 Conceptual MCQs
          </button>
        </div>
      )}

      {/* ── Status Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {([
          { key: "all" as const, label: "All Status", icon: "🌐" },
          { key: "active" as const, label: "Active", icon: "🟢" },
          { key: "upcoming" as const, label: "Upcoming", icon: "🟡" },
          { key: "inactive" as const, label: "Inactive", icon: "⚪" },
        ]).map(stat => (
          <button
            key={stat.key}
            onClick={() => setSelectedStatus(stat.key)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: selectedStatus === stat.key ? '2px solid var(--success)' : '1px solid var(--border)',
              background: selectedStatus === stat.key ? 'var(--success-bg)' : 'transparent',
              color: selectedStatus === stat.key ? 'var(--success)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {stat.icon} {stat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : filteredQuestions.length === 0 ? (
        <div className={adminStyles.empty}>No questions found for branch: {selectedBranch}</div>
      ) : (
        <div className={adminStyles.managementGrid}>
          <AnimatePresence mode="popLayout">
            {Object.entries(clusters).map(([clusterKey, clusterQuestions], idx) => {
              const [name, branch] = clusterKey.split("|");
              const palette = CARD_PALETTE[idx % CARD_PALETTE.length];
              const diff = inferDifficulty(name);
              const diffStyle = DIFF_COLORS[diff];
              const desc = inferDescription(name);
              const branchList = [branch];
              const skills = inferSkills(name, branchList);

              return (
                <React.Fragment key={clusterKey}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.35 }}
                    style={{
                      background: "var(--bg-card)",
                      border: `1.5px solid var(--border)`,
                      borderRadius: 18,
                      padding: "24px 24px 20px",
                      cursor: "pointer",
                      boxShadow: "var(--shadow-card)",
                      transition: "box-shadow 0.2s, transform 0.2s",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    whileHover={{ y: -3, boxShadow: `var(--shadow-elevated)` }}
                    onClick={() => toggleCluster(clusterKey)}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 22 }}>{palette.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 16, color: palette.accent, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
                          {name} <small style={{ fontWeight: 400, opacity: 0.7 }}>({branch})</small>
                        </div>
                      </div>

                      {/* Control Panel Integration */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0}>
                        {(() => {
                          const conf = configs.find((c: any) => c.exam_title === name);
                          const isManualActive = conf ? conf.is_active : true;
                          const attempts = conf?.max_attempts || 1;
                          const duration = conf?.duration_minutes || 60;
                          const start = conf?.scheduled_start;
                          const end = conf?.scheduled_end;

                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <ControlBtn
                                icon="🔢"
                                label={`Attempts: ${attempts}`}
                                color="var(--warning)"
                                onClick={() => handleUpdateAttempts(name, attempts)}
                              />

                              <ControlBtn
                                icon={isManualActive ? "🟢" : "🔘"}
                                label="Active"
                                color="var(--success)"
                                variant={isManualActive ? "solid" : "ghost"}
                                onClick={() => !isManualActive && toggleActivation(name, false)}
                              />

                              <ControlBtn
                                icon={!isManualActive ? "🔴" : "🔘"}
                                label="Deactivate"
                                color="var(--danger)"
                                variant={!isManualActive ? "solid" : "ghost"}
                                onClick={() => isManualActive && toggleActivation(name, true)}
                              />

                              <ControlBtn
                                icon="📅"
                                label="Schedule"
                                color="var(--accent)"
                                onClick={() => handleUpdateSchedule(name, start ?? null, end ?? null)}
                              />

                              <ControlBtn
                                icon="🕒"
                                label={`Timings: ${duration}m`}
                                color="var(--violet)"
                                onClick={() => handleUpdateTimings(name, duration)}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 12px",
                        borderRadius: 999,
                        fontSize: 12, fontWeight: 600,
                        background: diffStyle.bg,
                        color: diffStyle.text,
                        border: `1px solid ${diffStyle.bg.replace("0.1", "0.3")}`,
                      }}>{diff}</span>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
                      {desc}
                    </p>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: palette.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                        Key Skills Tested:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {skills.map(skill => (
                          <span key={skill} style={{
                            padding: "4px 11px",
                            borderRadius: 999,
                            fontSize: 12, fontWeight: 500,
                            background: palette.skillColor,
                            color: palette.skillText,
                            border: `1px solid ${palette.border}`,
                          }}>{skill}</span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0}>
                      <button
                        style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: `1px solid var(--border)`, background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 }}
                        onClick={(e) => { e.stopPropagation(); handleRenameFolder(name); }}
                      >Rename</button>
                      <button
                        style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: `1px solid var(--border)`, background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 }}
                        onClick={(e) => { e.stopPropagation(); handleEditBranchFolder(name); }}
                      >Edit Branch</button>
                      <button
                        style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(211,47,47,0.2)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontWeight: 600, marginLeft: "auto" }}
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(name); }}
                      >Delete</button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${palette.border}` }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                        📋 {clusterQuestions.length} question{clusterQuestions.length !== 1 ? "s" : ""}
                      </span>
                      <span style={{ fontSize: 12, color: palette.accent, fontWeight: 700 }}>
                        {expandedClusters[clusterKey] ? "▲ Collapse" : "▼ View Questions"}
                      </span>
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {expandedClusters[clusterKey] && (
                      <motion.div
                        style={{ gridColumn: "1 / -1" }}
                        className={adminStyles.isolationView}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className={adminStyles.nodeManagementHeader}>
                          <div className={adminStyles.nodeInfo}>
                            <h4 style={{ margin: 0, color: palette.accent }}>{name} ({branch})</h4>
                            <small style={{ color: "var(--text-muted)" }}>{clusterQuestions.length} Questions</small>
                          </div>
                          <div className={adminStyles.nodeActions}>
                            <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 12px" }}
                              onClick={() => handleRenameFolder(name)}>Rename</button>
                            <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 12px" }}
                              onClick={() => handleEditBranchFolder(name)}>Edit Branch</button>
                            <button className="btn btn-outline btn-danger" style={{ fontSize: 12, padding: "4px 12px" }}
                              onClick={() => handleDeleteFolder(name)}>Delete Folder</button>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                          {clusterQuestions.map((q) => (
                            <div key={q.id} className={adminStyles.card} style={{ margin: 0 }}>
                              <div className={adminStyles.cardHeader}>
                                <div className={adminStyles.cardIndex} style={{ fontSize: 12, fontWeight: 700, color: palette.accent }}>Q{q.order_index + 1}</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  {(q.programming_type === "compiler" || q.programming_type === "jumble") && (
                                    <button 
                                      className="btn-icon" 
                                      title="Preview Coding Challenge"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewChallenge({
                                          prompt: q.text,
                                          test_cases: q.test_cases || "[]",
                                          target_output: q.target_output || "",
                                          starter_code: q.starter_code || "",
                                          starter_code_c: q.starter_code_c || "",
                                          starter_code_cpp: q.starter_code_cpp || "",
                                          round: q.programming_type === "jumble" ? 2 : 3
                                        });
                                        setPreviewLanguage("python");
                                        setPreviewCode(q.starter_code || "");
                                        setPreviewOutput("");
                                        setPreviewTestResults([]);
                                      }}
                                    >
                                      👁️
                                    </button>
                                  )}
                                  <button className="btn-icon" title="Edit Question" onClick={() => handleEditClick(q)}>✏️</button>
                                  <button className="btn-icon btn-danger" title="Delete Question" onClick={() => handleDelete(q.id)}>🗑️</button>
                                </div>
                              </div>
                              {q.image_url && (
                                <div className={adminStyles.cardThumbnailContainer}>
                                  <img src={q.image_url} alt="Thumbnail" className={adminStyles.cardThumbnail} />
                                </div>
                              )}
                              {q.audio_url && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0", color: "#8b5cf6", fontSize: 12, fontWeight: 600 }}>
                                  <span>🎧 Audio Attached</span>
                                </div>
                              )}
                              <p className={adminStyles.cardText} style={{ fontSize: 14 }}>{q.text}</p>
                              <div className={adminStyles.cardFooter} style={{ display: "flex", gap: 10, marginTop: 12 }}>
                                <span className="badge badge-neutral" style={{ fontSize: 12 }}>{q.branch}</span>
                                <span className="badge badge-neutral" style={{ fontSize: 12 }}>{q.marks} Marks</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 20, textAlign: "right" }}>
                          <button className="btn btn-outline" onClick={() => toggleCluster(name)}>Close</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {showModal && (
        <div className={adminStyles.modalOverlay} onClick={() => setShowModal(false)} onKeyDown={e => e.key === 'Enter' && (() => setShowModal(false))()}  role="button" tabIndex={0}>
          <div className={adminStyles.modal} onClick={(e) => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0} style={{ maxWidth: 850 }}>
            <h3>{editing ? "Edit Question" : "Add Question"}</h3>

            {/* Shared Identity & Meta Section */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                <label>Category</label>
                <select
                  className={adminStyles.input}
                  style={{
                    height: "44px",
                    fontSize: "15px",
                    fontWeight: "600",
                    background: "var(--bg-secondary) !important",
                    border: "1.5px solid var(--border)",
                    color: "var(--text-primary)",
                    cursor: "pointer"
                  }}
                  value={formCategory}
                  onChange={(e) => {
                    const newCat = e.target.value as any;
                    setFormCategory(newCat);
                    if (newCat === "programming") {
                      setFormData((prev) => ({ ...prev, programming_type: prev.programming_type || "compiler" }));
                    }
                  }}
                >
                  <option value="aptitude">🧠 Aptitude</option>
                  <option value="programming">💻 Programming</option>
                  <option value="other">📂 Other</option>
                </select>
              </div>

              {formCategory === 'programming' && (
                <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                  <label>Programming Type</label>
                  <select
                    className={adminStyles.input}
                    style={{
                      height: "44px",
                      fontSize: "15px",
                      fontWeight: "600",
                      background: "var(--bg-secondary) !important",
                      border: "1.5px solid var(--border)",
                      color: "var(--text-primary)",
                      cursor: "pointer"
                    }}
                    value={formData.programming_type || 'compiler'}
                    onChange={(e) => setFormData(prev => ({ ...prev, programming_type: e.target.value as "jumble" | "compiler" | "mcq" }))}
                  >
                    <option value="jumble">🧩 Code Jumble</option>
                    <option value="compiler">📁 Logic Building</option>
                    <option value="mcq">📝 Conceptual MCQs</option>
                  </select>
                </div>
              )}

              <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                <label>Branch / Department</label>
                <select className={adminStyles.input} value={formData.branch} onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}>
                  {ALL_BRANCH_DATA.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                <label>Exam Identity (Folder Anchor)</label>
                <select
                  className={adminStyles.input}
                  value={Array.from(new Set(questions.map(q => q.exam_name))).includes(formData.exam_name) ? formData.exam_name : "NEW_IDENTITY"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "NEW_IDENTITY") {
                      setFormData(prev => ({ ...prev, exam_name: "" }));
                    } else {
                      setFormData(prev => ({ ...prev, exam_name: val }));
                    }
                  }}
                >
                  <option value="">Select Identity...</option>
                  {Array.from(new Set(questions.map(q => q.exam_name))).filter(Boolean).sort().map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="NEW_IDENTITY">+ Add New Identity</option>
                </select>
                {(formData.exam_name === "" || !Array.from(new Set(questions.map(q => q.exam_name))).includes(formData.exam_name)) && (
                  <input
                    type="text"
                    className={adminStyles.input}
                    placeholder="Enter New Identity Name..."
                    style={{ marginTop: 8 }}
                    value={formData.exam_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, exam_name: e.target.value }))}
                  />
                )}
              </div>
            </div>

            {/* Marks & Order Index Section */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                <label>Marks</label>
                <input type="number" className={adminStyles.input} value={formData.marks} onChange={(e) => setFormData(prev => ({ ...prev, marks: +e.target.value }))} />
              </div>
              <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                <label>Order / Question Index</label>
                <input type="number" className={adminStyles.input} value={formData.order_index} onChange={(e) => setFormData(prev => ({ ...prev, order_index: +e.target.value }))} />
              </div>
            </div>

            {/* Primary Question Content */}
            <div className={adminStyles.formGroup}>
              <label>{isCodingChallenge ? "Coding Challenge Prompt / Instructions" : "Question Text / Prompt"}</label>
              <textarea className={adminStyles.input} value={formData.text} onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))} rows={3} placeholder="Provide instructions or background problem definition here..." />
            </div>

            {/* Type-Specific Editor */}
            {isCodingChallenge ? (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "18px", padding: 24, margin: "20px 0", display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>💻 PyHunt Coding Challenge Configurations</h4>
                  <div className={adminStyles.codeBadge}>Compiler Enabled</div>
                </div>

                {/* Starter Code Tabs */}
                <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ margin: 0 }}>Starter Code Template</label>
                    <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.03)", padding: 4, borderRadius: 10, border: "1px solid var(--border)" }}>
                      {(["python", "c", "cpp"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setAdminActiveLangTab(lang)}
                          style={{
                            background: adminActiveLangTab === lang ? "var(--accent)" : "transparent",
                            color: adminActiveLangTab === lang ? "#000" : "var(--text)",
                            border: "none",
                            padding: "4px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "opacity 0.2s ease, transform 0.2s ease, background 0.2s ease"
                          }}
                        >
                          {lang === "python" ? "🐍 Python" : lang === "c" ? "🇨 C" : "➕ C++"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {adminActiveLangTab === "python" && (
                    <textarea
                      className={adminStyles.input}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 13, minHeight: 120, background: "rgba(0,0,0,0.3) !important", border: "1.5px solid var(--border)" }}
                      value={challengeStarterCode}
                      onChange={(e) => setChallengeStarterCode(e.target.value)}
                      placeholder={`def solution(arr):\n    # Write your code here\n    return False`}
                      rows={5}
                    />
                  )}
                  {adminActiveLangTab === "c" && (
                    <textarea
                      className={adminStyles.input}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 13, minHeight: 120, background: "rgba(0,0,0,0.3) !important", border: "1.5px solid var(--border)" }}
                      value={challengeStarterCodeC}
                      onChange={(e) => setChallengeStarterCodeC(e.target.value)}
                      placeholder={`#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // Write your C code here\n    return 0;\n}`}
                      rows={5}
                    />
                  )}
                  {adminActiveLangTab === "cpp" && (
                    <textarea
                      className={adminStyles.input}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 13, minHeight: 120, background: "rgba(0,0,0,0.3) !important", border: "1.5px solid var(--border)" }}
                      value={challengeStarterCodeCpp}
                      onChange={(e) => setChallengeStarterCodeCpp(e.target.value)}
                      placeholder={`#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    return 0;\n}`}
                      rows={5}
                    />
                  )}
                </div>

                {/* Expected target output match */}
                <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                  <label>Expected Target Output (Optional target standard stdout string match)</label>
                  <input
                    type="text"
                    className={adminStyles.input}
                    value={challengeTargetOutput}
                    onChange={(e) => setChallengeTargetOutput(e.target.value)}
                    placeholder="e.g. Hello, World! or Success"
                  />
                </div>

                {/* Test Cases Builder */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-secondary)", textTransform: "uppercase" }}>Interactive Test Cases Builder</label>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => setRawJsonMode(!rawJsonMode)}
                    >
                      {rawJsonMode ? "👁️ Visual Fields" : "📝 Raw JSON View"}
                    </button>
                  </div>

                  {rawJsonMode ? (
                    <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                      <textarea
                        className={adminStyles.input}
                        style={{ fontFamily: "var(--font-mono)", fontSize: 12, minHeight: 120, background: "rgba(0,0,0,0.3) !important" }}
                        value={challengeTestCases}
                        onChange={(e) => setChallengeTestCases(e.target.value)}
                        placeholder='[{"input": "5", "expected": "25"}]'
                        rows={5}
                      />
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{"Format: `[{\"input\": \"...\", \"expected\": \"...\"}]`"}</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(() => {
                        let cases: { input: string; expected: string }[] = [];
                        try { cases = JSON.parse(challengeTestCases || "[]"); } catch (e) { }
                        return (
                          <>
                            {cases.map((tc, index) => (
                              <div key={`item-${index}`} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <div style={{ display: "flex", flex: 1, gap: 10 }}>
                                  <input
                                    type="text"
                                    placeholder={`Input #${index + 1}`}
                                    className={adminStyles.input}
                                    style={{ margin: 0, fontSize: 13 }}
                                    value={tc.input}
                                    onChange={(e) => {
                                      const updated = [...cases];
                                      updated[index].input = e.target.value;
                                      setChallengeTestCases(JSON.stringify(updated));
                                    }}
                                  />
                                  <input
                                    type="text"
                                    placeholder={`Expected Expected Output #${index + 1}`}
                                    className={adminStyles.input}
                                    style={{ margin: 0, fontSize: 13 }}
                                    value={tc.expected}
                                    onChange={(e) => {
                                      const updated = [...cases];
                                      updated[index].expected = e.target.value;
                                      setChallengeTestCases(JSON.stringify(updated));
                                    }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn-icon btn-danger"
                                  style={{ padding: 8, height: 38, width: 38 }}
                                  onClick={() => {
                                    const updated = cases.filter((_, idx) => idx !== index);
                                    setChallengeTestCases(JSON.stringify(updated));
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ width: "max-content", fontSize: 12, padding: "8px 16px", marginTop: 4 }}
                              onClick={() => {
                                const updated = [...cases, { input: "", expected: "" }];
                                setChallengeTestCases(JSON.stringify(updated));
                              }}
                            >
                              ➕ Add Test Case
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* PyHunt Security Gates
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                  <h5 style={{ margin: "0 0 14px 0", fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>🛡️ PyHunt Security Gate (Orbit Clues)</h5>
                  <div className={adminStyles.formRow}>
                    <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                      <label>Clue (Visible at Gate)</label>
                      <input
                        type="text"
                        className={adminStyles.input}
                        value={challengeClue}
                        onChange={(e) => setChallengeClue(e.target.value)}
                        placeholder="Clue visible to student"
                      />
                    </div>
                    <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                      <label>Clue Variants (Pipe `|` separated)</label>
                      <input
                        type="text"
                        className={adminStyles.input}
                        value={challengeClueVariants}
                        onChange={(e) => setChallengeClueVariants(e.target.value)}
                        placeholder="Variant A | Variant B"
                      />
                    </div>
                    <div className={adminStyles.formGroup} style={{ margin: 0 }}>
                      <label>Unlock Code(s) (Pipe `|` separated)</label>
                      <input
                        type="text"
                        className={adminStyles.input}
                        value={challengeUnlockCode}
                        onChange={(e) => setChallengeUnlockCode(e.target.value)}
                        placeholder="CodeA | CodeB"
                      />
                    </div>
                  </div>
                </div>
                */}
              </div>
            ) : (
              <>
                <div className={adminStyles.formGroup}>
                  <label>Options</label>
                  <div className={adminStyles.optionsGrid}>
                    {formData.options.map((opt, i) => (
                      <input key={`item-${i}`} className={adminStyles.input} placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                        onChange={(e) => { const n = [...formData.options]; n[i] = e.target.value; setFormData(prev => ({ ...prev, options: n })); }} />
                    ))}
                  </div>
                </div>
                <div className={adminStyles.formGroup}>
                  <label>Correct Answer</label>
                  <select className={adminStyles.input} value={formData.correct_answer} onChange={(e) => setFormData(prev => ({ ...prev, correct_answer: e.target.value }))}>
                    <option value="">Select correct option…</option>
                    {formData.options.map((_, i) => <option key={`item-${i}`} value={String.fromCharCode(65 + i)}>Option {String.fromCharCode(65 + i)}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Media Upload Options */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div className={adminStyles.formGroup}>
                <label>Image Asset (Optional)</label>
                {formData.image_url ? (
                  <div className={adminStyles.imagePreviewContainer}>
                    <img src={formData.image_url} alt="Question" className={adminStyles.imagePreview} />
                    <button
                      className={adminStyles.removeImageBtn}
                      onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))}
                      title="Remove Image"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className={adminStyles.uploadZone}>
                    <input
                      type="file"
                      id="question-image-upload"
                      style={{ display: "none" }}
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await uploadQuestionImage(file);
                          setFormData(prev => ({ ...prev, image_url: url }));
                        } catch (err: any) {
                          alert(`Upload failed: ${err.message}`);
                        }
                      }}
                    />
                    <label htmlFor="question-image-upload" style={{ cursor: "pointer", display: "block", padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Upload Image</div>
                    </label>
                  </div>
                )}
              </div>

              <div className={adminStyles.formGroup}>
                <label>Audio Asset (Optional)</label>
                {formData.audio_url ? (
                  <div className={adminStyles.imagePreviewContainer} style={{ background: "rgba(139, 92, 246, 0.05)", display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>🎧 Audio Attached</div>
                    <audio src={formData.audio_url} controls style={{ width: "100%", height: 32 }} />
                    <button
                      className={adminStyles.removeImageBtn}
                      onClick={() => setFormData(prev => ({ ...prev, audio_url: "" }))}
                      title="Remove Audio"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className={adminStyles.uploadZone}>
                    <input
                      type="file"
                      id="question-audio-upload"
                      style={{ display: "none" }}
                      accept="audio/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await uploadQuestionImage(file);
                          setFormData(prev => ({ ...prev, audio_url: url }));
                        } catch (err: any) {
                          alert(`Upload failed: ${err.message}`);
                        }
                      }}
                    />
                    <label htmlFor="question-audio-upload" style={{ cursor: "pointer", display: "block", padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>🎵</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Upload Audio</div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className={adminStyles.modalActions}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaveDisabled}>Save</button>
            </div>
          </div>
        </div>
      )}

      {folderBranchModal && (
        <div className={adminStyles.modalOverlay} onClick={() => setFolderBranchModal(null)} onKeyDown={e => e.key === 'Enter' && (() => setFolderBranchModal(null))()}  role="button" tabIndex={0}>
          <div className={adminStyles.modal} onClick={(e) => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0} style={{ maxWidth: 650 }}>
            <h3 style={{ marginBottom: 12 }}>Manage Node Branches</h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 24, lineHeight: 1.5 }}>
              Select which departments should have access to <strong>{folderBranchModal.name}</strong>. Students in selected branches will see these questions.
            </p>

            <div className={adminStyles.formGroup}>
              <label style={{ marginBottom: 14, display: "block", fontWeight: 700, color: "rgba(255,255,255,0.9)", fontSize: 13 }}>AVAILABLE DEPARTMENTS</label>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "10px 20px",
                background: "var(--bg-secondary)",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                maxHeight: "400px",
                overflowY: "auto"
              }}>
                {ALL_BRANCH_DATA.map((b) => {
                  const isChecked = folderBranchModal.branches.includes(b.id);
                  return (
                    <label key={b.id} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      cursor: "pointer",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: isChecked ? "var(--accent-glow)" : "transparent",
                      border: isChecked ? "1px solid var(--accent)" : "1px solid transparent",
                      transition: "opacity 0.2s ease, transform 0.2s ease, background 0.2s ease"
                    }}>
                      <div style={{ paddingTop: 2 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newBranches = e.target.checked
                              ? [...folderBranchModal.branches, b.id]
                              : folderBranchModal.branches.filter(id => id !== b.id);
                            setFolderBranchModal({ ...folderBranchModal, branches: newBranches });
                          }}
                          style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#8b5cf6" }}
                        />
                      </div>
                      <span style={{
                        color: isChecked ? "var(--text-primary)" : "var(--text-secondary)",
                        fontWeight: isChecked ? 600 : 400,
                        fontSize: 13,
                        lineHeight: 1.4,
                        userSelect: "none"
                      }}>
                        {b.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className={adminStyles.modalActions} style={{ marginTop: 32 }}>
              <button className="btn btn-outline" onClick={() => setFolderBranchModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveFolderBranch}>Sync Branches</button>
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className={adminStyles.modalOverlay} onClick={() => setShowScheduleModal(false)} onKeyDown={e => e.key === 'Enter' && (() => setShowScheduleModal(false))()}  role="button" tabIndex={0}>
          <div className={adminStyles.modal} style={{ maxWidth: 450, padding: 32, borderRadius: 24, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 32 }}>📅</span>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Auto Schedule</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '12px 16px', background: 'rgba(124, 58, 237, 0.1)', borderRadius: 12 }}>
              <input
                type="checkbox"
                id="autoActive"
                checked={scheduleData.autoActive}
                onChange={(e) => setScheduleData({ ...scheduleData, autoActive: e.target.checked })}
                style={{ width: 20, height: 20, accentColor: '#8b5cf6' }}
              />
              <label htmlFor="autoActive" style={{ fontSize: 15, fontWeight: 500, color: '#a78bfa', cursor: 'pointer' }}>
                Enable Automatic Activation
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>Start Date</label>
                <input
                  type="date"
                  className={adminStyles.input}
                  value={scheduleData.startDate}
                  onChange={(e) => setScheduleData({ ...scheduleData, startDate: e.target.value })}
                  style={{ borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>Start Time</label>
                <input
                  type="time"
                  className={adminStyles.input}
                  value={scheduleData.startTime}
                  onChange={(e) => setScheduleData({ ...scheduleData, startTime: e.target.value })}
                  style={{ borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>End Date</label>
                <input
                  type="date"
                  className={adminStyles.input}
                  value={scheduleData.endDate}
                  onChange={(e) => setScheduleData({ ...scheduleData, endDate: e.target.value })}
                  style={{ borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>End Time</label>
                <input
                  type="time"
                  className={adminStyles.input}
                  value={scheduleData.endTime}
                  onChange={(e) => setScheduleData({ ...scheduleData, endTime: e.target.value })}
                  style={{ borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSaveSchedule}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 16,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      )}

    {previewChallenge && (
        <div className={adminStyles.modalOverlay} onClick={() => setPreviewChallenge(null)} onKeyDown={e => { if (e.key === 'Enter') setPreviewChallenge(null); }}  role="button" tabIndex={0}>
          <div className={adminStyles.modal} style={{ maxWidth: '90vw', width: '1200px', height: '85vh', padding: '20px', background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Live IDE Preview</h3>
              <button onClick={() => setPreviewChallenge(null)} className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>✕ Close Preview</button>
            </div>
            <div style={{ height: 'calc(100% - 60px)' }}>
              <CodingInterface
                problem={previewChallenge}
                code={previewCode}
                setCode={setPreviewCode}
                output={previewOutput}
                onRun={handleRunPreview}
                onSubmit={handleRunPreview}
                pyLoading={previewLoading}
                currentRound={previewChallenge.round}
                labelConfig={{ phase: "Preview", orbit: "Test" }}
                testResults={previewTestResults}
                selectedLanguage={previewLanguage}
                onLanguageChange={(lang) => {
                  setPreviewLanguage(lang);
                  const starter = lang === 'python'
                    ? (previewChallenge.starter_code || '')
                    : lang === 'c'
                    ? (previewChallenge.starter_code_c || '')
                    : (previewChallenge.starter_code_cpp || '');
                  setPreviewCode(starter);
                }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Students Tab ──────────────────────────────────────────────
function StudentsTab({ students, load }: { students: AdminStudent[], load: (examName?: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminStudent | null>(null);
  const [formData, setFormData] = useState({ usn: "", name: "", email: "", branch: "CS", password: "" });

  useEffect(() => {
    if (students.length === 0) load();
  }, []);

  const handleSave = async () => {
    const usnRegex = /^[A-Z0-9]{5}[A-Z]{2}[0-9]{3}$/;
    if (!formData.usn) return alert("USN is required");
    // Unrestricted USN
    if (!formData.name) return alert("Name is required");
    if (!formData.branch) return alert("Branch is required");
    if (!editing && !formData.password) return alert("Password is required for new students");
    try {
      if (editing) {
        const updateData: any = {};
        if (formData.name) updateData.name = formData.name;
        if (formData.email) updateData.email = formData.email;
        if (formData.branch) updateData.branch = formData.branch;
        if (formData.password) updateData.password = formData.password;
        await updateAdminStudent(editing.student_id, updateData);
      } else {
        await createAdminStudent(formData);
      }
      setShowModal(false); setEditing(null);
      setFormData({ usn: "", name: "", email: "", branch: "CS", password: "" });
      load();
    } catch (e: any) { alert(e.message || "Failed to save student"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this student and all their exam data?")) return;
    try { await deleteAdminStudent(id); load(); } catch { alert("Failed to delete"); }
  };

  const handleDeleteAll = async () => {
    if (!confirm("WARNING: Are you absolutely sure you want to delete ALL students and their exam data? This cannot be undone!")) return;
    try {
      await deleteAllAdminStudents();
      load();
      alert("All students have been deleted.");
    } catch {
      alert("Failed to delete all students.");
    }
  };

  const handleResetExam = async (id: string) => {
    if (!confirm("Allow this student to retake the exam? This will clear all their previous answers and warnings.")) return;
    try { await resetAdminStudent(id); load(); alert("Exam state reset successfully."); }
    catch { alert("Failed to reset exam state"); }
  };

  const handleToggleBlock = async (s: AdminStudent) => {
    const action = s.is_blocked ? "unblock" : "block";
    if (!confirm(`Are you sure you want to ${action} ${s.name}?`)) return;
    try {
      if (s.is_blocked) await unblockAdminStudent(s.student_id);
      else await blockAdminStudent(s.student_id);
      load();
    } catch (err: any) {
      alert(`Failed to ${action} student: ${err.message}`);
    }
  };

  return (
    <div className={adminStyles.managementPage}>
      <div className={adminStyles.header}>
        <h2 className={adminStyles.headerTitle}>Students ({students.length})</h2>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn btn-outline text-danger" onClick={handleDeleteAll}>
            Delete All Students
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setFormData({ usn: "", name: "", email: "", branch: "CS", password: "" }); setShowModal(true); }}>
            + Add Student (DEBUG-V3)
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : students.length === 0 ? (
        <div className={adminStyles.empty}>No students yet. Add one to get started.</div>
      ) : (
        <div className={adminStyles.tableWrapper}>
          <table className={adminStyles.table}>
            <thead>
              <tr><th>#</th><th>USN</th><th>Name</th><th>Email</th><th>Branch</th><th>Status</th><th>Warnings</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.student_id}>
                  <td className="mono text-muted">{i + 1}</td>
                  <td className="mono">{s.usn}</td>
                  <td>{s.name}</td>
                  <td style={{ fontSize: 12 }}>{s.email || "—"}</td>
                  <td><span className="badge badge-neutral">{s.branch || "CS"}</span></td>
                  <td>
                    {s.is_blocked ? (
                      <span className="badge badge-danger" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" }}>Blocked</span>
                    ) : (
                      <StatusBadge status={s.status} lastActive={s.last_active} />
                    )}
                  </td>
                  <td><WarningBadge count={s.warnings} /></td>
                  <td>
                    <div className={adminStyles.actionButtons}>
                      <button className="btn btn-outline" onClick={() => {
                        let bID = s.branch || "CS";
                        // Normalize legacy full names to IDs if necessary
                        const match = ALL_BRANCH_DATA.find((b: any) => b.name === bID || b.id === bID);
                        if (match) bID = match.id;

                        setEditing(s as any);
                        setFormData({ usn: s.usn, name: s.name, email: s.email || "", branch: bID, password: "" });
                        setShowModal(true);
                      }}>Edit</button>
                      <button className="btn btn-outline" onClick={() => { const p = prompt("Enter new password:"); if (p) updateAdminStudent(s.student_id, { password: p }).then(() => alert("Password reset")); }}>Reset PW</button>
                      <button className="btn btn-outline" style={{ color: "var(--accent)", borderColor: "var(--accent)" }} onClick={() => handleResetExam(s.student_id)}>Re-Exam</button>
                      <button className="btn btn-outline" style={{ color: "var(--accent)", borderColor: "var(--accent)" }} onClick={() => window.open(`/admin/students/${s.student_id}`, '_blank')}>View Pulse</button>
                      <button
                        className="btn btn-outline"
                        style={{
                          color: s.is_blocked ? "var(--success)" : "var(--danger)",
                          borderColor: s.is_blocked ? "var(--success)" : "var(--danger)",
                          fontWeight: "bold"
                        }}
                        onClick={() => handleToggleBlock(s)}
                      >
                        {s.is_blocked ? "Unblock" : "Block"}
                      </button>
                      <button className="btn btn-outline text-danger" onClick={() => handleDelete(s.student_id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={adminStyles.modalOverlay} onClick={() => setShowModal(false)} onKeyDown={e => e.key === 'Enter' && (() => setShowModal(false))()}  role="button" tabIndex={0}>
          <div className={adminStyles.modal} onClick={(e) => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0}>
            <h3>{editing ? "Edit Student" : "Add Student"}</h3>
            <div className={adminStyles.formGroup}>
              <label>USN NO</label>
              <input
                className={adminStyles.input}
                value={formData.usn}
                onChange={(e) => setFormData(prev => ({ ...prev, usn: e.target.value.toUpperCase() }))}
                placeholder="1MS21CS001"
              />
            </div>
            <div className={adminStyles.formGroup}>
              <label>Name</label>
              <input className={adminStyles.input} value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className={adminStyles.formGroup}>
              <label>Email</label>
              <input className={adminStyles.input} type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="student@example.com" />
            </div>
            <div className={adminStyles.formGroup}>
              <label>Branch</label>
              <select className={adminStyles.input} value={formData.branch} onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}>
                {ALL_BRANCH_DATA.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className={adminStyles.formGroup}>
              <label>{editing ? "New Password (leave blank to keep)" : "Password"}</label>
              <input type="password" className={adminStyles.input} value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} />
            </div>
            <div className={adminStyles.modalActions}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!formData.name || (!editing && (!formData.usn || !formData.password))}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Support Tab ───────────────────────────────────────────────
function SupportTab() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    try {
      const data = await fetchSupportRequests();
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch support requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 10000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateSupportRequestStatus(id, status);
      loadRequests();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  if (loading) return <div style={{ padding: 24 }}><Skeleton height={200} /></div>;

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 600 }}>SOS Command Center</h2>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {requests.filter(r => r.status === "open").length} Open Tickets
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>USN / Email</th>
              <th>Issue Description</th>
              <th>Status</th>
              <th>Date Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No support requests found.</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{r.usn}</td>
                <td style={{ maxWidth: 400, fontSize: 14 }}>{r.problem}</td>
                <td>
                  <span className={`badge ${r.status === 'open' ? 'badge-warning' : r.status === 'resolved' ? 'badge-success' : 'badge-neutral'}`}>
                    {r.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    {r.status !== 'resolved' && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => handleStatusUpdate(r.id, "resolved")}
                      >
                        Resolve
                      </button>
                    )}
                    {r.status !== 'closed' && (
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => handleStatusUpdate(r.id, "closed")}
                      >
                        Close
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
