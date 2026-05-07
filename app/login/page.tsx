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
  // Hidden/Defaulted for the clean look, but needed for backend auto-reg
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState("CS");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("Candidate");
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    
    if (!usn.trim() || !password.trim()) {
      setError("Please enter your ID and password.");
      return;
    }

    if (isRegistering && (!name.trim() || !email.trim())) {
      setError("Please fill in your name and email for registration.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // If not registering, we send empty name/email. 
      // The backend uses them ONLY if the student doesn't exist.
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
      setError(err.message || "Login failed.");
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.bgImage} />
      <div className={styles.overlay} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={styles.card}
      >
        {/* Logo */}
        <div className={styles.logoContainer}>
          <div className={styles.logoText}>FOCUS<span>R</span></div>
        </div>

        <h1 className={styles.welcomeText}>Welcome back</h1>
        <p className={styles.signinText}>Sign in to continue</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* USN / Email */}
          <div className={styles.inputWrap}>
            <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <input
              type="text"
              className={styles.inputField}
              placeholder="Email address / USN"
              value={usn}
              onChange={(e) => setUsn(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Password */}
          <div className={styles.inputWrap}>
            <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type="password"
              className={styles.inputField}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Registration Fields (Animated) */}
          <AnimatePresence>
            {isRegistering && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div className={styles.inputWrap}>
                  <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
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
                  <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 8h4M7 12h6M7 16h5"/>
                  </svg>
                  <input
                    type="email"
                    className={styles.inputField}
                    placeholder="Primary Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required={isRegistering}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '8px' }}>
            <button 
              type="button" 
              className={styles.forgotPass} 
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setIsRegistering(!isRegistering)}
            >
              {isRegistering ? "Back to Login" : "First time? Register here"}
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Processing..." : isRegistering ? "Sign Up" : "Sign In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
