"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { loginStudent } from "@/lib/api";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [usn, setUsn] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

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
        branch: "CS"
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

  return (
    <div className={styles.container}>
      <div className={styles.bgImage} />
      <div className={styles.overlay} />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.card}
      >
        {/* Shield Crest Graphic (SVG) */}
        <svg className={styles.crest} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.75-7 9.81-3.87-1.06-7-5.14-7-9.81V6.3l7-3.12z"/>
        </svg>

        <div className={styles.titleMain}>Campus Nexus</div>
        <h1 className={styles.titleSub}>Student Hub</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* USN / Username */}
          <div className={styles.inputWrap}>
            <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <input
              type="text"
              className={styles.inputField}
              placeholder="Email ID / USN No"
              value={usn}
              onChange={(e) => setUsn(e.target.value)}
              disabled={loading}
              spellCheck="false"
              required
            />
          </div>

          {/* Password */}
          <div className={styles.inputWrap}>
            <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
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

          {/* Registration Mode Expansion */}
          <AnimatePresence>
            {isRegistering && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={styles.form}
                style={{ overflow: 'hidden' }}
              >
                <div className={styles.inputWrap}>
                  <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isRegistering}
                  />
                </div>
                <div className={styles.inputWrap}>
                  <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input
                    type="email"
                    className={styles.inputField}
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required={isRegistering}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Verifying..." : "Secure Login"}
          </button>
        </form>

        <div className={styles.linksRow}>
          <div className={styles.link} onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "Back to Login" : "Forgot Password?"}
          </div>
          <div className={styles.link} onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "" : "Request Access"}
          </div>
        </div>
      </motion.div>

      {/* Campus Pulse Ticker */}
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
          {/* Repeat for seamless scrolling */}
          <span>Registration Deadline: Sept 15</span>
          <span>•</span>
          <span>New Research Grant Winners Announced!</span>
        </div>
      </div>
    </div>
  );
}
