/* react-doctor-disable no-giant-component, no-inline-exhaustive-style, no-cascading-set-state, rerender-state-only-in-handlers, react-compiler-destructure-method, no-transition-all, no-z-index-9999, nextjs-no-client-side-redirect, client-localstorage-no-version, no-array-index-as-key, click-events-have-key-events, no-static-element-interactions, label-has-associated-control, prefer-useReducer */
"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeAlerts, LiveAlert } from "@/hooks/useRealtimeAlerts";
import { useActiveStudents } from "@/hooks/useActiveStudents";
import { BRANCHES as BRANCH_LIST, BRANCH_IDS } from "@/lib/constants";
import {
  fetchAdminQuestions,
  createAdminQuestion,
  updateAdminQuestion,
  deleteAdminQuestion,
  AdminQuestion,
  ExamConfig,
  fetchPublicExamConfig,
  updateExamConfig,
  deleteAdminFolder,
  renameAdminFolder,
  editAdminFolderBranch,
  uploadQuestionImage,
} from "@/lib/api";
import styles from "./faculty.module.css";
import FacultyQuestionsTab from "@/components/admin/FacultyQuestionsTab";
import FacultyStudentsTab from "@/components/faculty/FacultyStudentsTab";
import LiquidNavbar from "@/components/LiquidNavbar";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

interface FacultyProfile {
  faculty_id: string;
  name: string;
  email: string;
  branches: string[];
}

interface ResultItem {
  id: string;
  student_usn: string;
  student_name: string;
  student_branch: string;
  score: number;
  total_marks: number;
  exam_name: string;
  submitted_at: string;
}

type Tab = "home" | "questions" | "monitor" | "results" | "students";

function getFacultyToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("faculty_token");
}

async function facultyFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getFacultyToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("faculty_token");
      localStorage.removeItem("faculty_profile");
      window.location.reload();
    }
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Login Screen ─────────────────────────────────────────────
function FacultyLogin({ onLogin }: { onLogin: (p: FacultyProfile) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Email and password required."); return; }
    setLoading(true); setError("");
    try {
      const data: any = await facultyFetch("/faculty/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      localStorage.setItem("faculty_token", data.access_token);
      localStorage.setItem("faculty_profile", JSON.stringify({
        faculty_id: data.faculty_id, name: data.name, email: data.email, branches: data.branches,
      }));
      onLogin({ faculty_id: data.faculty_id, name: data.name, email: data.email, branches: data.branches });
    } catch (err: any) {
      setError(err.message || "Login failed.");
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.loginOverlay}>
      <form className={styles.loginCard} onSubmit={handleSubmit}>
        <div className={styles.loginTitle}>Faculty Portal</div>
        {error && <div className={styles.loginError}>{error}</div>}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Email</label>
          <input className={styles.formInput} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="faculty@university.edu" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Password</label>
          <input className={styles.formInput} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <button className={styles.btnPrimary} type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
          {loading ? "Authenticating..." : "Login"}
        </button>
      </form>
    </div>
  );
}

// ── Inline Control Button ────────────────────────────────────
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
      background: variant === "solid" ? color : "rgba(255,255,255,0.04)",
      color: variant === "solid" ? "#fff" : color,
      border: `1px solid ${variant === "solid" ? color : "rgba(255,255,255,0.08)"}`,
      textTransform: "uppercase" as const,
      letterSpacing: "0.02em",
    }}
  >
    <span>{icon}</span> {label}
  </button>
);
// ── Main Dashboard ───────────────────────────────────────────
export default function FacultyDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  const FACULTY_TABS = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "questions", label: "Question Bank", icon: "📝" },
    { id: "monitor", label: "Live Monitor", icon: "📡" },
    { id: "results", label: "Results", icon: "📊" },
    { id: "students", label: "Students", icon: "👥" },
  ];

  // Realtime hooks
  const { alerts, dismissAlert, isConnected: alertsConnected } = useRealtimeAlerts(profile?.branches || []);
  const { activeCount, questionCount } = useActiveStudents(profile?.branches || []);

  // Check stored session
  useEffect(() => {
    const stored = localStorage.getItem("faculty_profile");
    const token = localStorage.getItem("faculty_token");
    if (stored && token) {
      try { setProfile(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // Fetch results when tab changes
  useEffect(() => {
    if (!profile) return;
    if (tab === "results") fetchResults();
  }, [tab, profile]);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await facultyFetch("/faculty/results");
      setResults(data.results || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const handleExport = async () => {
    const token = getFacultyToken();
    const res = await fetch(`${API}/faculty/results/export`, {
      headers: { Authorization: `Bearer ${token || ""}` },
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "results.xlsx"; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("faculty_token");
    localStorage.removeItem("faculty_profile");
    setProfile(null);
  };

  if (!profile) return <FacultyLogin onLogin={setProfile} />;

  return (
    <div className={styles.container}>
      {/* Alert Capsules */}
      <div className={styles.alertContainer}>
        {alerts.map((a: LiveAlert) => (
          <div key={a.id} className={styles.alertCapsule} onClick={() => dismissAlert(a.id)}>
            <span className={styles.alertIcon}>🚨</span>
            <span className={styles.alertText}>{a.message || a.alert_type}</span>
            <button className={styles.alertDismiss} onClick={(e) => { e.stopPropagation(); dismissAlert(a.id); }}>✕</button>
          </div>
        ))}
      </div>

      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.logo}>NEXUS</span>
          <span className={styles.roleBadge}>Faculty</span>
          {alertsConnected && <span className={styles.livePulse}><span className={styles.liveDot} /> Live</span>}
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.facultyName}>{profile.name}</span>
          <div>{profile.branches.map(b => <span key={b} className={styles.branchTag}>{b}</span>)}</div>
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ marginBottom: 24 }}>
        <LiquidNavbar 
          tabs={FACULTY_TABS} 
          activeTab={tab} 
          onTabChange={(id) => setTab(id as Tab)} 
        />
      </div>

      {/* Content */}
      <div className={styles.main}>
        {/* ── HOME TAB ── */}
        {tab === "home" && (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{activeCount}</div>
                <div className={styles.statLabel}>Active Students</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{questionCount}</div>
                <div className={styles.statLabel}>Questions</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{profile.branches.length}</div>
                <div className={styles.statLabel}>Branches</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{alerts.length}</div>
                <div className={styles.statLabel}>Active Alerts</div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>👋 Welcome, {profile.name}</div>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                You are assigned to branches: {profile.branches.map(b => <span key={b} className={styles.branchTag} style={{ marginLeft: 4 }}>{b}</span>)}
              </p>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: 12 }}>
                Use the navigation above to manage questions, monitor live exams, and export results.
              </p>
            </div>
          </>
        )}

        {/* ── QUESTION BANK TAB (Admin-Style Dashboard) ── */}
        {tab === "questions" && (
          <FacultyQuestionsTab branches={profile.branches} profile={profile} />
        )}

        {/* ── LIVE MONITOR TAB ── */}
        {tab === "monitor" && (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{activeCount}</div>
                <div className={styles.statLabel}>Active Connections</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{alerts.length}</div>
                <div className={styles.statLabel}>Pending Alerts</div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>🚨 Entropy Alert Hub</div>
              {alerts.length === 0 ? (
                <div className={styles.emptyState}><div className={styles.emptyIcon}>✅</div><div className={styles.emptyText}>No active alerts — all clear</div></div>
              ) : (
                <table className={styles.resultsTable}>
                  <thead><tr><th>Student</th><th>Type</th><th>Exam</th><th>Branch</th><th>Time</th></tr></thead>
                  <tbody>
                    {alerts.map(a => (
                      <tr key={a.id}>
                        <td>{a.student_usn || a.student_id}</td>
                        <td>{a.alert_type.replace(/_/g, " ")}</td>
                        <td>{a.exam_name}</td>
                        <td><span className={styles.branchTag}>{a.branch}</span></td>
                        <td style={{ fontSize: "0.7rem", color: "#64748b" }}>{a.created_at ? new Date(a.created_at).toLocaleTimeString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── RESULTS TAB ── */}
        {tab === "results" && (
          <div className={styles.card}>
            <div className={styles.cardTitle} style={{ justifyContent: "space-between" }}>
              <span>📊 Student Results ({results.length})</span>
              <button className={styles.exportBtn} onClick={handleExport}>📥 Export XLSX</button>
            </div>
            {loading ? <div className={styles.emptyState}>Loading...</div> : results.length === 0 ? (
              <div className={styles.emptyState}><div className={styles.emptyIcon}>📋</div><div className={styles.emptyText}>No results yet</div></div>
            ) : (
              <table className={styles.resultsTable}>
                <thead><tr><th>USN</th><th>Name</th><th>Branch</th><th>Score</th><th>Total</th><th>%</th><th>Exam</th><th>Submitted</th></tr></thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id}>
                      <td>{r.student_usn}</td>
                      <td>{r.student_name}</td>
                      <td><span className={styles.branchTag}>{r.student_branch}</span></td>
                      <td style={{ fontWeight: 700 }}>{r.score}</td>
                      <td>{r.total_marks}</td>
                      <td>{r.total_marks > 0 ? ((r.score / r.total_marks) * 100).toFixed(1) : 0}%</td>
                      <td>{r.exam_name}</td>
                      <td style={{ fontSize: "0.7rem", color: "#64748b" }}>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "students" && (
          <div className={styles.fadeSlideIn}>
            <FacultyStudentsTab branches={profile.branches} />
          </div>
        )}
      </div>
    </div>
  );
}
