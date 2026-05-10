"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./instructions.module.css";
import { startExam } from "@/lib/api";
import { clearExamStorage } from "@/hooks/useExamState";
import Skeleton from "@/components/Skeleton";
import { useFullscreen } from "@/hooks/useFullscreen";

export default function InstructionsPage() {
  const router = useRouter();
  const [studentInfo, setStudentInfo] = useState<{
    name: string, 
    usn: string,
    examTitle: string,
    duration: number,
    totalQuestions: number
  } | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("exam_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const studentData = localStorage.getItem("exam_student");
    const selectedTitle = localStorage.getItem("exam_selected_title");
    const selectedDuration = localStorage.getItem("exam_selected_duration");
    
    if (studentData) {
      try {
        const parsed = JSON.parse(studentData);
        setStudentInfo({
          name: parsed.name || "Student",
          usn: parsed.usn || "Candidate",
          examTitle: selectedTitle || parsed.examTitle || "Online Assessment",
          duration: selectedDuration ? parseInt(selectedDuration) : (parsed.examDurationMinutes || 20),
          totalQuestions: parsed.totalQuestions || 30,
        });
      } catch (err) {
        console.error("Could not parse student data", err);
      }
    } else if (selectedTitle) {
      setStudentInfo({
        name: "Student",
        usn: "Candidate",
        examTitle: selectedTitle,
        duration: selectedDuration ? parseInt(selectedDuration) : 20,
        totalQuestions: 30
      });
    } else {
      setStudentInfo({ 
        name: "Student", 
        usn: "Candidate", 
        examTitle: "Online Assessment", 
        duration: selectedDuration ? parseInt(selectedDuration) : 20,
        totalQuestions: 30 
      });
    }
  }, [router]);

  const { enter: enterFullscreen } = useFullscreen();

  const handleStartExam = async () => {
    if (starting) return;
    
    // ── Trigger Fullscreen IMMEDIATELY to catch user gesture ──
    try {
      await enterFullscreen();
    } catch (e) {
      console.warn("Manual fullscreen trigger failed:", e);
    }

    setStarting(true);
    try {
      const res = await startExam(studentInfo?.examTitle || "Initial Assessment");
      
      // Clear previous student's cached answers before starting new exam
      clearExamStorage();
      
      // Store the specific title being used for the exam page
      localStorage.setItem("exam_selected_title", studentInfo?.examTitle || "Online Assessment");

      // Update localStorage with the real start time (exam page reads from localStorage!)
      const studentData = localStorage.getItem("exam_student");
      if (studentData) {
        const parsed = JSON.parse(studentData);
        parsed.examStartTime = res.started_at;
        localStorage.setItem("exam_student", JSON.stringify(parsed));
      }

      router.push("/exam");
    } catch (err: any) {
      console.error("Failed to start exam", err);
      let msg = "Error starting exam.";
      
      if (err.message?.includes("425") || err.message?.includes("scheduled")) {
        msg = "This exam is scheduled for a future time. Please wait until the start time.";
      } else if (err.message?.includes("423") || err.message?.includes("inactive")) {
        msg = "This exam is currently inactive. Please contact the administrator.";
      } else {
        // Include detailed error if available for debugging
        const detail = err.detail || err.message || JSON.stringify(err);
        msg = `System Error: ${detail}. Please try refreshing or contact support.`;
      }
      
      alert(msg);
      setStarting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("exam_token");
    localStorage.removeItem("exam_student");
    localStorage.removeItem("exam_selected_title");
    localStorage.removeItem("exam_selected_duration");
    clearExamStorage();
    router.replace("/login");
  };

  if (!studentInfo) {
    return (
      <div className={styles.wrapper}>
        <div className="page-skeleton-wrap">
          <Skeleton height={40} width="60%" borderRadius={12} />
          <Skeleton height={300} borderRadius={24} />
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <Skeleton height={50} width={150} borderRadius={12} />
            <Skeleton height={50} width={150} borderRadius={12} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {/* Logo or empty space */}
        </div>
        <div className={styles.headerRight}>
          <div className={styles.studentInfo}>
            <span className={styles.studentName}>{studentInfo.name}</span>
            <span className={styles.studentRole}>{studentInfo.usn}</span>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn} title="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </div>
      </header>

      {/* ── Main Instructions ── */}
      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>{studentInfo.examTitle} Instructions</h1>

          <div className={styles.detailsBox}>
            <h2 className={styles.detailsTitle}>Exam Details</h2>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <svg className={styles.detailIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Candidate Name: {studentInfo.name}
              </div>
              <div className={styles.detailItem}>
                <svg className={styles.detailIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Duration: {studentInfo.duration} minutes
              </div>
              <div className={styles.detailItem}>
                <svg className={styles.detailIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Total Questions: {studentInfo.totalQuestions}
              </div>
              <div className={styles.detailItem}>
                <svg className={styles.detailIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                Proctoring: Enabled
              </div>
            </div>
          </div>

          <h2 className={styles.instructionsTitle}>Important Instructions</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span className={styles.bullet}>•</span>
              Read each question carefully before answering.
            </li>
            <li className={styles.listItem}>
              <span className={styles.bullet}>•</span>
              You can navigate between questions using the navigation buttons.
            </li>
            <li className={styles.listItem}>
              <span className={styles.bullet}>•</span>
              Your answers will be auto-saved. However, ensure you submit before time expires.
            </li>
            <li className={styles.listItem}>
              <span className={styles.bullet}>•</span>
              Do not switch tabs, minimize the browser window, or exit fullscreen during the exam.
            </li>
            <li className={styles.listItem}>
              <span className={styles.bullet}>•</span>
              Right-clicking, copying, pasting, and all keyboard shortcuts are strictly disabled and monitored. Do not switch tabs, automatic submission and disqualify you.
            </li>
            <li className={styles.listItem}>
              <span className={styles.bullet}>•</span>
              You can mark questions for review and come back to them later.
            </li>
          </ul>

          <div className={styles.actionArea}>
            <button 
              onClick={handleStartExam} 
              className={styles.startBtn}
              disabled={starting}
            >
              {starting ? (
                <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                   <div className="skeleton" style={{ position: "absolute", inset: 0, opacity: 0.2, borderRadius: "12px" }} />
                   <span>Initializing...</span>
                </div>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Start Exam
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
