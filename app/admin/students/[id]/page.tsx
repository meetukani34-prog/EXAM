"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { 
  fetchAdminStudents, 
  AdminStudent, 
  resetAdminStudent, 
  blockAdminStudent, 
  unblockAdminStudent,
  ViolationHistory,
  fetchViolationHistory
} from "@/lib/api";
import styles from "./student-explorer.module.css";
import Skeleton from "@/components/Skeleton";

type TabType = "General" | "Exams" | "Violations" | "PyHunt";

interface StudentFidelity extends AdminStudent {
  exam_results?: any[];
  odyssey_progress?: any;
}

export default function StudentIdentityExplorer() {
  const { id } = useParams();
  const router = useRouter();
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentFidelity | null>(null);
  const [violations, setViolations] = useState<ViolationHistory[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("General");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────
  useEffect(() => {
    async function loadInitial() {
      const all = await fetchAdminStudents();
      setStudents(all);
      
      if (id && id !== "list") {
        await loadStudentDetails(id as string);
      }
      setLoading(false);
    }
    loadInitial();
  }, [id]);

  async function loadStudentDetails(studentId: string) {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('students')
        .select('*, exam_status(*), exam_results(*), odyssey_progress(*)')
        .eq('id', studentId)
        .single();

      if (profile) {
        // Map to our local Fidelity type
        const mapped: StudentFidelity = {
          student_id: profile.id,
          name: profile.name,
          usn: profile.usn,
          email: profile.email,
          branch: profile.branch,
          status: profile.exam_status?.[0]?.status || "not_started",
          warnings: profile.exam_status?.[0]?.warnings || 0,
          score: profile.exam_results?.[0]?.score || 0,
          total_marks: profile.exam_results?.[0]?.total_marks || 0,
          last_active: profile.exam_status?.[0]?.last_active,
          submitted_at: profile.exam_status?.[0]?.submitted_at,
          started_at: profile.exam_status?.[0]?.started_at,
          is_blocked: profile.exam_status?.[0]?.is_blocked || false,
          exam_name: profile.exam_status?.[0]?.exam_name,
          exam_results: profile.exam_results || [],
          odyssey_progress: profile.odyssey_progress
        };
        setSelectedStudent(mapped);
        
        // Load violations
        const vLogs = await fetchViolationHistory(studentId);
        setViolations(vLogs);
      }
    } catch (err) {
      console.error("Fidelity Pulse error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────
  const handleReset = async () => {
    if (!selectedStudent || !confirm("Weightlessly purge this attempt?")) return;
    setActionLoading(true);
    try {
      await resetAdminStudent(selectedStudent.student_id);
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
  const renderGeneral = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={styles.statsGrid}
    >
      <div className={styles.orbCard}>
        <div className={styles.orbTitle}>Performance Pulse</div>
        <div className={styles.orbValue}>{avgScore}%</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>Average Consistency</div>
      </div>
      <div className={styles.orbCard}>
        <div className={styles.orbTitle}>Temporal Displacement</div>
        <div className={styles.orbValue}>{selectedStudent?.exam_results?.length || 0}</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>Assessments Navigated</div>
      </div>
      <div className={styles.orbCard}>
        <div className={styles.orbTitle}>Entropy Level</div>
        <div className={styles.orbValue} style={{ color: violations.length > 5 ? 'var(--danger)' : 'var(--text-primary)' }}>
          {violations.length}
        </div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>Fidelity Deviations</div>
      </div>
    </motion.div>
  );

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
      {/* ── Registry Node (Left) ── */}
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
          {filteredStudents.map(s => (
            <div 
              key={s.student_id} 
              className={`${styles.studentCard} ${id === s.student_id ? styles.studentCardActive : ''}`}
              onClick={() => router.push(`/admin/students/${s.student_id}`)}
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

      {/* ── Fidelity Vista (Right) ── */}
      <main className={styles.fidelityVista}>
        <AnimatePresence mode="wait">
          {(!id || id === "list") ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 80, marginBottom: 20 }}>🛰️</div>
                <div style={{ fontWeight: 800 }}>Select a registry node to begin explorer</div>
              </div>
            </motion.div>
          ) : loading ? (
            <div style={{ padding: 40 }}>
              <Skeleton height={100} borderRadius={24} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 20 }}>
                <Skeleton height={150} borderRadius={24} />
                <Skeleton height={150} borderRadius={24} />
                <Skeleton height={150} borderRadius={24} />
              </div>
            </div>
          ) : selectedStudent && (
            <motion.div 
              key={selectedStudent.student_id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <header className={styles.vistaHeader}>
                <div className={styles.profileHero}>
                  <div className={styles.largeAvatar}>{selectedStudent.name[0]}</div>
                  <div>
                    <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em' }}>{selectedStudent.name}</div>
                    <div style={{ fontSize: 16, opacity: 0.6, fontWeight: 600 }}>
                      {selectedStudent.usn} · {selectedStudent.branch} Node · {selectedStudent.email}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="badge badge-primary" style={{ fontSize: 12, fontWeight: 800 }}>{selectedStudent.status.toUpperCase()}</div>
                  <div style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>LATENCY: 12ms</div>
                </div>
              </header>

              <nav className={styles.tabPulse}>
                {(["General", "Exams", "Violations", "PyHunt"] as const).map(tab => (
                  <button 
                    key={tab}
                    className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </nav>

              <div style={{ flex: 1 }}>
                {activeTab === "General" && renderGeneral()}
                {activeTab === "Violations" && renderViolations()}
                {activeTab === "Exams" && (
                  <div style={{ padding: 40, opacity: 0.5 }}>Temporal mapping in progress...</div>
                )}
                {activeTab === "PyHunt" && (
                    <div className={styles.statsGrid}>
                       <div className={styles.orbCard} style={{ borderColor: 'var(--accent)' }}>
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
                <button className={styles.crystallizeBtn}>
                  💎 Crystallize Data Report
                </button>
                <button className={styles.resetBtn} onClick={handleReset} disabled={actionLoading}>
                  {actionLoading ? "Purging..." : "Temporal Reset"}
                </button>
                <button className={styles.lockdownBtn} onClick={handleLockdown} disabled={actionLoading}>
                   {selectedStudent.is_blocked ? "🔓 Lift Lockdown" : "🔒 Access Lockdown"}
                </button>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
