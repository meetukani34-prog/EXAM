"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchPublicExamConfig, type ExamConfig, updateProfile } from "@/lib/api";
import { CldUploadWidget } from 'next-cloudinary';
import styles from "./dashboard.module.css";

// ── Types ──────────────────────────────────────────────────────
interface ExamNode {
  id: string;
  exam_name: string;
  branch: string;
  is_active: boolean;
  duration_minutes: number;
  scheduled_start: string | null;
  question_count?: number;
  category?: string;
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

type TabId = "home" | "profile" | "aptitude" | "programming" | "other" | "learning" | "insights";

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
      sessionStorage.setItem("exam_student", JSON.stringify(mock));
      sessionStorage.setItem("exam_preview", "true");
      setStudent(mock);
      return;
    }

    const raw = sessionStorage.getItem("exam_student");
    const token = sessionStorage.getItem("exam_token");
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
      const configs = await fetchPublicExamConfig();
      const { data: qData } = await supabase
        .from("questions")
        .select("branch, exam_name, category");

      const nodes: ExamNode[] = [];
      
      function inferCategory(examName: string): string {
        const n = (examName || "").toLowerCase();
        if (n.includes("aptitude") || n.includes("quant") || n.includes("reasoning")) return "aptitude";
        if (n.includes("program") || n.includes("code") || n.includes("coding")) return "programming";
        return "other";
      }

      if (qData) {
        const uniqueExams = new Map<string, { exam_name: string, branch: string, count: number, category: string }>();
        qData.forEach(q => {
          const br = q.branch || "CS";
          const ex = q.exam_name || "General Assessment";
          const key = `${ex}|${br}`;
          if (!uniqueExams.has(key)) {
            uniqueExams.set(key, { exam_name: ex, branch: br, count: 0, category: q.category || inferCategory(ex) });
          }
          uniqueExams.get(key)!.count++;
        });

        uniqueExams.forEach((info, key) => {
          const config = configs.find(c => c.exam_title === info.exam_name);
          nodes.push({
            id: key,
            exam_name: info.exam_name,
            branch: info.branch,
            is_active: config ? config.is_active : true,
            duration_minutes: config ? config.duration_minutes : 20,
            scheduled_start: config ? config.scheduled_start : null,
            question_count: info.count,
            category: info.category,
          });
        });
      }
      setAllExams(nodes);
    } catch (e) {
      console.error("Failed to load exams:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
    const channel = supabase.channel("exam_config_rt").on("postgres_changes", { event: "*", schema: "public", table: "exam_config" }, () => loadExams()).subscribe();
    const qChannel = supabase.channel("questions_rt").on("postgres_changes", { event: "*", schema: "public", table: "questions" }, () => loadExams()).subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(qChannel); };
  }, [loadExams]);

  const studentExams = student?.branch === "ALL" ? allExams : allExams.filter(e => e.branch === student?.branch);

  const handleLaunchExam = (exam: ExamNode) => {
    if (!exam.is_active) return;
    sessionStorage.setItem("exam_selected_title", exam.exam_name);
    router.push("/instructions");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("exam_token");
    sessionStorage.removeItem("exam_student");
    router.replace("/login");
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <HomeIcon /> },
    { id: "aptitude", label: "Aptitude Test", icon: <AptitudeIcon /> },
    { id: "programming", label: "Programming", icon: <CodeIcon /> },
    { id: "profile", label: "Profile", icon: <ProfileIcon /> },
    { id: "learning", label: "History", icon: <HistoryIcon /> },
    { id: "insights", label: "Skills Insights", icon: <InsightsIcon /> },
  ];

  if (!student) return null;

  return (
    <div className={styles.shell}>
      {/* ── Top Navigation ── */}
      <nav className={styles.topNav}>
        <div className={styles.topNavLeft}>
          <div className={styles.logoTitle}>
             <AtomIcon />
             NEXUS <span style={{ opacity: 0.5, fontSize: 14, fontWeight: 500, letterSpacing: 1, marginLeft: 10 }}>Candidate Portal</span>
          </div>
        </div>

        <div className={styles.topNavRight}>
          <div className={styles.userPanel} onClick={() => setShowUserDropdown(!showUserDropdown)}>
             <img src={student.avatarUrl || "/default-avatar.png"} className={styles.userAvatar} alt="" />
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

      <div className={styles.bodyLayout}>
        {/* ── Sidebar: The Shield ── */}
        <aside className={styles.sidebar}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.sidebarItem} ${activeTab === tab.id ? styles.sidebarItemActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
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

        {/* ── Main Content ── */}
        <main className={styles.mainContent}>
          {activeTab === "home" && (
            <>
              <div className={styles.sectionWrapper}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <div>
                      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Upcoming Exams</h2>
                      <p style={{ opacity: 0.6, fontSize: 14 }}>View your scheduled assessments</p>
                   </div>
                   <div style={{ opacity: 0.4 }}>
                      <svg width="120" height="60" viewBox="0 0 120 60">
                         <circle cx="20" cy="20" r="2" fill="#fff" />
                         <circle cx="40" cy="40" r="2" fill="#fff" />
                         <circle cx="60" cy="15" r="2" fill="#fff" />
                         <circle cx="80" cy="45" r="2" fill="#fff" />
                         <circle cx="100" cy="25" r="2" fill="#fff" />
                         <path d="M20 20 L40 40 L60 15 L80 45 L100 25" stroke="rgba(255,255,255,0.2)" fill="none" />
                      </svg>
                   </div>
                </div>
                
                <div className={styles.examsSection} style={{ marginTop: 24 }}>
                   {studentExams.slice(0, 2).map(exam => (
                      <ExamCard key={exam.id} exam={exam} onLaunch={handleLaunchExam} />
                   ))}
                </div>
              </div>

              <div className={styles.insightsRow}>
                 <div className={styles.hologramPanel}>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>Quick Insights</h3>
                    <div style={{ display: 'flex', gap: 40, marginTop: 24 }}>
                       <div>
                          <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>Completed Exams</div>
                          <div style={{ fontSize: 24, fontWeight: 800 }}>8</div>
                       </div>
                       <div>
                          <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>Skill Score:</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>85th Percentile</div>
                       </div>
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

          {activeTab !== "home" && activeTab !== "profile" && (
            <CategoryTab 
               title={tabs.find(t => t.id === activeTab)?.label || ""}
               subtitle="System ready for authorization"
               exams={studentExams.filter(e => e.category === activeTab)}
               onLaunch={handleLaunchExam}
            />
          )}

          {activeTab === "profile" && student && <ProfileTab student={student} />}
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
           <div className={styles.notificationFooter}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              <span>Options</span>
           </div>
        </div>
      )}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────
function CategoryTab({ title, subtitle, exams, onLaunch }: { title: string; subtitle: string; exams: ExamNode[]; onLaunch: (e: ExamNode) => void }) {
  return (
    <div className={styles.sectionWrapper}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{title}</h1>
      <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 24 }}>{subtitle}</p>
      {exams.length > 0 ? (
        <div className={styles.examsSection}>
          {exams.map(exam => <ExamCard key={exam.id} exam={exam} onLaunch={onLaunch} />)}
        </div>
      ) : (
        <div style={{ padding: 60, textAlign: 'center', opacity: 0.5 }}>No data detected in current sector.</div>
      )}
    </div>
  );
}

function ExamCard({ exam, onLaunch }: { exam: ExamNode; onLaunch: (e: ExamNode) => void }) {
  const pattern = exam.exam_name.toLowerCase().includes('programming') ? '/card_pattern_code.png' : '/card_pattern_neural.png';
  return (
    <div className={styles.examCard}>
      <img src={pattern} className={styles.cardPattern} alt="" />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
           <h3 className={styles.examTitle}>{exam.exam_name}</h3>
           <span className={styles.statusBadge}>Scheduled</span>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
           <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              2024-05-08
           </div>
           <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              14:00 • {exam.duration_minutes} min
           </div>
        </div>
        <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: '40%' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
           <button className={styles.startExamBtn} onClick={() => onLaunch(exam)}>Start Exam</button>
           <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nexus-gold)' }}>Starts in 2D 14H</div>
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: editName.trim(), email: editEmail.trim(), avatar_url: avatarUrl });
      const raw = sessionStorage.getItem("exam_student");
      if (raw) {
        const data = JSON.parse(raw);
        data.name = editName.trim(); data.email = editEmail.trim(); data.avatarUrl = avatarUrl;
        sessionStorage.setItem("exam_student", JSON.stringify(data));
        window.location.reload();
      }
    } catch (err) { alert("Failed to update profile."); } finally { setSaving(false); setEditing(false); }
  };

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#1e293b' }}>Profile</h1>
      <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 32, color: '#64748b' }}>View your candidate information</p>

      {/* Top Identity Card */}
      <div className={styles.profileHeaderCard}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <img src={avatarUrl || "/default-avatar.png"} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} alt="" />
            <div>
               <div style={{ fontSize: 24, fontWeight: 800 }}>{student.name}</div>
               <div style={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  {student.email || "candidate@nexus.com"}
               </div>
            </div>
         </div>
         <button className={styles.editBtn} onClick={() => setEditing(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
               icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} 
            />
            <ProfileField 
               label="Email" 
               value={student.email || "candidate@nexus.com"} 
               icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} 
            />
            <ProfileField 
               label="Branch" 
               value={student.branch || "DS"} 
               icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>} 
            />
            <ProfileField 
               label="USN" 
               value={student.usn || "1A"} 
               icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="17" cy="13" r="2.5"/></svg>} 
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
                    <img src={avatarUrl || "/default-avatar.png"} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    <CldUploadWidget 
                      uploadPreset="ml_default"
                      onSuccess={(result: any) => { if (result.info && typeof result.info !== 'string') setAvatarUrl(result.info.secure_url); }}
                    >
                      {({ open }) => (
                        <button className={styles.changePhotoBtn} onClick={() => open()}>Change Photo</button>
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
function HistoryIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>; }
function InsightsIcon() { return <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>; }
