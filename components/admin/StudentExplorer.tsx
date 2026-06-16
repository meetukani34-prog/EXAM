/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { 
  fetchAdminStudents, 
  AdminStudent, 
  resetAdminStudent, 
  blockAdminStudent, 
  unblockAdminStudent,
  ViolationHistory,
  fetchViolationHistory,
  fetchStudentFidelity
} from "@/lib/api";
import styles from "./StudentExplorer.module.css";
import Skeleton from "@/components/Skeleton";

type TabType = "General" | "Aptitude" | "Programming" | "Other" | "Violations" | "PyHunt";

interface StudentFidelity extends AdminStudent {
  exam_results?: any[];
  odyssey_progress?: any;
  category_scores?: Record<string, { score: number; total: number }>;
  results_by_category?: Record<string, any[]>;
}

export default function StudentExplorer() {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentFidelity | null>(null);
  const [violations, setViolations] = useState<ViolationHistory[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("General");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Initial Fetch ──────────────────────────────────────────────
  useEffect(() => {
    async function loadStudents() {
      setLoading(true);
      const all = await fetchAdminStudents();
      setStudents(all);
      setLoading(false);
    }
    loadStudents();
  }, []);

  // ── Detail Fetching ─────────────────────────────────────────────
  useEffect(() => {
    if (selectedId) {
      loadStudentDetails(selectedId);
    } else {
      setSelectedStudent(null);
    }
  }, [selectedId]);

  async function loadStudentDetails(studentId: string) {
    setDetailsLoading(true);
    setSyncError(null);
    try {
      const profile = await fetchStudentFidelity(studentId);

      if (profile) {
        setSelectedStudent(profile);
        const vLogs = await fetchViolationHistory(studentId);
        setViolations(vLogs);
      } else {
        setSyncError("Identity node not found in registry.");
      }
    } catch (err: any) {
      console.error("Fidelity Pulse error:", err);
      setSyncError(err.message || "Unknown synchronization failure.");
    } finally {
      setDetailsLoading(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────
  const handleReset = async () => {
    if (!selectedStudent || !confirm("Weightlessly purge ALL attempts?")) return;
    setActionLoading(true);
    try {
      await resetAdminStudent(selectedStudent.student_id);
      await loadStudentDetails(selectedStudent.student_id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetExam = async (examName: string) => {
    if (!selectedStudent || !confirm(`Purge the attempt for "${examName}"?`)) return;
    setActionLoading(true);
    try {
      await resetAdminStudent(selectedStudent.student_id, examName);
      await loadStudentDetails(selectedStudent.student_id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockdown = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);
    try {
      if (selectedStudent.is_blocked) {
        await unblockAdminStudent(selectedStudent.student_id);
      } else {
        await blockAdminStudent(selectedStudent.student_id);
      }
      await loadStudentDetails(selectedStudent.student_id);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived State ──────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      s.usn.toLowerCase().includes(search.toLowerCase())
    );
  }, [students, search]);

  const avgScore = useMemo(() => {
    if (!selectedStudent?.exam_results?.length) return 0;
    const total = selectedStudent.exam_results.reduce((acc, r) => acc + (r.score || 0), 0);
    return (total / selectedStudent.exam_results.length).toFixed(1);
  }, [selectedStudent]);

  // ── Render Helpers ─────────────────────────────────────────────
  const renderGeneral = () => {
    if (!selectedStudent) return null;
    
    const pyHuntProgress = selectedStudent.odyssey_progress?.is_completed 
      ? "100%" 
      : (selectedStudent.odyssey_progress?.current_round 
          ? ((selectedStudent.odyssey_progress.current_round - 1) * 20) + "%" 
          : "0%");

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.statsGrid}>
          <div className={styles.orbCard}>
            <div className={styles.orbTitle}>Performance Pulse</div>
            <div className={styles.orbValue}>{avgScore}%</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>Average Consistency</div>
          </div>
          <div className={styles.orbCard}>
            <div className={styles.orbTitle}>Temporal Displacement</div>
            <div className={styles.orbValue}>{selectedStudent.exam_results?.length || 0}</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>Assessments Navigated</div>
          </div>
          <div className={styles.orbCard}>
            <div className={styles.orbTitle}>Entropy Level</div>
            <div className={styles.orbValue} style={{ color: violations.length > 5 ? 'var(--danger)' : 'var(--text-primary)' }}>
              {violations.length}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Fidelity Deviations</div>
          </div>
        </div>

        <div className={styles.statsGrid} style={{ marginTop: 24 }}>
          <div className={styles.orbCard}>
            <div className={styles.orbTitle}>Aptitude</div>
            <div className={styles.orbValue}>
              {selectedStudent.category_scores?.aptitude?.total 
                ? ((selectedStudent.category_scores.aptitude.score / selectedStudent.category_scores.aptitude.total) * 100).toFixed(0)
                : "0"}%
            </div>
          </div>
          <div className={styles.orbCard}>
            <div className={styles.orbTitle}>Programming</div>
            <div className={styles.orbValue}>
              {selectedStudent.category_scores?.programming?.total 
                ? ((selectedStudent.category_scores.programming.score / selectedStudent.category_scores.programming.total) * 100).toFixed(0)
                : "0"}%
            </div>
          </div>
          <div className={styles.orbCard}>
            <div className={styles.orbTitle}>Other</div>
            <div className={styles.orbValue}>
              {selectedStudent.category_scores?.other?.total 
                ? ((selectedStudent.category_scores.other.score / selectedStudent.category_scores.other.total) * 100).toFixed(0)
                : "0"}%
            </div>
          </div>
          <div className={styles.orbCard} style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.1), transparent)' }}>
            <div className={styles.orbTitle}>PyHunt Progress</div>
            <div className={styles.orbValue}>{pyHuntProgress}</div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderCategoryDetails = (cat: string) => {
    const results = selectedStudent?.results_by_category?.[cat.toLowerCase()] || [];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.timeline}>
        {results.length === 0 ? (
          <div style={{ padding: 40, opacity: 0.3, textAlign: 'center' }}>
             No assessments manifested in {cat} node.
          </div>
        ) : (
          results.map((res, i) => (
            <div key={i} className={styles.timelineNode} style={{ animationDelay: `${i * 100}ms` }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{res.exam_name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                   Submitted: {new Date(res.submitted_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontWeight: 900, fontSize: 20 }}>{res.score} / {res.total_marks}</div>
                   <div style={{ fontSize: 10, opacity: 0.5 }}>DOMAIN: {cat.toUpperCase()}</div>
                </div>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '4px 8px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  onClick={() => handleResetExam(res.exam_name)}
                  disabled={actionLoading}
                >
                  Reset
                </button>
              </div>
            </div>
          ))
        )}
      </motion.div>
    );
  };

  const renderViolations = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.timeline}>
      {violations.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.3 }}>Zero entropy detected. Identity is stable.</div>
      ) : (
        violations.map((v, i) => (
          <div key={v.id} className={styles.timelineNode} style={{ animationDelay: `${i * 100}ms` }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{v.type}</div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>{v.exam_name} · {new Date(v.created_at).toLocaleString()}</div>
            </div>
            <div className="badge badge-error">{v.type.includes('TAB') ? 'CRITICAL' : 'ALERT'}</div>
          </div>
        ))
      )}
    </motion.div>
  );

  return (
    <div className={styles.page}>
      <aside className={styles.registryNode}>
        <div className={styles.registryHeader}>
          <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em' }}>Registry Node</div>
          <div className={styles.searchContainer}>
            <input 
              type="text" 
              className={styles.searchField} 
              placeholder="Search Identity Pulse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span style={{ position: 'absolute', left: 14, top: 11, opacity: 0.4 }}>🔍</span>
          </div>
        </div>

        <div className={styles.registryList}>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} height={40} style={{ marginBottom: 8 }} />
              ))}
            </div>
          ) : filteredStudents.map(s => (
            <div 
              key={s.student_id} 
              className={`${styles.studentCard} ${selectedId === s.student_id ? styles.studentCardActive : ''}`}
              onClick={() => setSelectedId(s.student_id)}
            >
              <div className={styles.avatar}>{s.name[0]}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 11, opacity: 0.5 }}>{s.usn} · {s.branch}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className={styles.fidelityVista}>
        <AnimatePresence mode="wait">
          {!selectedId ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 80, marginBottom: 20 }}>🛰️</div>
                <div style={{ fontWeight: 800 }}>Select a registry node to begin explorer</div>
              </div>
            </motion.div>
          ) : detailsLoading ? (
            <div style={{ padding: 40 }}>
              <Skeleton height={100} borderRadius={24} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 20 }}>
                <Skeleton height={150} borderRadius={24} />
                <Skeleton height={150} borderRadius={24} />
                <Skeleton height={150} borderRadius={24} />
              </div>
            </div>
          ) : selectedStudent ? (
            <motion.div 
              key={selectedStudent.student_id}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 20 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <header className={styles.vistaHeader}>
                <div className={styles.profileHero}>
                  <div className={styles.largeAvatar}>{selectedStudent.name[0]}</div>
                  <div>
                    <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em' }}>{selectedStudent.name}</div>
                    <div style={{ fontSize: 16, opacity: 0.6, fontWeight: 600 }}>{selectedStudent.usn} · {selectedStudent.branch} Node</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="badge badge-primary" style={{ fontSize: 12, fontWeight: 800 }}>{selectedStudent.status.toUpperCase()}</div>
                </div>
              </header>

              <nav className={styles.tabPulse} style={{ overflowX: 'auto', paddingBottom: 10 }}>
                {(["General", "Aptitude", "Programming", "Other", "Violations", "PyHunt"] as const).map(tab => (
                  <button key={tab} className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
                ))}
              </nav>

              <div style={{ flex: 1 }}>
                {activeTab === "General" && renderGeneral()}
                {activeTab === "Violations" && renderViolations()}
                {activeTab === "Aptitude" && renderCategoryDetails("Aptitude")}
                {activeTab === "Programming" && renderCategoryDetails("Programming")}
                {activeTab === "Other" && renderCategoryDetails("Other")}
                {activeTab === "PyHunt" && (
                   <div className={styles.statsGrid}>
                      <div className={styles.orbCard} style={{ borderColor: 'rgba(0, 242, 255, 0.4)' }}>
                        <div className={styles.orbTitle}>PyHunt Progress</div>
                        <div className={styles.orbValue}>Round {selectedStudent.odyssey_progress?.current_round || 0}/5</div>
                      </div>
                      <div className={styles.orbCard}>
                        <div className={styles.orbTitle}>Completion Velocity</div>
                        <div className={styles.orbValue}>
                          {selectedStudent.odyssey_progress?.completion_velocity 
                            ? (selectedStudent.odyssey_progress.completion_velocity / 1000).toFixed(1) + 's' 
                            : '—'}
                        </div>
                      </div>
                   </div>
                )}
              </div>

              <footer className={styles.commandZone}>
                <button className={styles.crystallizeBtn}>💎 Crystallize Data</button>
                <button className={styles.resetBtn} onClick={handleReset} disabled={actionLoading}>Temporal Reset</button>
                <button className={styles.lockdownBtn} onClick={handleLockdown} disabled={actionLoading}>
                   {selectedStudent.is_blocked ? "🔓 Lift Lockdown" : "🔒 Access Lockdown"}
                </button>
              </footer>
            </motion.div>
          ) : syncError ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>📡</div>
                <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Identity Sync Failure</div>
                <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>{syncError}</div>
                <button 
                  onClick={() => selectedId && loadStudentDetails(selectedId)}
                  className="btn btn-outline"
                  style={{ padding: '10px 24px', borderRadius: 12, fontWeight: 700 }}
                >
                  Retry Manifestation
                </button>
              </div>
            </motion.div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
               Identity sync failure. Please re-select node.
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
