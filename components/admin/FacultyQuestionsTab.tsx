import React, { useState, useEffect, useCallback } from "react";
import { fetchPublicExamConfig, fetchAdminQuestions, createAdminQuestion, updateAdminQuestion, deleteAdminQuestion, deleteAdminFolder, renameAdminFolder, editAdminFolderBranch, uploadQuestionImage, updateExamConfig, AdminQuestion, ExamConfig, FacultyProfile } from "@/lib/api";
import { BRANCHES as BRANCH_LIST } from "@/lib/constants";
import styles from "@/app/faculty/faculty.module.css";

const ControlBtn = ({ label, icon, color, onClick, variant = "ghost" }: any) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={styles.controlBtn}
    style={{ "--btn-color": color, background: variant === "solid" ? color : "transparent", color: variant === "solid" ? "#000" : color, border: `1px solid ${variant === "solid" ? "transparent" : color}` } as any}
  >
    <span>{icon}</span> {label}
  </button>
);

export default function FacultyQuestionsTab({ branches, profile }: { branches: string[], profile: FacultyProfile }) {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [configs, setConfigs] = useState<ExamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "aptitude" | "programming" | "other">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "upcoming" | "inactive">("all");
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [folderBranchModal, setFolderBranchModal] = useState<{ name: string; branches: string[] } | null>(null);
  const [formCategory, setFormCategory] = useState<"aptitude" | "programming" | "other">("other");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingExam, setSchedulingExam] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState({ startDate: "", startTime: "", endDate: "", endTime: "", autoActive: true });

  const [formData, setFormData] = useState<Omit<AdminQuestion, "id">>({
    text: "",
    options: ["", "", "", ""],
    branch: branches[0] || "CS",
    correct_answer: "",
    order_index: 0,
    marks: 1,
    exam_name: "General Assessment",
    image_url: "",
    audio_url: "",
  });

  const isCodingChallenge = formCategory === "programming" && (formData.programming_type === "compiler" || formData.programming_type === "jumble");
  const isSaveDisabled = isCodingChallenge ? !formData.text : (!formData.text || !formData.correct_answer || formData.options.some((o) => !o));

  // Coding challenge fields
  const [challengeTargetOutput, setChallengeTargetOutput] = useState("");
  const [challengeTestCases, setChallengeTestCases] = useState<string>("[]");
  const [challengeStarterCode, setChallengeStarterCode] = useState("");
  const [challengeStarterCodeC, setChallengeStarterCodeC] = useState("");
  const [challengeStarterCodeCpp, setChallengeStarterCodeCpp] = useState("");
  const [adminActiveLangTab, setAdminActiveLangTab] = useState<"python" | "c" | "cpp">("python");
  const [rawJsonMode, setRawJsonMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qData, cData] = await Promise.all([
        fetchAdminQuestions(),
        fetchPublicExamConfig(),
      ]);
      // Filter to faculty's assigned branches AND created by them
      const filtered = qData.filter(q => branches.includes(q.branch) && q.faculty_id === profile.faculty_id);
      setQuestions(filtered);
      setConfigs(cData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [branches]);

  useEffect(() => { load(); }, [load]);

  // ── Category classification ──
  function getCategory(examName: string): "aptitude" | "programming" | "other" {
    const n = examName.toLowerCase();
    if (n.includes("aptitude") || n.includes("quant") || n.includes("reasoning") || n.includes("logical") || n.includes("verbal") || n.includes("english") || n.includes("comprehension") || n.includes("maths") || n.includes("numerical")) return "aptitude";
    if (n.includes("program") || n.includes("code") || n.includes("coding") || n.includes("dsa") || n.includes("algorithm") || n.includes("data structure") || n.includes("python") || n.includes("java") || n.includes("c++") || n.includes("javascript")) return "programming";
    return "other";
  }

  const getQCategory = (q: AdminQuestion) => q.category || getCategory(q.exam_name || "");

  const filteredQuestions = questions.filter((q) => {
    const branchMatch = selectedBranch === "All" || q.branch === selectedBranch;
    let categoryMatch = selectedCategory === "all" || getQCategory(q) === selectedCategory;

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

  const toggleCluster = (key: string) => setExpandedClusters(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Card Palette ──
  const CARD_PALETTE = [
    { accent: "#a78bfa", icon: "📐" },
    { accent: "#8b5cf6", icon: "🧠" },
    { accent: "#4ade80", icon: "📖" },
    { accent: "#fbbf24", icon: "💻" },
  ];

  function inferDifficulty(name: string): "Easy" | "Medium" | "Hard" {
    const n = name.toLowerCase();
    if (n.includes("final") || n.includes("advanced") || n.includes("hard") || n.includes("logical") || n.includes("programming")) return "Hard";
    if (n.includes("mid") || n.includes("aptitude") || n.includes("medium") || n.includes("intermediate")) return "Medium";
    return "Easy";
  }

  function inferDescription(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("aptitude") || n.includes("quant")) return "Tests mathematical reasoning, numerical ability, and problem-solving skills.";
    if (n.includes("logical") || n.includes("reasoning")) return "Evaluates analytical thinking, pattern recognition, and logical deduction.";
    if (n.includes("english") || n.includes("comprehension")) return "Assesses language proficiency, reading comprehension, and grammar.";
    if (n.includes("program") || n.includes("code") || n.includes("cs")) return "Tests programming concepts, algorithms, data structures, and coding logic.";
    return `Assessment covering key topics in ${name}. Evaluates conceptual understanding and practical application skills.`;
  }

  function inferSkills(name: string, branchList: string[]): string[] {
    const n = name.toLowerCase();
    const branchTag = branchList[0] || "General";
    if (n.includes("aptitude") || n.includes("quant")) return ["Arithmetic", "Algebra", "Geometry", "Data Interpretation"];
    if (n.includes("logical") || n.includes("reasoning")) return ["Pattern Recognition", "Analytical Thinking", "Problem Solving"];
    if (n.includes("english") || n.includes("comprehension")) return ["Reading Comprehension", "Grammar", "Vocabulary"];
    if (n.includes("program") || n.includes("code")) return ["Algorithms", "Data Structures", "Programming Logic"];
    return [branchTag, "Core Concepts", "Application", "Analysis"];
  }

  // ── Handlers ──
  const handleAddNewQuestionClick = () => {
    setEditing(null);
    setFormCategory(selectedCategory === "all" ? "other" : selectedCategory);
    setFormData({
      text: "",
      options: ["", "", "", ""],
      branch: branches[0] || "CS",
      correct_answer: "",
      order_index: questions.length,
      marks: 1,
      exam_name: "General Assessment",
      image_url: "",
      audio_url: "",
      programming_type: "compiler",
      faculty_id: profile.faculty_id,
    });
    setChallengeTargetOutput("");
    setChallengeTestCases("[]");
    setChallengeStarterCode("");
    setChallengeStarterCodeC("");
    setChallengeStarterCodeCpp("");
    setAdminActiveLangTab("python");
    setRawJsonMode(false);
    setShowModal(true);
  };

  const handleEditClick = (q: AdminQuestion) => {
    setEditing(q);
    setFormCategory((q.category as any) || "other");
    const type = q.programming_type || "compiler";
    setFormData({ ...q, programming_type: type });
    if (q.category === "programming" && type === "compiler") {
      let parsed = { target_output: "", test_cases: "[]", starter_code: "", starter_code_c: "", starter_code_cpp: "" };
      if (q.options && q.options.length > 0) {
        try { parsed = JSON.parse(q.options[0]); } catch { }
      }
      setChallengeTargetOutput(parsed.target_output || "");
      setChallengeTestCases(parsed.test_cases || "[]");
      setChallengeStarterCode(parsed.starter_code || "");
      setChallengeStarterCodeC(parsed.starter_code_c || "");
      setChallengeStarterCodeCpp(parsed.starter_code_cpp || "");
      setAdminActiveLangTab("python");
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.text) return alert("Please enter question text");
    if (!formData.branch) return alert("Please select a branch");
    const isCoding = formCategory === "programming" && (formData.programming_type === "compiler" || formData.programming_type === "jumble");
    if (!isCoding) {
      if (formData.options.some((o) => !o)) return alert("All options must be filled");
      if (!formData.correct_answer) return alert("Please select a correct answer");
    }
    try {
      let finalOptions = formData.options;
      let finalCorrectAnswer = formData.correct_answer;
      if (isCoding) {
        const challengeData = {
          target_output: challengeTargetOutput,
          test_cases: challengeTestCases,
          starter_code: challengeStarterCode,
          starter_code_c: challengeStarterCodeC,
          starter_code_cpp: challengeStarterCodeCpp,
        };
        finalOptions = [JSON.stringify(challengeData)];
        finalCorrectAnswer = "COMPILER";
      }
      const payload = {
        ...formData,
        category: formCategory,
        options: finalOptions,
        correct_answer: finalCorrectAnswer,
        programming_type: formCategory === "programming" ? formData.programming_type : undefined,
        faculty_id: profile.faculty_id,
      };
      if (editing) await updateAdminQuestion(editing.id, payload);
      else await createAdminQuestion(payload);
      setShowModal(false);
      setEditing(null);
      load();
    } catch { alert("Failed to save question"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try { await deleteAdminQuestion(id); load(); } catch { alert("Failed to delete"); }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`Delete '${folderName}' and ALL questions inside?`)) return;
    try { setLoading(true); await deleteAdminFolder(folderName); load(); }
    catch (e: any) { alert(`Failed: ${e.message}`); }
    finally { setLoading(false); }
  };

  const handleRenameFolder = async (folderName: string) => {
    const newName = prompt(`New name for '${folderName}':`, folderName);
    if (!newName || newName.trim() === folderName) return;
    try { setLoading(true); await renameAdminFolder(folderName, newName.trim()); load(); }
    catch (e: any) { alert(`Failed: ${e.message}`); }
    finally { setLoading(false); }
  };

  const handleEditBranchFolder = (folderName: string) => {
    const currentBranches = questions
      .filter(q => q.exam_name === folderName)
      .map(q => q.branch || "CS")
      .filter((v, i, a) => a.indexOf(v) === i);
    setFolderBranchModal({ name: folderName, branches: currentBranches.length ? currentBranches : ["CS"] });
  };

  const handleSaveFolderBranch = async () => {
    if (!folderBranchModal) return;
    if (folderBranchModal.branches.length === 0) return alert("Select at least one branch");
    try { setLoading(true); await editAdminFolderBranch(folderBranchModal.name, folderBranchModal.branches); load(); setFolderBranchModal(null); }
    catch (e: any) { alert(`Failed: ${e.message}`); }
    finally { setLoading(false); }
  };

  const toggleActivation = async (title: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      await updateExamConfig({ exam_title: title, is_active: !currentStatus });
      setConfigs(prev => prev.map(c => c.exam_title === title ? { ...c, is_active: !currentStatus } : c));
      if (!configs.find(c => c.exam_title === title)) load();
    } catch { alert("Failed to update status"); }
    finally { setLoading(false); }
  };

  const handleUpdateAttempts = async (title: string, current: number) => {
    const val = prompt(`Set max attempts for ${title}:`, current.toString());
    if (val === null) return;
    const num = parseInt(val);
    if (isNaN(num)) return alert("Invalid number");
    try { setLoading(true); await updateExamConfig({ exam_title: title, max_attempts: num }); setConfigs(prev => prev.map(c => c.exam_title === title ? { ...c, max_attempts: num } : c)); }
    catch { alert("Failed to update"); } finally { setLoading(false); }
  };

  const handleUpdateTimings = async (title: string, current: number) => {
    const val = prompt(`Set duration (minutes) for ${title}:`, current.toString());
    if (val === null) return;
    const num = parseInt(val);
    if (isNaN(num)) return alert("Invalid number");
    try { setLoading(true); await updateExamConfig({ exam_title: title, duration_minutes: num }); setConfigs(prev => prev.map(c => c.exam_title === title ? { ...c, duration_minutes: num } : c)); }
    catch { alert("Failed to update"); } finally { setLoading(false); }
  };

  const handleUpdateSchedule = (title: string, start: string | null, end: string | null) => {
    setSchedulingExam(title);
    let sDate = "", sTime = "", eDate = "", eTime = "";
    if (start) { const d = new Date(start); sDate = d.toISOString().split("T")[0]; sTime = d.toTimeString().slice(0, 5); }
    if (end) { const d = new Date(end); eDate = d.toISOString().split("T")[0]; eTime = d.toTimeString().slice(0, 5); }
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
      await updateExamConfig({ exam_title: schedulingExam, scheduled_start: s, scheduled_end: e, is_active: autoActive ? true : undefined });
      setConfigs(prev => prev.map(c => c.exam_title === schedulingExam ? { ...c, scheduled_start: s, scheduled_end: e, is_active: autoActive ? true : c.is_active } : c));
      setShowScheduleModal(false);
    } catch { alert("Failed to schedule"); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.managementPage}>
      {/* ── Header ── */}
      <div className={styles.headerBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 className={styles.headerTitle}>Questions ({filteredQuestions.length})</h2>
          <select className={styles.modalInput} style={{ width: 140, height: 36, padding: "0 8px", fontSize: 13, marginBottom: 0 }}
            value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            <option value="All">All Branches</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <button className={styles.btnPrimary} onClick={handleAddNewQuestionClick}>
          + Add Question
        </button>
      </div>

      {/* ── Category Tabs ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {([
          { key: "all" as const, label: "All", emoji: "📋" },
          { key: "aptitude" as const, label: "Aptitude", emoji: "🧠" },
          { key: "programming" as const, label: "Programming", emoji: "💻" },
          { key: "other" as const, label: "Other", emoji: "📂" },
        ]).map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={selectedCategory === cat.key ? styles.categoryTabActive : styles.categoryTab}
          >
            {cat.emoji} {cat.label} ({catCounts[cat.key]})
          </button>
        ))}
      </div>

      {/* ── Status Tabs ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {([
          { key: "all" as const, label: "All Status", icon: "🌐" },
          { key: "active" as const, label: "Active", icon: "🟢" },
          { key: "upcoming" as const, label: "Upcoming", icon: "🟡" },
          { key: "inactive" as const, label: "Inactive", icon: "⚪" },
        ]).map(stat => (
          <button
            key={stat.key}
            onClick={() => setSelectedStatus(stat.key)}
            className={selectedStatus === stat.key ? styles.statusTabActive : styles.statusTab}
          >
            {stat.icon} {stat.label}
          </button>
        ))}
      </div>

      {/* ── Exam Cards Grid ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <div style={{ width: 32, height: 32, border: "3px solid rgba(139,92,246,0.3)", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyText}>No questions found for the selected filters</div>
        </div>
      ) : (
        <div className={styles.managementGrid}>
          {Object.entries(clusters).map(([clusterKey, clusterQuestions], idx) => {
            const [name, branch] = clusterKey.split("|");
            const palette = CARD_PALETTE[idx % CARD_PALETTE.length];
            const diff = inferDifficulty(name);
            const desc = inferDescription(name);
            const skills = inferSkills(name, [branch]);

            return (
              <div key={clusterKey} style={{ display: "contents" }}>
                {/* Exam Card */}
                <div
                  className={styles.examCard}
                  onClick={() => toggleCluster(clusterKey)}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 22 }}>{palette.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 16, color: palette.accent, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
                        {name} <small style={{ fontWeight: 400, opacity: 0.7 }}>({branch})</small>
                      </div>
                    </div>

                    {/* Control Panel */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
                      {(() => {
                        const conf = configs.find((c: any) => c.exam_title === name);
                        const isManualActive = conf ? conf.is_active : true;
                        const attempts = conf?.max_attempts || 1;
                        const duration = conf?.duration_minutes || 60;
                        const start = conf?.scheduled_start;
                        const end = conf?.scheduled_end;

                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <ControlBtn icon="🔢" label={`Attempts: ${attempts}`} color="#fbbf24" onClick={() => handleUpdateAttempts(name, attempts)} />
                            <ControlBtn icon={isManualActive ? "🟢" : "🔘"} label="Active" color="#4ade80" variant={isManualActive ? "solid" : "ghost"} onClick={() => !isManualActive && toggleActivation(name, false)} />
                            <ControlBtn icon={!isManualActive ? "🔴" : "🔘"} label="Deactivate" color="#f87171" variant={!isManualActive ? "solid" : "ghost"} onClick={() => isManualActive && toggleActivation(name, true)} />
                            <ControlBtn icon="📅" label="Schedule" color="#a78bfa" onClick={() => handleUpdateSchedule(name, start ?? null, end ?? null)} />
                            <ControlBtn icon="🕒" label={`Timings: ${duration}m`} color="#818cf8" onClick={() => handleUpdateTimings(name, duration)} />
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Difficulty Badge */}
                  <div style={{ marginBottom: 12 }}>
                    <span className={diff === "Easy" ? styles.diffBadgeEasy : diff === "Medium" ? styles.diffBadgeMedium : styles.diffBadgeHard}>
                      {diff}
                    </span>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 14 }}>
                    {desc}
                  </p>

                  {/* Skills */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: palette.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      Key Skills Tested:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {skills.map(skill => (
                        <span key={skill} className={styles.skillPill}>{skill}</span>
                      ))}
                    </div>
                  </div>

                  {/* Folder Actions */}
                  <div style={{ display: "flex", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }} onClick={e => e.stopPropagation()}>
                    <button style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600 }} onClick={() => handleRenameFolder(name)}>Rename</button>
                    <button style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600 }} onClick={() => handleEditBranchFolder(name)}>Edit Branch</button>
                    <button style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(211,47,47,0.2)", background: "transparent", color: "#f87171", cursor: "pointer", fontWeight: 600, marginLeft: "auto" }} onClick={() => handleDeleteFolder(name)}>Delete</button>
                  </div>

                  {/* Footer */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                      📋 {clusterQuestions.length} question{clusterQuestions.length !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 12, color: palette.accent, fontWeight: 700 }}>
                      {expandedClusters[clusterKey] ? "▲ Collapse" : "▼ View Questions"}
                    </span>
                  </div>
                </div>

                {/* Expanded Questions Grid */}
                {expandedClusters[clusterKey] && (
                  <div className={styles.expandedView}>
                    <div className={styles.expandedHeader}>
                      <div>
                        <h4 style={{ margin: 0, color: palette.accent }}>{name} ({branch})</h4>
                        <small style={{ color: "#64748b" }}>{clusterQuestions.length} Questions</small>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button className={styles.btnSecondary} style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => handleRenameFolder(name)}>Rename</button>
                        <button className={styles.btnSecondary} style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => handleEditBranchFolder(name)}>Edit Branch</button>
                        <button className={styles.btnSecondary} style={{ fontSize: 12, padding: "4px 12px", borderColor: "rgba(239,68,68,0.3)", color: "#f87171" }} onClick={() => handleDeleteFolder(name)}>Delete Folder</button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                      {clusterQuestions.map((q) => (
                        <div key={q.id} className={styles.questionCard}>
                          <div className={styles.questionCardHeader}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: palette.accent }}>Q{q.order_index + 1}</div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }} title="Edit" onClick={() => handleEditClick(q)}>✏️</button>
                              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }} title="Delete" onClick={() => handleDelete(q.id)}>🗑️</button>
                            </div>
                          </div>
                          {q.image_url && (
                            <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <img src={q.image_url} alt="Q" style={{ width: "100%", maxHeight: 160, objectFit: "contain", display: "block" }} />
                            </div>
                          )}
                          <p className={styles.questionCardText}>{q.text}</p>
                          <div className={styles.questionCardFooter}>
                            <span className={styles.branchTag}>{q.branch}</span>
                            <span className={styles.branchTag}>{q.marks} Marks</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 20, textAlign: "right" }}>
                      <button className={styles.btnSecondary} onClick={() => toggleCluster(clusterKey)}>Close</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add/Edit Question Modal ── */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 850 }}>
            <h3>{editing ? "Edit Question" : "Add Question"}</h3>

            {/* Category / Branch / Exam Identity */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div className={styles.modalFormGroup} style={{ margin: 0 }}>
                <label>Category</label>
                <select className={styles.modalInput} value={formCategory} onChange={(e) => {
                  const newCat = e.target.value as any;
                  setFormCategory(newCat);
                  if (newCat === "programming") setFormData(prev => ({ ...prev, programming_type: prev.programming_type || "compiler" }));
                }}>
                  <option value="aptitude">🧠 Aptitude</option>
                  <option value="programming">💻 Programming</option>
                  <option value="other">📂 Other</option>
                </select>
              </div>

              {formCategory === "programming" && (
                <div className={styles.modalFormGroup} style={{ margin: 0 }}>
                  <label>Programming Type</label>
                  <select className={styles.modalInput} value={formData.programming_type || "compiler"}
                    onChange={(e) => setFormData(prev => ({ ...prev, programming_type: e.target.value as any }))}>
                    <option value="jumble">🧩 Code Jumble</option>
                    <option value="compiler">📁 Logic Building</option>
                    <option value="mcq">📝 Conceptual MCQs</option>
                  </select>
                </div>
              )}

              <div className={styles.modalFormGroup} style={{ margin: 0 }}>
                <label>Branch</label>
                <select className={styles.modalInput} value={formData.branch} onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}>
                  {branches.map(b => {
                    const info = BRANCH_LIST.find(x => x.id === b);
                    return <option key={b} value={b}>{info ? info.name : b}</option>;
                  })}
                </select>
              </div>

              <div className={styles.modalFormGroup} style={{ margin: 0 }}>
                <label>Exam Identity (Folder)</label>
                <select className={styles.modalInput}
                  value={Array.from(new Set(questions.map(q => q.exam_name))).includes(formData.exam_name) ? formData.exam_name : "NEW_IDENTITY"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "NEW_IDENTITY") setFormData(prev => ({ ...prev, exam_name: "" }));
                    else setFormData(prev => ({ ...prev, exam_name: val }));
                  }}>
                  <option value="">Select Identity...</option>
                  {Array.from(new Set(questions.map(q => q.exam_name))).filter(Boolean).sort().map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="NEW_IDENTITY">+ Add New Identity</option>
                </select>
                {(formData.exam_name === "" || !Array.from(new Set(questions.map(q => q.exam_name))).includes(formData.exam_name)) && (
                  <input type="text" className={styles.modalInput} placeholder="Enter New Identity Name..." style={{ marginTop: 8 }}
                    value={formData.exam_name} onChange={(e) => setFormData(prev => ({ ...prev, exam_name: e.target.value }))} />
                )}
              </div>
            </div>

            {/* Marks & Order */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div className={styles.modalFormGroup} style={{ margin: 0 }}>
                <label>Marks</label>
                <input type="number" className={styles.modalInput} value={formData.marks} onChange={(e) => setFormData(prev => ({ ...prev, marks: +e.target.value }))} />
              </div>
              <div className={styles.modalFormGroup} style={{ margin: 0 }}>
                <label>Order Index</label>
                <input type="number" className={styles.modalInput} value={formData.order_index} onChange={(e) => setFormData(prev => ({ ...prev, order_index: +e.target.value }))} />
              </div>
            </div>

            {/* Question Text */}
            <div className={styles.modalFormGroup}>
              <label>{isCodingChallenge ? "Coding Challenge Prompt" : "Question Text"}</label>
              <textarea className={styles.modalInput} value={formData.text} onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))} rows={3} placeholder="Enter question text..." style={{ minHeight: 80, resize: "vertical" }} />
            </div>

            {/* Type-Specific Editor */}
            {isCodingChallenge ? (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: 24, margin: "20px 0", display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#a78bfa" }}>💻 Coding Challenge Configuration</h4>
                </div>

                {/* Starter Code Tabs */}
                <div className={styles.modalFormGroup} style={{ margin: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ margin: 0 }}>Starter Code Template</label>
                    <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.03)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                      {(["python", "c", "cpp"] as const).map((lang) => (
                        <button key={lang} type="button" onClick={() => setAdminActiveLangTab(lang)} style={{
                          background: adminActiveLangTab === lang ? "#a78bfa" : "transparent",
                          color: adminActiveLangTab === lang ? "#000" : "#94a3b8",
                          border: "none", padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                        }}>
                          {lang === "python" ? "🐍 Python" : lang === "c" ? "🇨 C" : "➕ C++"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {adminActiveLangTab === "python" && (
                    <textarea className={styles.modalInput} style={{ fontFamily: "monospace", fontSize: 13, minHeight: 120 }}
                      value={challengeStarterCode} onChange={(e) => setChallengeStarterCode(e.target.value)}
                      placeholder={`def solution(arr):\n    # Write your code here\n    return False`} rows={5} />
                  )}
                  {adminActiveLangTab === "c" && (
                    <textarea className={styles.modalInput} style={{ fontFamily: "monospace", fontSize: 13, minHeight: 120 }}
                      value={challengeStarterCodeC} onChange={(e) => setChallengeStarterCodeC(e.target.value)}
                      placeholder={`#include <stdio.h>\nint main() {\n    return 0;\n}`} rows={5} />
                  )}
                  {adminActiveLangTab === "cpp" && (
                    <textarea className={styles.modalInput} style={{ fontFamily: "monospace", fontSize: 13, minHeight: 120 }}
                      value={challengeStarterCodeCpp} onChange={(e) => setChallengeStarterCodeCpp(e.target.value)}
                      placeholder={`#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}`} rows={5} />
                  )}
                </div>

                <div className={styles.modalFormGroup} style={{ margin: 0 }}>
                  <label>Expected Target Output</label>
                  <input type="text" className={styles.modalInput} value={challengeTargetOutput} onChange={(e) => setChallengeTargetOutput(e.target.value)} placeholder="e.g. Hello, World!" />
                </div>

                {/* Test Cases */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#94a3b8", textTransform: "uppercase" }}>Test Cases</label>
                    <button type="button" className={styles.btnSecondary} style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => setRawJsonMode(!rawJsonMode)}>
                      {rawJsonMode ? "👁️ Visual" : "📝 JSON"}
                    </button>
                  </div>
                  {rawJsonMode ? (
                    <textarea className={styles.modalInput} style={{ fontFamily: "monospace", fontSize: 12, minHeight: 120 }}
                      value={challengeTestCases} onChange={(e) => setChallengeTestCases(e.target.value)}
                      placeholder='[{"input": "5", "expected": "25"}]' rows={5} />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(() => {
                        let cases: { input: string; expected: string }[] = [];
                        try { cases = JSON.parse(challengeTestCases || "[]"); } catch { }
                        return (
                          <>
                            {cases.map((tc, index) => (
                              <div key={index} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input type="text" placeholder={`Input #${index + 1}`} className={styles.modalInput} style={{ marginBottom: 0, fontSize: 13 }}
                                  value={tc.input} onChange={(e) => { const u = [...cases]; u[index].input = e.target.value; setChallengeTestCases(JSON.stringify(u)); }} />
                                <input type="text" placeholder={`Expected #${index + 1}`} className={styles.modalInput} style={{ marginBottom: 0, fontSize: 13 }}
                                  value={tc.expected} onChange={(e) => { const u = [...cases]; u[index].expected = e.target.value; setChallengeTestCases(JSON.stringify(u)); }} />
                                <button type="button" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#f87171" }}
                                  onClick={() => { setChallengeTestCases(JSON.stringify(cases.filter((_, i) => i !== index))); }}>🗑️</button>
                              </div>
                            ))}
                            <button type="button" className={styles.btnSecondary} style={{ width: "max-content", fontSize: 12, padding: "8px 16px" }}
                              onClick={() => setChallengeTestCases(JSON.stringify([...cases, { input: "", expected: "" }]))}>
                              ➕ Add Test Case
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className={styles.modalFormGroup}>
                  <label>Options</label>
                  <div className={styles.optionsGrid}>
                    {formData.options.map((opt, i) => (
                      <input key={i} className={styles.modalInput} placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                        onChange={(e) => { const n = [...formData.options]; n[i] = e.target.value; setFormData(prev => ({ ...prev, options: n })); }} />
                    ))}
                  </div>
                </div>
                <div className={styles.modalFormGroup}>
                  <label>Correct Answer</label>
                  <select className={styles.modalInput} value={formData.correct_answer} onChange={(e) => setFormData(prev => ({ ...prev, correct_answer: e.target.value }))}>
                    <option value="">Select correct option…</option>
                    {formData.options.map((_, i) => <option key={i} value={String.fromCharCode(65 + i)}>Option {String.fromCharCode(65 + i)}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Image/Audio Upload */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div className={styles.modalFormGroup}>
                <label>Image (Optional)</label>
                {formData.image_url ? (
                  <div className={styles.imagePreviewContainer}>
                    <img src={formData.image_url} alt="Q" className={styles.imagePreview} />
                    <button className={styles.removeImageBtn} type="button" onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))}>×</button>
                  </div>
                ) : (
                  <div className={styles.uploadZone}>
                    <input type="file" id="fq-img-upload" style={{ display: "none" }} accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try { const url = await uploadQuestionImage(file); setFormData(prev => ({ ...prev, image_url: url })); }
                        catch (err: any) { alert(`Upload failed: ${err.message}`); }
                      }} />
                    <label htmlFor="fq-img-upload" style={{ cursor: "pointer", display: "block", padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>Upload Image</div>
                    </label>
                  </div>
                )}
              </div>
              <div className={styles.modalFormGroup}>
                <label>Audio (Optional)</label>
                {formData.audio_url ? (
                  <div className={styles.imagePreviewContainer} style={{ flexDirection: "column", gap: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>🎧 Audio</div>
                    <audio src={formData.audio_url} controls style={{ width: "100%", height: 32 }} />
                    <button className={styles.removeImageBtn} type="button" onClick={() => setFormData(prev => ({ ...prev, audio_url: "" }))}>×</button>
                  </div>
                ) : (
                  <div className={styles.uploadZone}>
                    <input type="file" id="fq-audio-upload" style={{ display: "none" }} accept="audio/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try { const url = await uploadQuestionImage(file); setFormData(prev => ({ ...prev, audio_url: url })); }
                        catch (err: any) { alert(`Upload failed: ${err.message}`); }
                      }} />
                    <label htmlFor="fq-audio-upload" style={{ cursor: "pointer", display: "block", padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>🎵</div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>Upload Audio</div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={isSaveDisabled}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Folder Branch Modal ── */}
      {folderBranchModal && (
        <div className={styles.modalOverlay} onClick={() => setFolderBranchModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <h3>Manage Branches</h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 24, lineHeight: 1.5 }}>
              Select departments for <strong>{folderBranchModal.name}</strong>.
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "10px 20px",
              background: "rgba(255,255,255,0.02)",
              padding: 20,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
              maxHeight: 400,
              overflowY: "auto",
            }}>
              {BRANCH_LIST.map(b => {
                const isChecked = folderBranchModal.branches.includes(b.id);
                return (
                  <label key={b.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer",
                    padding: "10px 12px", borderRadius: 10,
                    background: isChecked ? "rgba(139,92,246,0.08)" : "transparent",
                    border: isChecked ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
                    transition: "all 0.2s",
                  }}>
                    <input type="checkbox" checked={isChecked} onChange={(e) => {
                      const newBranches = e.target.checked
                        ? [...folderBranchModal.branches, b.id]
                        : folderBranchModal.branches.filter(id => id !== b.id);
                      setFolderBranchModal({ ...folderBranchModal, branches: newBranches });
                    }} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#8b5cf6", marginTop: 2 }} />
                    <span style={{ color: isChecked ? "#e2e8f0" : "#94a3b8", fontWeight: isChecked ? 600 : 400, fontSize: 13, lineHeight: 1.4 }}>
                      {b.name}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className={styles.modalActions} style={{ marginTop: 32 }}>
              <button className={styles.btnSecondary} onClick={() => setFolderBranchModal(null)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSaveFolderBranch}>Sync Branches</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Modal ── */}
      {showScheduleModal && (
        <div className={styles.modalOverlay} onClick={() => setShowScheduleModal(false)}>
          <div className={styles.modal} style={{ maxWidth: 450, padding: 32, borderRadius: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 32 }}>📅</span>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Auto Schedule</h3>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "12px 16px", background: "rgba(139,92,246,0.1)", borderRadius: 12 }}>
              <input type="checkbox" id="fAutoActive" checked={scheduleData.autoActive}
                onChange={(e) => setScheduleData({ ...scheduleData, autoActive: e.target.checked })}
                style={{ width: 20, height: 20, accentColor: "#8b5cf6" }} />
              <label htmlFor="fAutoActive" style={{ fontSize: 15, fontWeight: 500, color: "#a78bfa", cursor: "pointer" }}>
                Enable Automatic Activation
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Start Date</label>
                <input type="date" className={styles.modalInput} value={scheduleData.startDate}
                  onChange={(e) => setScheduleData({ ...scheduleData, startDate: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Start Time</label>
                <input type="time" className={styles.modalInput} value={scheduleData.startTime}
                  onChange={(e) => setScheduleData({ ...scheduleData, startTime: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>End Date</label>
                <input type="date" className={styles.modalInput} value={scheduleData.endDate}
                  onChange={(e) => setScheduleData({ ...scheduleData, endDate: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>End Time</label>
                <input type="time" className={styles.modalInput} value={scheduleData.endTime}
                  onChange={(e) => setScheduleData({ ...scheduleData, endTime: e.target.value })} />
              </div>
            </div>

            <button className={styles.btnPrimary} onClick={handleSaveSchedule}
              style={{ width: "100%", padding: 16, borderRadius: 16, fontSize: 16, fontWeight: 600 }}>
              Confirm Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

