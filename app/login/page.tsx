"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { loginStudent, submitSupportRequest } from "@/lib/api";
import { BRANCHES } from "@/lib/constants";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [usn, setUsn] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState("DS");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [helpUsn, setHelpUsn] = useState("");
  const [helpProblem, setHelpProblem] = useState("");
  const [isHelpSubmitted, setIsHelpSubmitted] = useState(false);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    
    if (!usn.trim() || !password.trim()) {
      setError("Credentials required to access the hub.");
      return;
    }

    if (isRegistering && (!name.trim() || !email.trim())) {
      setError("Incomplete registration profile.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await loginStudent(usn.trim(), password, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        branch: branch
      });

      sessionStorage.setItem("exam_token", data.access_token);
      sessionStorage.setItem(
        "exam_student",
        JSON.stringify({
          id: data.student_id,
          usn: usn.trim().toUpperCase(),
          name: data.student_name,
          email: data.email,
          branch: data.branch,
          examStartTime: data.exam_start_time,
          examDurationMinutes: data.exam_duration_minutes || 20,
          examTitle: data.exam_title,
          totalQuestions: data.total_questions,
          avatarUrl: data.avatar_url,
        })
      );

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
      setLoading(false);
    }
  }

  const selectedBranchName = BRANCHES.find(b => b.id === branch)?.name || "Select Branch";

  return (
    <div className={styles.container}>
      <div className={styles.bgImage} />
      <div className={styles.overlay} />

      {/* Top Right Help Button */}
      <button 
        className={styles.helpBtn}
        onClick={() => setShowForgotModal(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Get Help
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.card}
      >
        <svg className={styles.crest} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.75-7 9.81-3.87-1.06-7-5.14-7-9.81V6.3l7-3.12z" />
        </svg>

        <div className={styles.titleMain}>Campus Nexus</div>
        <h1 className={styles.titleSub}>Student Hub</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrap}>
            <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <input
              type="text"
              className={styles.inputField}
              placeholder={isRegistering ? "USN No" : "Email ID / USN No"}
              value={usn}
              onChange={(e) => {
                const val = e.target.value;
                setUsn(isRegistering ? val.toUpperCase() : val);
              }}
              disabled={loading}
              spellCheck="false"
              required
            />
          </div>

          <div className={styles.inputWrap}>
            <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              type="password"
              className={styles.inputField}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              spellCheck="false"
              required
            />
          </div>

          <AnimatePresence>
            {isRegistering && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={styles.form}
                style={{ overflow: 'visible' }}
              >
                <div className={styles.inputWrap}>
                  <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isRegistering}
                    spellCheck="false"
                  />
                </div>
                <div className={styles.inputWrap}>
                  <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    type="email"
                    className={styles.inputField}
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required={isRegistering}
                    spellCheck="false"
                  />
                </div>
                
                <div className={styles.selectWrapper}>
                  <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <div 
                    className={styles.selectTrigger} 
                    onClick={() => setIsBranchOpen(!isBranchOpen)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedBranchName}
                    </span>
                    <span style={{ fontSize: '10px', opacity: 0.5 }}>{isBranchOpen ? "▲" : "▼"}</span>
                  </div>
                  
                  <AnimatePresence>
                    {isBranchOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={styles.selectOptions}
                      >
                        {BRANCHES.map(b => (
                          <div 
                            key={b.id} 
                            className={styles.selectOption}
                            onClick={() => {
                              setBranch(b.id);
                              setIsBranchOpen(false);
                            }}
                          >
                            {b.name}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Verifying..." : isRegistering ? "Secure Sign In" : "Secure Login"}
          </button>
        </form>

        <div className={styles.linksRow}>
          <div 
            className={styles.link} 
            onClick={() => {
              if (isRegistering) {
                setIsRegistering(false);
              } else {
                setShowForgotModal(true);
              }
            }}
          >
            {isRegistering ? "Back to Login" : "Forgot Password?"}
          </div>
          <div className={styles.link} onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "" : "Request Access"}
          </div>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay}
            onClick={() => setShowForgotModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
            >
              {isHelpSubmitted ? (
                <>
                  <svg className={styles.modalIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <h2 className={styles.modalTitle}>Request Sent</h2>
                  <p className={styles.modalText}>
                    Your help request has been submitted. Please wait for a faculty member or administrator to reach out to you.
                  </p>
                  <button 
                    className={styles.modalCloseBtn}
                    onClick={() => {
                      setShowForgotModal(false);
                      setIsHelpSubmitted(false);
                    }}
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <svg className={styles.crest} viewBox="0 0 24 24" fill="currentColor" style={{ width: 40, height: 40, marginBottom: 12 }}>
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.75-7 9.81-3.87-1.06-7-5.14-7-9.81V6.3l7-3.12z" />
                  </svg>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, color: '#94a3b8', marginBottom: 4 }}>
                    Campus Nexus:
                  </div>
                  <h2 className={styles.modalTitle} style={{ fontSize: 32, marginBottom: 4 }}>Recovery</h2>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24, fontWeight: 500 }}>
                    Secure Academic Intelligence Framework
                  </p>

                  <p className={styles.modalText} style={{ fontSize: 16, lineHeight: 1.6, color: '#cbd5e1', marginBottom: 32 }}>
                    Please contact the <strong style={{ color: '#fff' }}>Admin or Faculty</strong> to reset your password or recover your account details.
                  </p>
                  
                  <button 
                    className={styles.submitBtn} 
                    style={{ 
                      textTransform: 'uppercase', 
                      letterSpacing: 2,
                      background: 'linear-gradient(135deg, #d4af37 0%, #c2a16d 100%)',
                      color: '#1e1b4b',
                      fontWeight: 800
                    }}
                    onClick={() => setShowForgotModal(false)}
                  >
                    Understood
                  </button>

                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24, fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      Secure Node
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      Multi-Factor
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.pulseBar}>
        <div className={styles.pulseBadge}>Campus Pulse</div>
        <div className={styles.pulseContent}>
          <span>Registration Deadline: Sept 15</span>
          <span>•</span>
          <span>New Research Grant Winners Announced!</span>
          <span>•</span>
          <span>Campus Safety Alert: Standard Procedures in Place.</span>
          <span>•</span>
          <span>Upcoming Tech Symposium: Register Today!</span>
          <span>•</span>
          <span>Registration Deadline: Sept 15</span>
          <span>•</span>
          <span>New Research Grant Winners Announced!</span>
        </div>
      </div>
    </div>
  );
}
