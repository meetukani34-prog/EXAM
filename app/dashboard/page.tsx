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

type TabId = "home" | "profile";

export default function DashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [allExams, setAllExams] = useState<ExamNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("home");

  // Load student from session
  useEffect(() => {
    const isPreview = window.location.search.includes("preview=true");
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
        .select("branch, exam_name");

      const nodes: ExamNode[] = [];
      const seen = new Set<string>();

      if (qData && configs.length > 0) {
        for (const config of configs) {
          const relevantQuestions = qData.filter(q => q.exam_name === config.exam_title);
          const branchCounts: Record<string, number> = {};
          relevantQuestions.forEach(q => {
            const br = q.branch || "CS";
            branchCounts[br] = (branchCounts[br] || 0) + 1;
          });

          Object.entries(branchCounts).forEach(([branch, count]) => {
            const nodeId = `${config.exam_title}-${branch}`;
            if (!seen.has(nodeId)) {
              nodes.push({
                id: nodeId,
                exam_name: config.exam_title,
                branch,
                is_active: config.is_active,
                duration_minutes: config.duration_minutes,
                scheduled_start: config.scheduled_start,
                question_count: count,
              });
              seen.add(nodeId);
            }
          });
        }
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

    const channel = supabase
      .channel("exam_config_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_config" }, () => loadExams())
      .subscribe();

    const qChannel = supabase
      .channel("questions_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, () => loadExams())
      .subscribe();

    // Safety timeout: Ensure loading is disabled after 8 seconds no matter what
    const timer = setTimeout(() => setLoading(false), 8000);

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
      supabase.removeChannel(qChannel);
    };
  }, [loadExams]);

  // ── Filter exams for student branch ─────────────────────
  const studentExams = student?.branch === "ALL"
    ? allExams
    : allExams.filter(e => e.branch === student?.branch);

  // ── Launch exam ─────────────────────────────────────────
  const handleLaunchExam = useCallback((exam: ExamNode) => {
    if (!exam.is_active) return;

    if (sessionStorage.getItem("exam_preview") === "true") {
      const infoStr = sessionStorage.getItem("exam_student");
      if (infoStr) {
        const info = JSON.parse(infoStr);
        info.branch = exam.branch;
        sessionStorage.setItem("exam_student", JSON.stringify(info));
      }
    }

    sessionStorage.setItem("exam_selected_title", exam.exam_name);
    router.push("/instructions");
  }, [router]);

  // ── Logout ──────────────────────────────────────────────
  const handleLogout = () => {
    sessionStorage.removeItem("exam_token");
    sessionStorage.removeItem("exam_student");
    router.replace("/login");
  };

  // ── Tab data ──────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: "home",
      label: "Home",
      icon: (
        <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: "profile",
      label: "Profile",
      icon: (
        <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.shell}>
      {/* ── Top Navigation ── */}
      <nav className={styles.topNav}>
        <div className={styles.topNavLeft}>
          <div className={styles.logoMark}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M8 12h16M8 16h10M8 20h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>ExamGuard</span>
            <span className={styles.logoSub}>Candidate Portal</span>
          </div>
        </div>

        <div className={styles.topNavRight}>
          {student && (
            <div className={styles.userInfo}>
              <div className={styles.userName}>{student.name}</div>
              <div className={styles.userRole}>Candidate</div>
            </div>
          )}
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className={styles.bodyLayout}>
        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.sidebarItem} ${activeTab === tab.id ? styles.sidebarItemActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </aside>

        {/* ── Main Content ── */}
        <main className={styles.mainContent}>
          {activeTab === "home" && (
            <HomeTab
              exams={studentExams}
              loading={loading}
              onLaunch={handleLaunchExam}
            />
          )}
          {activeTab === "profile" && student && (
            <ProfileTab student={student} />
          )}
        </main>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// HOME TAB
// ══════════════════════════════════════════════════════════════
function HomeTab({
  exams, loading, onLaunch,
}: {
  exams: ExamNode[];
  loading: boolean;
  onLaunch: (exam: ExamNode) => void;
}) {
  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <>
      <h1 className={styles.pageTitle}>Upcoming Exams</h1>
      <p className={styles.pageSubtitle}>View your scheduled assessments</p>

      {exams.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>No exams available</div>
          <div className={styles.emptyText}>
            There are no scheduled exams for your branch right now. Check back later.
          </div>
        </div>
      ) : (
        exams.map(exam => (
          <ExamCard key={exam.id} exam={exam} onLaunch={onLaunch} />
        ))
      )}
    </>
  );
}

// ── Exam Card ──────────────────────────────────────────────
function ExamCard({ exam, onLaunch }: { exam: ExamNode; onLaunch: (e: ExamNode) => void }) {
  const getStatus = () => {
    if (!exam.is_active) return { label: "Inactive", className: styles.statusInactive };
    if (exam.scheduled_start) {
      const start = new Date(exam.scheduled_start);
      if (start > new Date()) return { label: "Scheduled", className: styles.statusScheduled };
    }
    return { label: "Active", className: styles.statusActive };
  };

  const status = getStatus();
  const scheduledDate = exam.scheduled_start
    ? new Date(exam.scheduled_start).toLocaleDateString("en-CA")
    : new Date().toLocaleDateString("en-CA");
  const scheduledTime = exam.scheduled_start
    ? new Date(exam.scheduled_start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "Now";

  return (
    <div className={styles.examCard}>
      <div className={styles.examCardHeader}>
        <h3 className={styles.examTitle}>{exam.exam_name}</h3>
        <span className={`${styles.statusBadge} ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className={styles.examMeta}>
        <div className={styles.examMetaItem}>
          <svg className={styles.examMetaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {scheduledDate}
        </div>
        <div className={styles.examMetaItem}>
          <svg className={styles.examMetaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {scheduledTime} • {exam.duration_minutes} min
        </div>
        <div className={styles.examMetaItem}>
          <svg className={styles.examMetaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {exam.branch} • {exam.question_count ?? "—"} questions
        </div>
      </div>

      <button
        className={`${styles.startExamBtn} ${!exam.is_active ? styles.startExamBtnDisabled : ""}`}
        onClick={() => onLaunch(exam)}
        disabled={!exam.is_active}
      >
        {exam.is_active ? "Start Exam" : "🔒 Locked"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PROFILE TAB
// ══════════════════════════════════════════════════════════════
function ProfileTab({ student }: { student: StudentInfo }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [editEmail, setEditEmail] = useState(student.email || "");
  const [avatarUrl, setAvatarUrl] = useState(student.avatarUrl || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update Backend
      await updateProfile({
        name: editName.trim(),
        email: editEmail.trim(),
        avatar_url: avatarUrl,
      });

      // 2. Update SessionStorage
      const raw = sessionStorage.getItem("exam_student");
      if (raw) {
        const data = JSON.parse(raw);
        data.name = editName.trim();
        data.email = editEmail.trim();
        data.avatarUrl = avatarUrl;
        sessionStorage.setItem("exam_student", JSON.stringify(data));
        // Update the student object via page reload
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      alert("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <>
      <h1 className={styles.pageTitle}>Profile</h1>
      <p className={styles.pageSubtitle}>View your candidate information</p>

      {/* Profile Header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileHeaderLeft}>
          <div className={styles.profileAvatar} style={{ position: 'relative', overflow: 'hidden' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <div>
            <div className={styles.profileName}>{student.name}</div>
            <div className={styles.profileEmail}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {student.email || "candidate@examguard.com"}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <CldUploadWidget 
            uploadPreset="ml_default"
            onSuccess={async (result: any) => {
              if (result.info && typeof result.info !== 'string') {
                const newUrl = result.info.secure_url;
                setAvatarUrl(newUrl);
                
                try {
                  // Update backend immediately for avatar
                  await updateProfile({ avatar_url: newUrl });

                  // Update session immediately
                  const raw = sessionStorage.getItem("exam_student");
                  if (raw) {
                    const data = JSON.parse(raw);
                    data.avatarUrl = newUrl;
                    sessionStorage.setItem("exam_student", JSON.stringify(data));
                  }
                } catch (err) {
                  console.error("Failed to persist avatar:", err);
                }
              }
            }}
          >
            {({ open }) => (
              <button 
                className={styles.logoutBtn} 
                onClick={() => open()}
                style={{ border: '1px solid var(--portal-primary)', color: 'var(--portal-primary)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Change Photo
              </button>
            )}
          </CldUploadWidget>

          <button className={styles.editProfileBtn} onClick={() => setEditing(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Profile
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 16,
            padding: 32,
            width: "90%",
            maxWidth: 440,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            animation: "fadeIn 0.2s ease",
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: "#1e293b" }}>
              Edit Profile
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
                Full Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px",
                  border: "1px solid #e2e8f0", borderRadius: 8,
                  fontSize: 14, color: "#1e293b", outline: "none",
                  transition: "border 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "#4f46e5"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px",
                  border: "1px solid #e2e8f0", borderRadius: 8,
                  fontSize: 14, color: "#1e293b", outline: "none",
                  transition: "border 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "#4f46e5"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: "10px 20px", border: "1px solid #e2e8f0",
                  borderRadius: 8, background: "#fff", color: "#64748b",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "10px 24px", border: "none",
                  borderRadius: 8, background: "#4f46e5", color: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(79,70,229,0.25)",
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal Information */}
      <div className={styles.profileInfoCard}>
        <h3 className={styles.profileInfoTitle}>Personal Information</h3>
        <div className={styles.profileGrid}>
          <ProfileField
            icon={
              <svg className={styles.profileFieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            label="Full Name"
            value={student.name}
          />
          <ProfileField
            icon={
              <svg className={styles.profileFieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            }
            label="Email"
            value={student.email || "candidate@examguard.com"}
          />
          <ProfileField
            icon={
              <svg className={styles.profileFieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
            label="Branch"
            value={student.branch}
          />
          <ProfileField
            icon={
              <svg className={styles.profileFieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                <path d="M7 8h4M7 12h6M7 16h5" />
                <circle cx="17" cy="13" r="2.5" />
              </svg>
            }
            label="USN"
            value={student.usn || student.id.slice(0, 12)}
          />
        </div>
      </div>
    </>
  );
}

function ProfileField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={styles.profileField}>
      {icon}
      <div>
        <div className={styles.profileFieldLabel}>{label}</div>
        <div className={styles.profileFieldValue}>{value}</div>
      </div>
    </div>
  );
}
