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
} from "@/lib/api";
import { BRANCHES as BRANCH_LIST, BRANCH_IDS } from "@/lib/constants";
import styles from "./admin.module.css";
import adminStyles from "./admin-management.module.css";
import Skeleton from "@/components/Skeleton";

import LeaderboardPage from "./leaderboard/page";
import IngestPage from "./ingest/page";
import OrbitalControl from "./control/page";
import StudentExplorer from "@/components/admin/StudentExplorer";

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
type Tab = "monitor" | "questions" | "students" | "leaderboard" | "ingest" | "control" | "support" | "pyhunt" | "explorer";
const ADMIN_AUTH_KEY = "examguard_admin_auth";

function getStoredAuth(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(ADMIN_AUTH_KEY) === "true"; } catch { return false; }
}

// ── PyHunt Observer Component ──────────────────────────────────
// ── PyHunt Observer Component ──────────────────────────────────
function PyHuntObserver({ students, fetchStudentsGlobal }: { students: AdminStudent[], fetchStudentsGlobal: () => void }) {
  const [activeTab, setActiveTab] = useState('live_status');
  const [odysseyData, setOdysseyData] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchOdyssey = useCallback(async () => {
    setLoading(true);
    const { data, error, status } = await supabase
      .from('odyssey_progress')
      .select('*')
      .order('last_ping', { ascending: false });
    
    // Fetch last violations for each student
    const { data: violData } = await supabase
      .from('violation_history')
      .select('*')
      .order('created_at', { ascending: false });

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
    const sub = supabase.channel('odyssey_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'odyssey_progress' }, () => fetchOdyssey()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchOdyssey]);

  const handleForceUnlock = async (studentId: string, nextRound: number) => {
    await supabase.rpc('force_unlock_round', { target_student_id: studentId, next_round: nextRound });
    fetchOdyssey();
  };

  const handleReExam = async (s: AdminStudent) => {
    if (!confirm(`Reset exam for ${s.name}? This will clear all progress and rounds.`)) return;
    try {
      await resetAdminStudent(s.student_id);
      await supabase.from('odyssey_progress').update({ 
        current_round: 1, 
        round_1_state: { reset: true },
        round_2_state: {},
        round_3_state: {},
        round_4_state: {},
        round_5_state: {},
        is_completed: false,
        error_entropy: 0
      }).eq('student_id', s.student_id);

      fetchStudentsGlobal();
      fetchOdyssey(); 
    } catch (err: any) { alert("Failed to reset: " + err.message); }
  };

  const participants = students
    .map(s => {
      const progress = odysseyData.find(p => p.student_id === s.student_id);
      const lastViol = violations.find(v => v.student_id === s.student_id);
      return {
        ...s,
        pyhunt: progress || null,
        last_violation_record: lastViol || null
      };
    })
    .filter(s => s.exam_name?.toLowerCase() === "pyhunt" || s.pyhunt !== null)
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
    <div className={adminStyles.pyhuntShell} style={{ 
      backgroundImage: 'linear-gradient(to bottom, rgba(2, 6, 23, 0.9), rgba(2, 6, 23, 0.95)), url("https://images.unsplash.com/photo-1511497584788-8767fe771d11?auto=format&fit=crop&q=80")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>
      <header style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#00f2ff' }}>🐍</span> PyHunt Configuration
          </h2>
          <p style={{ opacity: 0.6, fontSize: 14, marginTop: 8 }}>
            Changes are saved to this device's localStorage and immediately visible to students using the same device / browser.
          </p>
        </div>
        <button className={adminStyles.saveAllBtn} onClick={() => alert("All changes synchronized with local storage.")}>
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
             <h3 style={{ fontSize: 18, fontWeight: 800, color: '#00f2ff', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
               🏃 REAL-TIME STUDENT PROGRESS
             </h3>
             <button className={adminStyles.refreshBtn} onClick={fetchOdyssey} disabled={loading}>
                🔄 {loading ? "Syncing..." : "Refresh"}
             </button>
          </div>

          <div className={adminStyles.tableWrapper}>
            <table className={adminStyles.pyhuntTable}>
              <thead>
                <tr>
                  <th>STUDENT NAME</th>
                  <th>ROUND</th>
                  <th>ROUND STATUS</th>
                  <th>WARNINGS</th>
                  <th>LAST VIOLATION</th>
                  <th>LAST ACTIVE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {participants.map(p => (
                  <tr key={p.student_id} className={p.status === 'submitted' ? adminStyles.rowFinished : ""}>
                    <td>
                       <div style={{ fontWeight: 800, color: '#fff' }}>{p.name}</div>
                       <div style={{ fontSize: 11, opacity: 0.5 }}>{p.usn}</div>
                    </td>
                    <td>
                       <span className={adminStyles.roundBadge}>{p.pyhunt?.current_round || 1}</span>
                    </td>
                    <td>
                       <span className={`${adminStyles.statusTag} ${p.status === 'submitted' ? adminStyles.tagSuccess : adminStyles.tagWarning}`}>
                         {p.status === 'submitted' ? "COMPLETED" : "IN PROGRESS"}
                       </span>
                    </td>
                    <td>
                       <span className={adminStyles.warningCount}>{p.warnings}/3</span>
                    </td>
                    <td style={{ color: p.last_violation_record ? '#ff5252' : 'rgba(255,255,255,0.3)' }}>
                       {p.last_violation_record?.type || "-"}
                    </td>
                    <td>
                       {p.pyhunt ? new Date(p.pyhunt.last_ping).toLocaleTimeString() : "—"}
                    </td>
                    <td>
                       <span className={`${adminStyles.liveStatus} ${p.status === 'active' ? adminStyles.statusActive : adminStyles.statusFinished}`}>
                         {p.status === 'submitted' ? "FINISHED" : "ACTIVE"}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PyHuntConfig activeTab={activeTab} />
      )}
    </div>
  );
}

function PyHuntConfig({ activeTab }: { activeTab: string }) {
  const [configs, setConfigs] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pyhunt_config_local");
      if (saved) return JSON.parse(saved);
    }
    return [
      { round: 1, name: "MCQ", clue: "ROUND 1 COMPLETE", code: "LIBRARY42" },
      { round: 2, name: "Jumble", clue: "Round 2 Complete! GOOD JUB NOW FOR 3", code: "LAB2CO" },
      { round: 3, name: "Palindrome", clue: "The mirror speaks the truth.", code: "HEX33" },
      { round: 4, name: "FizzBuzz", clue: "Numbers dance in patterns.", code: "F1ZZ" },
    ];
  });

  const [mcqs, setMcqs] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pyhunt_mcqs_local");
      if (saved) return JSON.parse(saved);
    }
    return [
      { id: 1, question: "What is the output of print(2**3)?", options: ["6", "8", "9", "5"], answer: 1 },
    ];
  });

  const [jumbles, setJumbles] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pyhunt_jumbles_local");
      if (saved) return JSON.parse(saved);
    }
    return [
      { id: 1, blocks: ["def hello():", "  print('world')", "hello()"], target: "def hello():\n  print('world')\nhello()" },
    ];
  });

  const [globalAuth, setGlobalAuth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pyhunt_global_auth");
      if (saved) return JSON.parse(saved);
    }
    return { startCode: "PYHUNT67", authorizedUsns: "" };
  });

  const saveGlobalAuth = (newAuth: any) => {
    setGlobalAuth(newAuth);
    localStorage.setItem("pyhunt_global_auth", JSON.stringify(newAuth));
  };

  const saveConfig = (newConfigs: any) => {
    setConfigs(newConfigs);
    localStorage.setItem("pyhunt_config_local", JSON.stringify(newConfigs));
  };

  const updateConfig = (round: number, field: string, val: string) => {
    const updated = configs.map((c: any) => c.round === round ? { ...c, [field]: val } : c);
    saveConfig(updated);
  };

  const saveMcqs = (newMcqs: any) => {
    setMcqs(newMcqs);
    localStorage.setItem("pyhunt_mcqs_local", JSON.stringify(newMcqs));
  };

  const addMcq = () => {
    saveMcqs([...mcqs, { id: Date.now(), question: "", options: ["", "", "", ""], answer: 0 }]);
  };

  const updateMcq = (id: number, field: string, val: any) => {
    saveMcqs(mcqs.map((q: any) => q.id === id ? { ...q, [field]: val } : q));
  };

  const removeMcq = (id: number) => {
    saveMcqs(mcqs.filter((q: any) => q.id !== id));
  };

  const saveJumbles = (newJumbles: any) => {
    setJumbles(newJumbles);
    localStorage.setItem("pyhunt_jumbles_local", JSON.stringify(newJumbles));
  };

  return (
    <div className={adminStyles.configContent}>
      {activeTab === "clues" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className={adminStyles.configCard}>
            <h4 style={{ margin: '0 0 16px 0', color: '#00f2ff', fontSize: 16 }}>🌍 GLOBAL PROTOCOL</h4>
            <div className={adminStyles.inputGroup}>
              <label className={adminStyles.inputLabel}>INITIAL ACCESS CODE (ORBIT 0)</label>
              <input
                className={adminStyles.configInput}
                value={globalAuth.startCode}
                onChange={(e) => saveGlobalAuth({ ...globalAuth, startCode: e.target.value })}
              />
            </div>
          </div>
          {configs.map((c: any) => (
            <div key={c.round} className={adminStyles.configCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h4 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 800 }}>Phase {c.round}: {c.name}</h4>
                <div className={adminStyles.codeBadge}>🔒 GATE KEY: {c.code || "PENDING"}</div>
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>TRANSMISSION HINT (VISIBLE AFTER ROUND)</label>
                <textarea
                  className={adminStyles.configTextarea}
                  value={c.clue}
                  onChange={(e) => updateConfig(c.round, 'clue', e.target.value)}
                />
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>ORBITAL UNLOCK CODE</label>
                <input
                  type="text"
                  className={adminStyles.configInput}
                  value={c.code}
                  onChange={(e) => updateConfig(c.round, 'code', e.target.value)}
                />
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
                <button onClick={() => removeMcq(q.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>DELETE</button>
              </div>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>QUESTION TEXT</label>
                <input
                  className={adminStyles.configInput}
                  value={q.question}
                  onChange={(e) => updateMcq(q.id, 'question', e.target.value)}
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
          <h4 style={{ color: '#fff', margin: 0 }}>Code Jumble Parameters (Round 2)</h4>
          {jumbles.map((j: any) => (
            <div key={j.id} className={adminStyles.configCard}>
              <div className={adminStyles.inputGroup}>
                <label className={adminStyles.inputLabel}>TARGET CODE STRUCTURE (USE NEWLINES)</label>
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

      {["r3", "r4"].includes(activeTab) && (
        <div style={{ padding: 100, textAlign: 'center', opacity: 0.3 }}>
          <h3 style={{ fontSize: 24, fontWeight: 900 }}>Module Calibrating</h3>
          <p>Specific parameter configuration for this logic orbit is being integrated.</p>
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
            transition: "all 0.3s ease",
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
        {error && <span style={{ fontSize: 11, color: "#f87171" }}>{error}</span>}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "4px 8px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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

  const fetchStudents = useCallback(async () => {
    try {
      const data = await fetchAdminStudents();
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
            const config = configs.find(c => c.exam_title === q.exam_name);
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
          if (!list.find(x => x.exam_name === (c.exam_title || c.exam_name))) {
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

    const statusInterval = setInterval(fetchStudents, 5000);
    const discoveryInterval = setInterval(syncEverything, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(statusInterval);
      clearInterval(discoveryInterval);
    };
  }, [authed, fetchStudents]);

  const handleCleanup = async () => {
    if (!confirm("This will reset all sessions idle for > 4 hours to 'Not Started'. Continue?")) return;
    setLoading(true);
    try {
      const { count } = await cleanupStaleSessions();
      alert(`Successfully cleaned up ${count} stale sessions.`);
      fetchStudents();
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
      fetchStudents();
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
          backdropFilter: "blur(20px)",
          borderRadius: 24,
          padding: "48px 40px",
          width: "100%",
          maxWidth: 400,
        }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "#e2e8f0", marginBottom: 8 }}>
              EXAM Admin
            </h1>
            <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>ExamGuard Control Node — Staff Only</p>
          </div>
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              id="admin-password-input"
              type="password"
              className={adminStyles.input}
              placeholder="Admin password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              style={{
                background: "rgba(255,255,255,0.08) !important",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#ffffff !important"
              }}
            />
            {passError && <p className="text-danger" style={{ fontSize: 13 }}>{passError}</p>}
            <button type="submit" className="btn btn-primary btn-lg" style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", border: "none", borderRadius: 12 }}>
              Access Command Node
            </button>
          </form>
        </div>
      </div>
    );
  }

  const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
    { id: "monitor", label: "Monitor", icon: "📡" },
    { id: "pyhunt", label: "PyHunt", icon: "🐍" },
    { id: "explorer", label: "Explorer", icon: "🛰️" },
    { id: "support", label: "SOS", icon: "🆘" },
    { id: "leaderboard", label: "Leaderboard", icon: "⚡" },
    { id: "questions", label: "Questions", icon: "📋" },
    { id: "students", label: "Students", icon: "👥" },
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
              <p className={styles.subtitle} style={{ fontSize: 11 }}>
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
                  <span style={{ fontWeight: 800, fontSize: 16 }}>Command Center</span>
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
      {activeTab === "pyhunt" && (
        <PyHuntObserver students={students} fetchStudentsGlobal={fetchStudents} />
      )}
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
                background: "rgba(25,118,210,0.1)",
                border: "1px solid rgba(25,118,210,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>👥</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1 }}>
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
                background: "rgba(237,108,2,0.1)",
                border: "1px solid rgba(237,108,2,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>⚠️</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--warning)", lineHeight: 1 }}>
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
                background: "rgba(46,125,50,0.1)",
                border: "1px solid rgba(46,125,50,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>✅</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--success)", lineHeight: 1 }}>
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
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  🛰️ Network Channels
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.6 }}>
                  Manage activation in the "Control" tab
                </span>
              </div>
              {Array.from(new Set(quizzes.map(q => q.exam_name))).map(name => {
                const q = quizzes.find(x => x.exam_name === name);
                const isActive = (q as any)?.is_active;
                return (
                  <div key={name} style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${isActive ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)"}`,
                    borderRadius: 12,
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "all 0.3s ease"
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: isActive ? "#34d399" : "#ef4444",
                      boxShadow: isActive ? "0 0 10px rgba(52,211,153,0.5)" : "none"
                    }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {name}
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                        <span style={{ fontSize: 10, opacity: 0.6 }}>{q?.question_count || 0} Questions</span>
                        <span style={{
                          fontSize: 10,
                          color: isActive ? "#34d399" : "#ef4444",
                          fontWeight: 800,
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
                    <th>Branch</th><th>Status</th><th>Start Time</th><th>Total Time</th>
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
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: s.exam_name === "PyHunt" ? "rgba(0, 242, 255, 0.1)" : "rgba(139, 92, 246, 0.1)",
                          color: s.exam_name === "PyHunt" ? "#00f2ff" : "#a78bfa",
                          border: `1px solid ${s.exam_name === "PyHunt" ? "rgba(0, 242, 255, 0.2)" : "rgba(139, 92, 246, 0.2)"}`,
                          textTransform: 'uppercase'
                        }}>
                          {s.exam_name || "—"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.email || "—"}</td>
                      <td><span className="badge badge-neutral">{s.branch}</span></td>
                      <td><StatusBadge status={s.status} lastActive={s.last_active} /></td>
                      <td style={{ fontSize: 12 }}>{s.started_at ? new Date(s.started_at).toLocaleTimeString() : "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{getElapsedTime(s.started_at, s.submitted_at)}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString() : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {s.status === "active" && (
                            <button className="btn btn-outline" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => handleForceSubmit(s)}>
                              Submit
                            </button>
                          )}
                          <button className="btn btn-outline" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => resetAdminStudent(s.student_id).then(fetchStudents)}>
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
            background: alerts.length > 0 ? "rgba(239, 68, 68, 0.1)" : "var(--bg-secondary)",
            color: alerts.length > 0 ? "#f87171" : "var(--text-muted)",
            border: alerts.length > 0 ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid var(--border)",
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
                  background: i % 2 === 0 ? "var(--bg-card)" : "rgba(255,255,255,0.02)",
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
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 2 }}>
                    {alert.student_name}
                    <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{alert.usn}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#f87171", fontWeight: 600, marginBottom: 2 }}>
                    {alert.type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    Mission: {alert.exam_name} • {new Date(alert.created_at).toLocaleTimeString()}
                  </div>
                </div>

                {/* Counter index (descending) */}
                <div style={{
                  fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.2)",
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
function StatusBadge({ status, lastActive }: { status: string; lastActive: string | null }) {
  const idle = lastActive ? (Date.now() - new Date(lastActive).getTime()) > 60_000 : false;
  if (status === "submitted") return <span className="badge badge-success">✓ Submitted</span>;
  if (status === "active" && idle) return <span className="badge badge-warning">⏸ Idle</span>;
  if (status === "active") return <span className="badge badge-success">● Active</span>;
  return <span className="badge badge-neutral">○ Not Started</span>;
}

function WarningBadge({ count }: { count: number }) {
  if (count === 0) return <span className="badge badge-neutral">0</span>;
  if (count === 1) return <span className="badge badge-warning">⚠ 1</span>;
  if (count === 2) return <span className="badge" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>⚠ 2</span>;
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
    audio_url: ""
  });
  const [folderBranchModal, setFolderBranchModal] = useState<{ name: string, branches: string[] } | null>(null);
  const [formCategory, setFormCategory] = useState<"aptitude" | "programming" | "other">("other");


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

  const handleSave = async () => {
    if (!formData.text) return alert("Please enter question text");
    if (formData.options.some((o) => !o)) return alert("All options must be filled");
    if (!formData.correct_answer) return alert("Please select a correct answer");
    if (!formData.branch) return alert("Please select a branch");
    try {
      const payload = { ...formData, category: formCategory };
      if (editing) await updateAdminQuestion(editing.id, payload);
      else await createAdminQuestion(payload);
      setShowModal(false); setEditing(null);
      setFormData({ text: "", options: ["", "", "", ""], branch: "CS", correct_answer: "", order_index: questions.length, marks: 1, exam_name: "General Assessment", image_url: "", audio_url: "" });
      setFormCategory("other");
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
      if (!configs.find(c => c.exam_title === title)) {
        load();
      }
    } catch (error) {
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };
  // ── Category classification ──
  function getCategory(examName: string): "aptitude" | "programming" | "other" {
    const n = examName.toLowerCase();
    if (n.includes("aptitude") || n.includes("quant") || n.includes("reasoning") || n.includes("logical") || n.includes("verbal") || n.includes("english") || n.includes("comprehension") || n.includes("maths") || n.includes("numerical")) return "aptitude";
    if (n.includes("program") || n.includes("code") || n.includes("coding") || n.includes("dsa") || n.includes("algorithm") || n.includes("data structure") || n.includes("python") || n.includes("java") || n.includes("c++") || n.includes("javascript")) return "programming";
    return "other";
  }

  // New: prefer q.category, fallback to inference
  const getQCategory = (q: AdminQuestion) => q.category || getCategory(q.exam_name || "");

  const filteredQuestions = questions.filter((q) => {
    const branchMatch = selectedBranch === "All" || q.branch === selectedBranch;
    const categoryMatch = selectedCategory === "all" || getQCategory(q) === selectedCategory;

    if (selectedStatus === "all") return branchMatch && categoryMatch;

    const conf = configs.find(c => c.exam_title === q.exam_name);
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

  // Palette for category cards — cycles through 4 colors
  const CARD_PALETTE = [
    { bg: "rgba(25,118,210,0.06)", border: "rgba(25,118,210,0.25)", accent: "#1565c0", icon: "📐", skillColor: "rgba(25,118,210,0.1)", skillText: "#1565c0" },
    { bg: "rgba(103,58,183,0.06)", border: "rgba(103,58,183,0.25)", accent: "#6a1b9a", icon: "🧠", skillColor: "rgba(103,58,183,0.1)", skillText: "#6a1b9a" },
    { bg: "rgba(27,153,105,0.06)", border: "rgba(27,153,105,0.25)", accent: "#1b5e20", icon: "📖", skillColor: "rgba(27,153,105,0.1)", skillText: "#1b5e20" },
    { bg: "rgba(230,119,14,0.06)", border: "rgba(230,119,14,0.25)", accent: "#e65100", icon: "💻", skillColor: "rgba(230,119,14,0.1)", skillText: "#e65100" },
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
    Easy: { bg: "rgba(46,125,50,0.1)", text: "#2e7d32" },
    Medium: { bg: "rgba(237,108,2,0.1)", text: "#e65100" },
    Hard: { bg: "rgba(211,47,47,0.1)", text: "#c62828" },
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
        <button className="btn btn-primary" onClick={() => { setEditing(null); setFormCategory("other"); setFormData({ text: "", options: ["", "", "", ""], branch: "CS", correct_answer: "", order_index: questions.length, marks: 1, exam_name: "General Assessment", image_url: "", audio_url: "" }); setShowModal(true); }}>
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
              border: selectedCategory === cat.key ? '2px solid #4f46e5' : '1px solid #e2e8f0',
              background: selectedCategory === cat.key ? '#eef2ff' : '#fff',
              color: selectedCategory === cat.key ? '#4f46e5' : '#64748b',
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
              border: selectedStatus === stat.key ? '2px solid #10b981' : '1px solid #e2e8f0',
              background: selectedStatus === stat.key ? '#ecfdf5' : 'transparent',
              color: selectedStatus === stat.key ? '#059669' : '#64748b',
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
                      background: palette.bg,
                      border: `1.5px solid ${palette.border}`,
                      borderRadius: 18,
                      padding: "24px 24px 20px",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      transition: "box-shadow 0.2s, transform 0.2s",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    whileHover={{ y: -3, boxShadow: `0 8px 24px ${palette.border}` }}
                    onClick={() => toggleCluster(clusterKey)}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 22 }}>{palette.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: palette.accent, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
                          {name} <small style={{ fontWeight: 400, opacity: 0.7 }}>({branch})</small>
                        </div>
                      </div>

                      {/* Activation & Status Indicators */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 12 }} onClick={e => e.stopPropagation()}>
                        {(() => {
                          const conf = configs.find(c => c.exam_title === name);
                          const isManualActive = conf ? conf.is_active : true;

                          const now = Date.now();
                          const start = conf?.scheduled_start ? new Date(conf.scheduled_start).getTime() : 0;
                          const end = conf?.scheduled_end ? new Date(conf.scheduled_end).getTime() : Infinity;

                          let statusLabel = "Active";
                          let statusColor = "#34d399";
                          let statusIcon = "🟢";

                          if (!isManualActive) {
                            statusLabel = "Inactive";
                            statusColor = "#94a3b8";
                            statusIcon = "🚫";
                          } else if (now < start) {
                            statusLabel = "Upcoming";
                            statusColor = "#fbbf24";
                            statusIcon = "🟡";
                          } else if (now > end) {
                            statusLabel = "Expired";
                            statusColor = "#f87171";
                            statusIcon = "⚪";
                          }

                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              {/* Real-time Status Badge */}
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 12px",
                                borderRadius: "12px",
                                background: `${statusColor}15`,
                                border: `1px solid ${statusColor}30`,
                                color: statusColor,
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.02em"
                              }}>
                                {statusIcon} {statusLabel}
                              </div>

                              {/* Manual Toggle Switch */}
                              <div style={{
                                display: "flex",
                                background: "rgba(0,0,0,0.04)",
                                padding: "2px",
                                borderRadius: "20px",
                                border: "1px solid rgba(0,0,0,0.06)"
                              }}>
                                <button
                                  onClick={() => !isManualActive && toggleActivation(name, false)}
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 800,
                                    padding: "3px 8px",
                                    borderRadius: "16px",
                                    border: "none",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    background: isManualActive ? "#10b981" : "transparent",
                                    color: isManualActive ? "#fff" : "#64748b",
                                  }}
                                >ON</button>
                                <button
                                  onClick={() => isManualActive && toggleActivation(name, true)}
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 800,
                                    padding: "3px 8px",
                                    borderRadius: "16px",
                                    border: "none",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    background: !isManualActive ? "#f43f5e" : "transparent",
                                    color: !isManualActive ? "#fff" : "#64748b",
                                  }}
                                >OFF</button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {!expandedClusters[clusterKey] && (
                        <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button
                            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, border: `1px solid ${palette.border}`, background: "transparent", color: palette.accent, cursor: "pointer", fontWeight: 600 }}
                            onClick={(e) => { e.stopPropagation(); handleRenameFolder(name); }}
                          >Rename</button>
                          <button
                            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, border: `1px solid ${palette.border}`, background: "transparent", color: palette.accent, cursor: "pointer", fontWeight: 600 }}
                            onClick={(e) => { e.stopPropagation(); handleEditBranchFolder(name); }}
                          >Edit Branch</button>
                          <button
                            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, border: "1px solid rgba(211,47,47,0.3)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontWeight: 600 }}
                            onClick={(e) => { e.stopPropagation(); handleDeleteFolder(name); }}
                          >Delete</button>
                        </div>
                      )}
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
                      <div style={{ fontSize: 11, fontWeight: 700, color: palette.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
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
                                <div className={adminStyles.cardIndex} style={{ fontSize: 11, fontWeight: 700, color: palette.accent }}>Q{q.order_index + 1}</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button className="btn-icon" onClick={() => { setEditing(q); setFormData({ ...q }); setFormCategory((q.category as any) || 'other'); setShowModal(true); }}>✏️</button>
                                  <button className="btn-icon btn-danger" onClick={() => handleDelete(q.id)}>🗑️</button>
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
                                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{q.branch}</span>
                                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{q.marks} Marks</span>
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
        <div className={adminStyles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={adminStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit Question" : "Add Question"}</h3>
            <div className={adminStyles.formGroup}>
              <label>Question Text</label>
              <textarea className={adminStyles.input} value={formData.text} onChange={(e) => setFormData({ ...formData, text: e.target.value })} rows={3} />
            </div>
            <div className={adminStyles.formGroup}>
              <label>Options</label>
              {formData.options.map((opt, i) => (
                <input key={i} className={adminStyles.input} placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                  onChange={(e) => { const n = [...formData.options]; n[i] = e.target.value; setFormData({ ...formData, options: n }); }} />
              ))}
            </div>
            <div className={adminStyles.formRow}>
              <div className={adminStyles.formGroup}>
                <label>Order Index</label>
                <input type="number" className={adminStyles.input} value={formData.order_index} onChange={(e) => setFormData({ ...formData, order_index: +e.target.value })} />
              </div>
              <div className={adminStyles.formGroup}>
                <label>Marks</label>
                <input type="number" className={adminStyles.input} value={formData.marks} onChange={(e) => setFormData({ ...formData, marks: +e.target.value })} />
              </div>
              <div className={adminStyles.formGroup}>
                <label>Correct Answer</label>
                <select className={adminStyles.input} value={formData.correct_answer} onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}>
                  <option value="">Select correct option…</option>
                  {formData.options.map((_, i) => <option key={i} value={String.fromCharCode(65 + i)}>Option {String.fromCharCode(65 + i)}</option>)}
                </select>
              </div>
              <div className={adminStyles.formGroup}>
                <label>Exam Identity (Anchor)</label>
                <select
                  className={adminStyles.input}
                  value={Array.from(new Set(questions.map(q => q.exam_name))).includes(formData.exam_name) ? formData.exam_name : "NEW_IDENTITY"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "NEW_IDENTITY") {
                      setFormData({ ...formData, exam_name: "" });
                    } else {
                      setFormData({ ...formData, exam_name: val });
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
                    onChange={(e) => setFormData({ ...formData, exam_name: e.target.value })}
                  />
                )}
              </div>
              <div className={adminStyles.formGroup}>
                <label>Branch</label>
                <select className={adminStyles.input} value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })}>
                  {ALL_BRANCH_DATA.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className={adminStyles.formGroup}>
                <label>Category</label>
                <select
                  className={adminStyles.input}
                  style={{
                    height: "44px",
                    fontSize: "15px",
                    fontWeight: "600",
                    background: "rgba(139, 92, 246, 0.12) !important",
                    border: "1.5px solid rgba(139, 92, 246, 0.3)",
                    color: "#ffffff",
                    cursor: "pointer"
                  }}
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                >
                  <option value="aptitude">🧠 Aptitude</option>
                  <option value="programming">💻 Programming</option>
                  <option value="other">📂 Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div className={adminStyles.formGroup}>
                <label>Image Asset (Optional)</label>
                {formData.image_url ? (
                  <div className={adminStyles.imagePreviewContainer}>
                    <img src={formData.image_url} alt="Question" className={adminStyles.imagePreview} />
                    <button
                      className={adminStyles.removeImageBtn}
                      onClick={() => setFormData({ ...formData, image_url: "" })}
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
                          setFormData({ ...formData, image_url: url });
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
                      onClick={() => setFormData({ ...formData, audio_url: "" })}
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
                          // Using same upload logic for audio, Cloudinary handles it
                          const url = await uploadQuestionImage(file);
                          setFormData({ ...formData, audio_url: url });
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
              <button className="btn btn-primary" onClick={handleSave} disabled={!formData.text || !formData.correct_answer || formData.options.some((o) => !o)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {folderBranchModal && (
        <div className={adminStyles.modalOverlay} onClick={() => setFolderBranchModal(null)}>
          <div className={adminStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
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
                background: "rgba(255,255,255,0.03)",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.1)",
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
                      background: isChecked ? "rgba(139, 92, 246, 0.15)" : "transparent",
                      border: isChecked ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid transparent",
                      transition: "all 0.2s ease"
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
                        color: isChecked ? "#ffffff" : "rgba(255,255,255,0.6)",
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

    </div>
  );
}

// ── Students Tab ──────────────────────────────────────────────
function StudentsTab({ students, load }: { students: AdminStudent[], load: () => Promise<void> }) {
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
                      <span className="badge badge-danger" style={{ background: "rgba(211, 47, 47, 0.2)", color: "#ff5252", border: "1px solid #ff5252" }}>Blocked</span>
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
                        const match = ALL_BRANCH_DATA.find(b => b.name === bID || b.id === bID);
                        if (match) bID = match.id;

                        setEditing(s as any);
                        setFormData({ usn: s.usn, name: s.name, email: s.email || "", branch: bID, password: "" });
                        setShowModal(true);
                      }}>Edit</button>
                      <button className="btn btn-outline" onClick={() => { const p = prompt("Enter new password:"); if (p) updateAdminStudent(s.student_id, { password: p }).then(() => alert("Password reset")); }}>Reset PW</button>
                      <button className="btn btn-outline" style={{ color: "var(--accent)", borderColor: "var(--accent)" }} onClick={() => handleResetExam(s.student_id)}>Re-Exam</button>
                      <button className="btn btn-outline" style={{ color: "#00f2ff", borderColor: "#00f2ff" }} onClick={() => window.open(`/admin/students/${s.student_id}`, '_blank')}>View Pulse</button>
                      <button
                        className="btn btn-outline"
                        style={{
                          color: s.is_blocked ? "#4caf50" : "#ff5252",
                          borderColor: s.is_blocked ? "#4caf50" : "#ff5252",
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
        <div className={adminStyles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={adminStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit Student" : "Add Student"}</h3>
            <div className={adminStyles.formGroup}>
              <label>USN NO</label>
              <input
                className={adminStyles.input}
                value={formData.usn}
                onChange={(e) => setFormData({ ...formData, usn: e.target.value.toUpperCase() })}
                placeholder="1MS21CS001"
              />
            </div>
            <div className={adminStyles.formGroup}>
              <label>Name</label>
              <input className={adminStyles.input} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className={adminStyles.formGroup}>
              <label>Email</label>
              <input className={adminStyles.input} type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="student@example.com" />
            </div>
            <div className={adminStyles.formGroup}>
              <label>Branch</label>
              <select className={adminStyles.input} value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })}>
                {ALL_BRANCH_DATA.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className={adminStyles.formGroup}>
              <label>{editing ? "New Password (leave blank to keep)" : "Password"}</label>
              <input type="password" className={adminStyles.input} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
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
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>SOS Command Center</h2>
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
                        style={{ fontSize: 11, padding: "4px 10px" }}
                        onClick={() => handleStatusUpdate(r.id, "resolved")}
                      >
                        Resolve
                      </button>
                    )}
                    {r.status !== 'closed' && (
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: 11, padding: "4px 10px" }}
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
