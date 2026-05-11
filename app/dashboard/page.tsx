"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchPublicExamConfig, type ExamConfig, updateProfile, getExamStatus } from "@/lib/api";
import { withRetry } from "@/lib/apiUtils";
import { CldUploadWidget } from 'next-cloudinary';
import styles from "./dashboard.module.css";
import PyHuntView from "@/components/PyHuntView";

// ── Types ──────────────────────────────────────────────────────
interface ExamNode {
  id: string;
  exam_name: string;
  branch: string;
  is_active: boolean;
  duration_minutes: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  question_count?: number;
  category?: string;
  marks_per_question?: number;
  negative_marks?: number;
  max_attempts?: number;
  attempts_count?: number;
  student_status?: string;
  last_score?: number;
  last_total?: number;
}

interface StudentInfo {
  id: string;
  usn?: string;
  name: string;
  branch: string;
  email?: string;
  avatarUrl?: string;
  examStartTime: string | null;
  examDurationMinutes: number;
}

type TabId = "home" | "profile" | "aptitude" | "programming" | "other" | "learning" | "insights" | "pyhunt";

export default function DashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [allExams, setAllExams] = useState<ExamNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Load student from session
  useEffect(() => {
    const isPreview = typeof window !== 'undefined' && window.location.search.includes("preview=true");
    if (isPreview) {
      const mock: StudentInfo = {
        id: "PREVIEW", name: "Admin Preview", branch: "CS",
        email: "admin@examguard.com",
        examStartTime: null, examDurationMinutes: 60,
      };
      localStorage.setItem("exam_student", JSON.stringify(mock));
      localStorage.setItem("exam_preview", "true");
      setStudent(mock);
      return;
    }

    const raw = localStorage.getItem("exam_student");
    const token = localStorage.getItem("exam_token");
    if (!raw || !token) {
      router.replace("/login");
      return;
    }
    const info: StudentInfo = JSON.parse(raw);
    setStudent(info);
  }, [router]);

  // ── Load exams ────────────────────────────────────────────
  const loadExams = useCallback(async () => {
    try {
      const configs = await withRetry(() => fetchPublicExamConfig());
      
      // OPTIMIZATION: Instead of fetching ALL questions (which causes lag), 
      // we'll just use the configs as the base and filter/display accordingly.
      const nodes: ExamNode[] = [];

      function inferCategory(examName: string): string {
        const n = (examName || "").toLowerCase();
        if (n.includes("aptitude") || n.includes("quant") || n.includes("reasoning")) return "aptitude";
        if (n.includes("program") || n.includes("code") || n.includes("coding") || n.includes("pyhunt")) return "programming";
        return "other";
      }

      // Fetch ALL exam statuses for this student
      let statusList: any[] = [];
      if (student && student.id !== "PREVIEW") {
        try {
          statusList = await withRetry(() => getExamStatus());
        } catch(err) {
          console.error("Failed to fetch exam status after retries:", err);
        }
      }

      // Build nodes from configs
      configs.forEach(config => {
        const sData = statusList.find(s => s.exam_name === config.exam_title);
        
        nodes.push({
          id: config.exam_title,
          exam_name: config.exam_title,
          branch: config.branch || "ALL",
          is_active: config.is_active,
          duration_minutes: config.duration_minutes || 20,
          scheduled_start: config.scheduled_start,
          scheduled_end: config.scheduled_end,
          question_count: config.total_questions || 0,
          category: inferCategory(config.exam_title),
          marks_per_question: config.marks_per_question ?? 4,
          negative_marks: config.negative_marks ?? -1,
          max_attempts: config.max_attempts || 1,
          attempts_count: sData ? (sData.attempts_count || 0) : 0,
          student_status: sData ? sData.status : 'not_started',
          last_score: sData ? sData.last_score : undefined,
          last_total: sData ? sData.last_total : undefined,
        });
      });
      setAllExams(nodes);
    } catch (e) {
      console.error("Failed to load exams:", e);
    } finally {
      setLoading(false);
    }
  }, [student]);

  useEffect(() => {
    loadExams();
    const channel = supabase.channel("exam_config_rt").on("postgres_changes", { event: "*", schema: "public", table: "exam_config" }, () => loadExams()).subscribe();
    const qChannel = supabase.channel("questions_rt").on("postgres_changes", { event: "*", schema: "public", table: "questions" }, () => loadExams()).subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(qChannel); };
  }, [loadExams]);

  const studentExams = useMemo(() => {
    if (!student) return [];
    return allExams.filter(e => 
      e.branch === "ALL" || 
      e.branch === student.branch || 
      student.branch === "ALL"
    );
  }, [allExams, student]);

  const handleLaunchExam = (exam: ExamNode) => {
    if (!exam.is_active) return;
    localStorage.setItem("exam_selected_title", exam.exam_name);
    localStorage.setItem("exam_selected_duration", String(exam.duration_minutes));
    router.push("/instructions");
  };

  const handleLogout = () => {
    localStorage.removeItem("exam_token");
    localStorage.removeItem("exam_student");
    localStorage.removeItem("exam_preview");
    router.replace("/login");
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <HomeIcon /> },
    { id: "pyhunt", label: "PyHunt", icon: <PyHuntIcon /> },
    { id: "aptitude", label: "Aptitude Test", icon: <AptitudeIcon /> },
    { id: "programming", label: "Programming", icon: <CodeIcon /> },
    { id: "other", label: "Other Quiz", icon: <OtherIcon /> },
    { id: "profile", label: "Profile", icon: <ProfileIcon /> },
    { id: "learning", label: "Learning Path", icon: <HistoryIcon /> },
    { id: "insights", label: "Skills Insights", icon: <InsightsIcon /> },
  ];

  if (!student) return null;

  return (
    <div className={styles.shell}>
      {/* ── Top Navigation ── */}
      {activeTab !== "pyhunt" && (
        <nav className={styles.topNav}>
          <div className={styles.topNavLeft}>
            <button 
              className={styles.menuToggle} 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              )}
            </button>
            <div className={styles.logoTitle}>
              <AtomIcon />
              NEXUS <span className={styles.candidatePortalLabel}>Candidate Portal</span>
            </div>
          </div>

          <div className={styles.topNavRight}>
            <div className={styles.userPanel} onClick={() => setShowUserDropdown(!showUserDropdown)}>
              <img src={student.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=0D8ABC&color=fff`} className={styles.userAvatar} alt="" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {student.usn || student.name.split(' ')[0].toLowerCase() + '67'} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>Candidate</div>
              </div>
            </div>

            <div className={styles.notificationBell} onClick={() => setShowNotifications(!showNotifications)} style={{ cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <div className={styles.notifBadge}>3</div>
            </div>
          </div>
        </nav>
      )}

      <div className={styles.bodyLayout} style={{ marginTop: activeTab === "pyhunt" ? 0 : 24 }}>
        {/* ── Sidebar: The Shield ── */}
        {activeTab !== "pyhunt" && (
          <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ""}`}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`${styles.sidebarItem} ${activeTab === tab.id ? styles.sidebarItemActive : ""}`}
                onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && <svg style={{ marginLeft: 'auto', opacity: 0.3 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6" /></svg>}
              </button>
            ))}

            <div className={styles.atomContainer}>
              <AtomIcon big />
            </div>
          </aside>
        )}

        {/* ── Main Content ── */}
        <main className={styles.mainContent}>
          {activeTab === "home" && (
            <>
              {(() => {
                const now = Date.now();
                const topExams = studentExams.filter(e => {
                  if (!e.is_active) return false;
                  // If there's an end time, and it has passed, it's expired
                  if (e.scheduled_end) {
                    const end = new Date(e.scheduled_end).getTime();
                    if (now > end) return false;
                  }
                  return true; // Active and not yet expired (includes Live and Future)
                });

                const bottomExams = studentExams.filter(e => {
                  if (!e.is_active) return true;
                  if (e.scheduled_end) {
                    const end = new Date(e.scheduled_end).getTime();
                    return now > end; // Expired
                  }
                  return false;
                });


                return (
                  <>
                    {/* ── Active Exams ── */}
                    <div className={styles.sectionWrapper}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#fff' }}>Available Exams</h2>
                          <p style={{ opacity: 0.6, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Live or upcoming assessments</p>
                        </div>
                        <div className={styles.livePulse} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(52, 211, 153, 0.1)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                           <div className={styles.pulseDot} />
                           <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>SYSTEM LIVE</span>
                        </div>
                      </div>

                      {/* ── PyHunt Event Spotlight ── */}
                      <div className={styles.eventSpotlight} onClick={() => setActiveTab("pyhunt")}>
                        <div className={styles.eventGlow} />
                        <div className={styles.eventContent}>
                           <div className={styles.eventTag}>SPECIAL EVENT</div>
                           <h3 className={styles.eventTitle}>🐍 PyHunt: Logic Treasure Hunt</h3>
                           <p className={styles.eventSubtitle}>Master the orbital logic nodes to unlock the sacred geometry. Zero-latency crystalline execution.</p>
                           <button className={styles.eventBtn}>JOIN PYHUNT</button>
                        </div>
                        <div className={styles.eventVisual}>
                           <div className={styles.orbitRing} />
                           <div className={styles.orbitRing} style={{ animationDelay: '-1s', opacity: 0.2 }} />
                        </div>
                      </div>

                      <div className={styles.examsSection} style={{ marginTop: 24 }}>
                        {topExams.length > 0 ? topExams.map(exam => (
                          <ExamCard key={exam.id} exam={exam} onLaunch={handleLaunchExam} />
                        )) : (
                          <div style={{ padding: '40px', textAlign: 'center', opacity: 0.4, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, width: '100%' }}>
                            No exams are currently available.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Inactive Exams ── */}
                    <div className={styles.sectionWrapper} style={{ marginTop: 40 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#fff' }}>Inactive Exams</h2>
                          <p style={{ opacity: 0.6, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Scheduled, expired, or deactivated assessments</p>
                        </div>
                      </div>
                      <div className={styles.examsSection} style={{ marginTop: 24, opacity: 0.6 }}>
                        {bottomExams.length > 0 ? bottomExams.map(exam => (
                          <ExamCard key={exam.id} exam={exam} onLaunch={handleLaunchExam} />
                        )) : (
                          <div style={{ padding: '40px', textAlign: 'center', opacity: 0.4, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, width: '100%' }}>
                            No past or inactive exams.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className={styles.insightsRow}>
                <div className={styles.hologramPanel}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Quick Insights</h3>
                  <div style={{ display: 'flex', gap: 40, marginTop: 24 }}>
                    {(() => {
                      const completed = studentExams.filter(e => e.last_score !== undefined);
                      const avg = completed.length > 0 ? Math.round(completed.reduce((s, e) => s + ((e.last_score || 0) / (e.last_total || 1) * 100), 0) / completed.length) : 0;
                      return (
                        <>
                          <div>
                            <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>Completed Exams</div>
                            <div style={{ fontSize: 24, fontWeight: 800 }}>{completed.length}</div>
                          </div>
                          <div>
                            <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>Avg. Proficiency</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{avg}%</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className={styles.holoChart}>
                    <svg width="100%" height="100%" viewBox="0 0 400 120">
                      <defs>
                        <linearGradient id="mnt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(0, 242, 255, 0.4)" />
                          <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                      </defs>
                      <path d="M0 120 L50 80 L100 100 L150 40 L200 70 L250 20 L300 90 L350 50 L400 120 Z" fill="url(#mnt)" stroke="var(--nexus-cyan)" strokeWidth="2" />
                      <circle cx="150" cy="40" r="3" fill="#fff" />
                      <circle cx="250" cy="20" r="3" fill="#fff" />
                    </svg>
                  </div>
                </div>

                <div className={styles.hologramPanel} style={{ flex: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className={styles.platonicSolid}>
                    <div className={styles.octahedron}>
                      {[...Array(8)].map((_, i) => (
                        <div key={i} style={{
                          position: 'absolute',
                          width: 0, height: 0,
                          borderLeft: '40px solid transparent',
                          borderRight: '40px solid transparent',
                          borderBottom: '70px solid rgba(0, 242, 255, 0.2)',
                          transformOrigin: '50% 100%',
                          transform: `rotateY(${i * 45}deg) rotateX(${i < 4 ? 35 : -35}deg) translateZ(30px)`,
                          boxShadow: 'inset 0 0 10px rgba(0, 242, 255, 0.4)'
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab !== "home" && activeTab !== "profile" && activeTab !== "insights" && activeTab !== "pyhunt" && (
            <CategoryTab
              title={activeTab === "other" ? "General Assessments" : tabs.find(t => t.id === activeTab)?.label || ""}
              subtitle={activeTab === "other" ? "Diverse quizzes and surveys" : "System ready for authorization"}
              exams={studentExams.filter(e => e.category === activeTab)}
              onLaunch={handleLaunchExam}
            />
          )}

          {activeTab === "insights" && <InsightsTab exams={studentExams} />}

          {activeTab === "profile" && student && <ProfileTab student={student} />}
          {activeTab === "pyhunt" && <PyHuntView />}
        </main>
      </div>

      {/* ── Overlays ── */}
      {showUserDropdown && (
        <div className={styles.notificationDropdown} style={{ top: 90, right: 24, width: 220, border: '1px solid var(--nexus-border)', background: 'rgba(2, 6, 23, 0.95)' }}>
          <div className={styles.notificationItem} onClick={() => { setActiveTab("profile"); setShowUserDropdown(false); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <span>Access Profile</span>
          </div>
          <div className={styles.notificationItem} onClick={handleLogout} style={{ color: '#ef4444' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            <span>Deauthorize Session</span>
          </div>
        </div>
      )}

      {showNotifications && (
        <div className={styles.notificationDropdown} style={{ top: 90, right: 24, width: 300, border: '1px solid var(--nexus-border)', background: 'rgba(2, 6, 23, 0.95)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 12, fontWeight: 700, opacity: 0.6 }}>SYSTEM ALERTS</div>
          {[1, 2, 3].map(i => (
            <div key={i} className={styles.notificationItem}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--nexus-cyan)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              <div style={{ flex: 1 }}>
                <div>Aptitude results ready</div>
                <div style={{ fontSize: 10, opacity: 0.5 }}>{i * 5} minutes ago</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PyHuntIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM12 20c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
      <path d="M12 6v6l4 2" />
      <path d="M7 12h10" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

// ── Components ──────────────────────────────────────────────────
function CategoryTab({ title, subtitle, exams, onLaunch }: { title: string; subtitle: string; exams: ExamNode[]; onLaunch: (e: ExamNode) => void }) {
  return (
    <div className={styles.sectionWrapper}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#fff' }}>{title}</h1>
      <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 24, color: 'rgba(255,255,255,0.7)' }}>{subtitle}</p>
      {exams.length > 0 ? (
        <div className={styles.examsSection}>
          {exams.map(exam => <ExamCard key={exam.id} exam={exam} onLaunch={onLaunch} />)}
        </div>
      ) : (
        <div style={{ padding: 60, textAlign: 'center', opacity: 0.5 }}>Comming Soon!!.</div>
      )}
    </div>
  );
}

function ExamCard({ exam, onLaunch }: { exam: ExamNode; onLaunch: (e: ExamNode) => void }) {
  const pattern = exam.exam_name.toLowerCase().includes('programming') ? '/card_pattern_code.png' : '/card_pattern_neural.png';
  
  const [countdown, setCountdown] = useState("");
  const [isLocked, setIsLocked] = useState(() => {
    if (!exam.scheduled_start) return false;
    return new Date(exam.scheduled_start).getTime() > Date.now();
  });

  useEffect(() => {
    if (!exam.scheduled_start) return;
    const target = new Date(exam.scheduled_start).getTime();
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setCountdown("Exam Live Now");
        setIsLocked(false);
        clearInterval(timer);
      } else {
        setIsLocked(true);
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown(`Starts in ${d}D ${h}H ${m}M`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [exam.scheduled_start]);

  const displayDate = exam.scheduled_start ? new Date(exam.scheduled_start).toLocaleDateString() : "2024-05-08";
  const displayTime = exam.scheduled_start ? new Date(exam.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "14:00";

  const hasReachedLimit = (exam.attempts_count || 0) >= (exam.max_attempts || 1) && exam.student_status !== 'active';

  const isExpired = exam.scheduled_end ? new Date(exam.scheduled_end).getTime() < Date.now() : false;
  const isInactive = !exam.is_active;
  const isDisabled = isLocked || hasReachedLimit || isInactive || isExpired;

  return (
    <div className={styles.examCard} style={{ opacity: isDisabled ? 0.8 : 1 }}>
      <img src={pattern} className={styles.cardPattern} alt="" />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 className={styles.examTitle}>{exam.exam_name}</h3>
          <span className={styles.statusBadge} style={{ 
            background: (isInactive || isExpired) ? 'rgba(239, 68, 68, 0.1)' : undefined, 
            color: (isInactive || isExpired) ? '#ef4444' : undefined 
          }}>
            {isInactive ? "Inactive" : (isExpired ? "Expired" : (isLocked ? "Scheduled" : (exam.student_status === 'active' ? "Active" : (hasReachedLimit ? "Completed" : "Live"))))}
          </span>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {displayDate}
          </div>
          <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            {displayTime} • {exam.duration_minutes} min
          </div>
          <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9, color: 'var(--nexus-cyan)' }}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
             Attempts: {exam.attempts_count} / {exam.max_attempts}
          </div>
          {exam.last_score !== undefined && (
            <div style={{ 
              fontSize: 14, 
              fontWeight: 800, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              color: '#34d399',
              background: 'rgba(52, 211, 153, 0.1)',
              padding: '4px 10px',
              borderRadius: 8,
              width: 'fit-content',
              marginTop: 4
            }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
               Score: {exam.last_score} / {exam.last_total || 0}
            </div>
          )}
        </div>
        <div className={styles.progressBar}>
           <div className={styles.progressFill} style={{ width: hasReachedLimit ? '100%' : (isDisabled ? '0%' : '100%'), background: hasReachedLimit ? '#34d399' : (isInactive ? '#ef4444' : undefined) }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <button 
            className={styles.startExamBtn} 
            onClick={() => !isDisabled && onLaunch(exam)} 
            disabled={isDisabled}
            style={{ 
              opacity: isDisabled ? 0.6 : 1, 
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              background: hasReachedLimit ? 'rgba(52, 211, 153, 0.1)' : (isInactive ? 'rgba(239, 68, 68, 0.1)' : undefined),
              color: hasReachedLimit ? '#34d399' : (isInactive ? '#ef4444' : undefined),
              border: hasReachedLimit ? '1px solid rgba(52, 211, 153, 0.2)' : (isInactive ? '1px solid rgba(239, 68, 68, 0.2)' : undefined)
            }}
          >
            {isInactive ? "Closed" : (isExpired ? "Expired" : (isLocked ? "Locked" : (exam.student_status === 'active' ? "Resume Exam" : (hasReachedLimit ? "Attempted" : "Start Exam"))))}
          </button>
          <div style={{ 
            fontSize: 13, 
            fontWeight: 700, 
            color: (isInactive || isExpired) ? '#ef4444' : (isLocked ? 'var(--nexus-gold)' : (hasReachedLimit ? '#34d399' : 'var(--nexus-cyan)')) 
          }}>
            {isInactive ? "Inactive" : (isExpired ? "Expired" : (exam.student_status === 'active' ? "In Progress" : (hasReachedLimit ? "Verified" : (countdown || "Ready"))))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ student }: { student: StudentInfo }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [editEmail, setEditEmail] = useState(student.email || "");
  const [avatarUrl, setAvatarUrl] = useState(student.avatarUrl || "");
  const [saving, setSaving] = useState(false);

    // ── Profile Update ──────────────────────────────────────────
    const handleSave = async () => {
      if (!editName.trim()) { alert("Name is required."); return; }
      setSaving(true);
      try {
        const payload = { name: editName.trim(), email: editEmail.trim(), avatar_url: avatarUrl };
        console.log("[PROFILE] Updating with payload:", payload);
        await updateProfile(payload);
        
        const raw = localStorage.getItem("exam_student");
        if (raw) {
          const data = JSON.parse(raw);
          data.name = editName.trim(); 
          data.email = editEmail.trim(); 
          data.avatarUrl = avatarUrl; // Preserve locally
          localStorage.setItem("exam_student", JSON.stringify(data));
          console.log("[PROFILE] Local storage updated.");
          alert("Profile updated successfully!");
          window.location.reload();
        }
      } catch (err) { 
        console.error("[PROFILE] Update error:", err);
        alert("Failed to update profile. Please ensure you ran the SQL migration."); 
      } finally { setSaving(false); setEditing(false); }
    };

  return (
    <div className={styles.profileContainer}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#fff' }}>Profile</h1>
      <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 32, color: 'rgba(255,255,255,0.7)' }}>View your candidate information</p>

      {/* Top Identity Card */}
      <div className={styles.profileHeaderCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <img src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=0D8ABC&color=fff`} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} alt="" />
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{student.name}</div>
            <div style={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              {student.email || "candidate@nexus.com"}
            </div>
          </div>
        </div>
        <button className={styles.editBtn} onClick={() => setEditing(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          Edit Profile
        </button>
      </div>

      {/* Details Card */}
      <div className={styles.profileInfoCard}>
        <h3 className={styles.profileInfoTitle}>Personal Information</h3>
        <div className={styles.profileGrid}>
          <ProfileField
            label="Full Name"
            value={student.name}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
          />
          <ProfileField
            label="Email"
            value={student.email || "candidate@nexus.com"}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>}
          />
          <ProfileField
            label="Branch"
            value={student.branch || "DS"}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>}
          />
          <ProfileField
            label="USN"
            value={student.usn || "1A"}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="10" x2="21" y2="10" /><circle cx="17" cy="13" r="2.5" /></svg>}
          />
        </div>
      </div>

      {/* Edit Modal (Exact Style) */}
      {editing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Edit Profile</h2>

            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=0D8ABC&color=fff`} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                <CldUploadWidget
                  uploadPreset="ml_default"
                  onSuccess={(result: any) => { 
                    if (result.info && typeof result.info !== 'string') {
                      console.log("[UPLOAD] Success:", result.info.secure_url);
                      setAvatarUrl(result.info.secure_url); 
                    }
                  }}
                >
                  {({ open }) => (
                    <button className={styles.changePhotoBtn} onClick={() => open()}>
                      {avatarUrl ? "Change Photo" : "Upload Photo"}
                    </button>
                  )}
                </CldUploadWidget>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Full Name</label>
              <input className={styles.textInput} value={editName} onChange={e => setEditName(e.target.value)} />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Email Address</label>
              <input className={styles.textInput} value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileField({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className={styles.profileField}>
      <div className={styles.profileFieldIcon}>{icon}</div>
      <div>
        <div className={styles.profileFieldLabel}>{label}</div>
        <div className={styles.profileFieldValue}>{value}</div>
      </div>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────
function AtomIcon({ big }: { big?: boolean }) {
  return (
    <svg className={styles.atomIcon} style={{ width: big ? 100 : 28, height: big ? 100 : 28 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(0 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </svg>
  );
}
function HomeIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>; }
function AptitudeIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>; }
function CodeIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>; }
function ProfileIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>; }
function OtherIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>; }
function HistoryIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>; }
function InsightsIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>; }

function InsightsTab({ exams }: { exams: ExamNode[] }) {
  const completed = exams.filter(e => e.last_score !== undefined);
  
  return (
    <div className={styles.sectionWrapper}>
       <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#fff' }}>Skills Insights</h1>
       <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 32, color: 'rgba(255,255,255,0.7)' }}>Analytical breakdown of your performance</p>
       
       <div className={styles.insightsGrid}>
          {/* Performance Radar Chart */}
          <div className={styles.hologramPanel} style={{ padding: 32 }}>
             <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#fff' }}>Competency Map</h3>
             <div className={styles.radarContainer}>
                {completed.length >= 3 ? <RadarChart data={completed} /> : (
                  <div style={{ textAlign: 'center', opacity: 0.6, color: '#fff' }}>
                    <div style={{ color: 'var(--nexus-cyan)' }}><InsightsIcon /></div>
                    <div style={{ marginTop: 12, fontSize: 14 }}>Need at least 3 completed exams for Radar mapping.</div>
                  </div>
                )}
             </div>
          </div>
          
          {/* Detailed Stats */}
          <div className={styles.hologramPanel} style={{ padding: 32 }}>
             <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#fff' }}>Detailed Breakdown</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {completed.map(e => (
                   <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                         <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{e.exam_name}</div>
                         <div style={{ fontSize: 11, opacity: 0.7, color: 'rgba(255,255,255,0.8)' }}>{e.branch} Assessment</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                         <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}>{Math.round((e.last_score || 0) / (e.last_total || 1) * 100)}%</div>
                         <div style={{ fontSize: 10, opacity: 0.7, color: 'rgba(255,255,255,0.8)' }}>{e.last_score} / {e.last_total}</div>
                      </div>
                   </div>
                ))}
                {completed.length === 0 && (
                   <div style={{ padding: 40, textAlign: 'center', opacity: 0.5, color: '#fff' }}>No data available. Complete an exam to see insights.</div>
                )}
             </div>
          </div>
       </div>
    </div>
  );
}

function RadarChart({ data }: { data: ExamNode[] }) {
  const size = 300;
  const center = size / 2;
  const radius = center - 40;
  const points = data.map((d, i) => {
    const angle = (i / data.length) * 2 * Math.PI - Math.PI / 2;
    const value = (d.last_score || 0) / (d.last_total || 1);
    const r = radius * value;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      label: d.exam_name
    };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circles */}
      {[0.2, 0.4, 0.6, 0.8, 1].map(v => (
        <circle key={v} cx={center} cy={center} r={radius * v} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
      ))}
      
      {/* Axis lines */}
      {data.map((_, i) => {
        const angle = (i / data.length) * 2 * Math.PI - Math.PI / 2;
        return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
      })}

      {/* The Radar Area */}
      <path d={pathData} fill="rgba(0, 242, 255, 0.2)" stroke="var(--nexus-cyan)" strokeWidth="2" />
      
      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="var(--nexus-cyan)" />
          <text 
            x={center + (radius + 20) * Math.cos((i / data.length) * 2 * Math.PI - Math.PI / 2)} 
            y={center + (radius + 20) * Math.sin((i / data.length) * 2 * Math.PI - Math.PI / 2)} 
            fill="rgba(255,255,255,0.5)" 
            fontSize="10" 
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {p.label.substring(0, 10)}
          </text>
        </g>
      ))}
    </svg>
  );
}
