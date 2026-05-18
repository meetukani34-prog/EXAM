/* react-doctor-disable no-giant-component, no-inline-exhaustive-style, no-cascading-set-state, rerender-state-only-in-handlers, react-compiler-destructure-method, no-transition-all, no-z-index-9999, nextjs-no-client-side-redirect, client-localstorage-no-version */
"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeAlerts, LiveAlert } from "@/hooks/useRealtimeAlerts";
import { useActiveStudents } from "@/hooks/useActiveStudents";
import { BRANCHES } from "@/lib/constants";
import styles from "./faculty.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

interface FacultyProfile {
  faculty_id: string;
  name: string;
  email: string;
  branches: string[];
}

interface QuestionItem {
  id: string;
  text: string;
  options: string[];
  correct_answer: string;
  branch: string;
  exam_name: string;
  marks: number;
  order_index: number;
  category?: string;
  programming_type?: string;
  starter_code?: string;
  test_cases?: string;
  target_output?: string;
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

type Tab = "home" | "questions" | "monitor" | "results";

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

// ── Main Dashboard ───────────────────────────────────────────
export default function FacultyDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedQ, setSelectedQ] = useState<QuestionItem | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(false);

  // Realtime hooks
  const { alerts, dismissAlert, isConnected: alertsConnected } = useRealtimeAlerts(profile?.branches || []);
  const { activeCount } = useActiveStudents(profile?.branches || []);

  // Check stored session
  useEffect(() => {
    const stored = localStorage.getItem("faculty_profile");
    const token = localStorage.getItem("faculty_token");
    if (stored && token) {
      try { setProfile(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // Fetch questions when tab changes
  useEffect(() => {
    if (!profile) return;
    if (tab === "questions") fetchQuestions();
    if (tab === "results") fetchResults();
  }, [tab, profile]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await facultyFetch("/faculty/questions");
      setQuestions(data.questions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

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

  const filteredQ = questions.filter(q =>
    q.text.toLowerCase().includes(searchQ.toLowerCase()) ||
    q.exam_name.toLowerCase().includes(searchQ.toLowerCase())
  );

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
      <div className={styles.nav}>
        {(["home", "questions", "monitor", "results"] as Tab[]).map(t => (
          <button key={t} className={tab === t ? styles.navBtnActive : styles.navBtn} onClick={() => setTab(t)}>
            {t === "home" ? "🏠 Home" : t === "questions" ? "📝 Question Bank" : t === "monitor" ? "📡 Live Monitor" : "📊 Results"}
          </button>
        ))}
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
                <div className={styles.statValue}>{questions.length || "—"}</div>
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

        {/* ── QUESTION BANK TAB ── */}
        {tab === "questions" && (
          <div className={styles.splitPane}>
            <div className={styles.questionList}>
              <div className={styles.questionListHeader}>
                <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Questions ({filteredQ.length})</span>
                <button className={styles.btnPrimary} style={{ padding: "6px 14px", fontSize: "0.75rem" }} onClick={() => setSelectedQ({ id: "", text: "", options: ["", "", "", ""], correct_answer: "A", branch: profile.branches[0] || "CS", exam_name: "", marks: 1, order_index: questions.length + 1 })}>
                  + New
                </button>
              </div>
              <input className={styles.searchInput} placeholder="Search questions..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              {filteredQ.map(q => (
                <div key={q.id} className={selectedQ?.id === q.id ? styles.questionItemActive : styles.questionItem} onClick={() => setSelectedQ(q)}>
                  <div className={styles.questionItemTitle}>{q.text.substring(0, 60)}...</div>
                  <div className={styles.questionItemMeta}>
                    <span className={styles.branchTag}>{q.branch}</span>
                    <span>{q.exam_name}</span>
                    <span>{q.marks} marks</span>
                  </div>
                </div>
              ))}
              {filteredQ.length === 0 && <div className={styles.emptyState}><div className={styles.emptyIcon}>📭</div><div className={styles.emptyText}>No questions found</div></div>}
            </div>
            <div className={styles.editorPane}>
              {selectedQ ? <QuestionEditor question={selectedQ} branches={profile.branches} onSaved={() => { fetchQuestions(); setSelectedQ(null); }} /> : (
                <div className={styles.emptyState}><div className={styles.emptyIcon}>✏️</div><div className={styles.emptyText}>Select a question or create a new one</div></div>
              )}
            </div>
          </div>
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
      </div>
    </div>
  );
}

// ── Question Editor Component ────────────────────────────────
function QuestionEditor({ question, branches, onSaved }: { question: QuestionItem; branches: string[]; onSaved: () => void }) {
  const [form, setForm] = useState(question);
  const [saving, setSaving] = useState(false);
  const isNew = !question.id;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await facultyFetch("/faculty/questions", { method: "POST", body: JSON.stringify(form) });
      } else {
        await facultyFetch(`/faculty/questions/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
      }
      onSaved();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this question?")) return;
    try {
      await facultyFetch(`/faculty/questions/${form.id}`, { method: "DELETE" });
      onSaved();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Question Text</label>
        <textarea className={styles.formTextarea} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Branch</label>
          <select className={styles.formSelect} value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })}>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Exam Name</label>
          <input className={styles.formInput} value={form.exam_name} onChange={e => setForm({ ...form, exam_name: e.target.value })} />
        </div>
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Marks</label>
          <input className={styles.formInput} type="number" value={form.marks} onChange={e => setForm({ ...form, marks: Number(e.target.value) })} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Correct Answer</label>
          <select className={styles.formSelect} value={form.correct_answer} onChange={e => setForm({ ...form, correct_answer: e.target.value })}>
            {["A", "B", "C", "D"].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      {(form.options || []).map((opt, i) => (
        <div className={styles.formGroup} key={i}>
          <label className={styles.formLabel}>Option {String.fromCharCode(65 + i)}</label>
          <input className={styles.formInput} value={opt} onChange={e => { const newOpts = [...form.options]; newOpts[i] = e.target.value; setForm({ ...form, options: newOpts }); }} />
        </div>
      ))}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Category</label>
        <select className={styles.formSelect} value={form.category || "aptitude"} onChange={e => setForm({ ...form, category: e.target.value })}>
          <option value="aptitude">Aptitude</option><option value="programming">Programming</option><option value="other">Other</option>
        </select>
      </div>
      {form.category === "programming" && (
        <>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Starter Code (Python)</label>
            <textarea className={styles.formTextarea} value={form.starter_code || ""} onChange={e => setForm({ ...form, starter_code: e.target.value })} placeholder="def solution():&#10;    pass" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Test Cases (JSON)</label>
            <textarea className={styles.formTextarea} value={form.test_cases || ""} onChange={e => setForm({ ...form, test_cases: e.target.value })} placeholder='[{"input": "5", "expected": "25"}]' />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Target Output</label>
            <input className={styles.formInput} value={form.target_output || ""} onChange={e => setForm({ ...form, target_output: e.target.value })} />
          </div>
        </>
      )}
      <div className={styles.btnGroup}>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? "Saving..." : isNew ? "Create Question" : "Update Question"}</button>
        {!isNew && <button className={styles.btnDanger} onClick={handleDelete}>Delete</button>}
      </div>
    </>
  );
}
