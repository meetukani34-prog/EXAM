"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePyodide } from '@/hooks/usePyodide';
import { supabase } from '@/lib/supabase';
import styles from './PyHuntView.module.css';
import AntiCheat from './AntiCheat';

const ROUNDS = [
  { id: 1, name: "MCQ Logic", description: "Identify the correct Python syntax and logic from the given options.", target: "syntax" },
  { id: 2, name: "Code Jumble", description: "Rearrange the logical blocks to achieve the target state.", target: "structural" },
  { id: 3, name: "Palindrome", description: "Master the strings. Implement a palindrome verifier.", target: "linguistic" },
  { id: 4, name: "FizzBuzz", description: "Implement the FizzBuzz pattern (1-100) with maximum precision.", target: "algorithmic" },
  { id: 5, name: "Final Transmission", description: "The ultimate sequence. Decrypt the final campus coordinate.", target: "visual" },
];

export default function PyHuntView() {
  const [hasStarted, setHasStarted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authForm, setAuthForm] = useState({ usn: "", missionCode: "" });
  const [authError, setAuthError] = useState("");
  
  const [currentRound, setCurrentRound] = useState(1);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const { runCode, loading: pyLoading } = usePyodide();
  const [student, setStudent] = useState<any>(null);
  
  // Gate State
  const [isAtGate, setIsAtGate] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [gateError, setGateError] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("exam_student");
    if (!raw) return;
    const info = JSON.parse(raw);
    setStudent(info);
    setAuthForm(prev => ({ ...prev, usn: info.usn || "" }));

    async function syncProgress() {
      // ── Fetch Global Config (Start Code & USNs) ──────────
      const globalAuthRaw = localStorage.getItem("pyhunt_global_auth");
      if (globalAuthRaw) {
        const ga = JSON.parse(globalAuthRaw);
        // If authorized USNs are listed, check if this student is allowed
        if (ga.authorizedUsns && ga.authorizedUsns.trim()) {
           const allowedList = ga.authorizedUsns.split(',').map((u: string) => u.trim().toUpperCase());
           if (!allowedList.includes(info.usn?.toUpperCase())) {
              setAuthError("CRITICAL: Your USN is not authorized for this logic session.");
           }
        }
      }

      const { data } = await supabase
        .from('odyssey_progress')
        .select('*')
        .eq('student_id', info.id)
        .single();

      if (data) {
        setCurrentRound(data.current_round);
      } else {
        await supabase.from('odyssey_progress').insert([{ student_id: info.id, current_round: 1 }]);
      }

      // ── Initialize exam_status for AntiCheat Sync ─────────
      try {
        const { data: statusData } = await supabase
          .from('exam_status')
          .select('*')
          .eq('student_id', info.id)
          .eq('exam_name', 'PyHunt')
          .single();

        if (!statusData) {
          await supabase.from('exam_status').insert([{
            student_id: info.id,
            exam_name: 'PyHunt',
            status: 'active',
            started_at: new Date().toISOString(),
            warnings: 0
          }]);
        }
      } catch (err) {
        console.error("Failed to sync exam_status for PyHunt:", err);
      }

      setLoading(false);
    }
    syncProgress();
  }, []);

  const handleAuthorize = () => {
    const globalAuthRaw = localStorage.getItem("pyhunt_global_auth");
    let targetCode = "PYHUNT67"; // Fallback
    if (globalAuthRaw) {
      targetCode = JSON.parse(globalAuthRaw).startCode || "PYHUNT67";
    }

    if (authForm.missionCode.toUpperCase() === targetCode.toUpperCase()) {
      if (authError.startsWith("CRITICAL")) return; // Don't allow if USN blocked
      setIsAuthorized(true);
      setAuthError("");
    } else {
      setAuthError("Invalid Mission Authorization Code.");
    }
  };

  const handleExecute = async () => {
    setOutput("Executing Logic...");
    const result = await runCode(code);
    
    if (result.error) {
      setOutput(`ERROR: ${result.error}`);
      return;
    }

    setOutput(result.stdout || "No output generated.");
    
    const isValid = validateRound(currentRound, result.stdout);
    if (isValid) {
      setIsAtGate(true);
    }
  };

  const validateRound = (round: number, stdout: string) => {
    const out = stdout.trim();
    if (round === 1) return out === "Key: Manifested";
    if (round === 3) return out.toLowerCase().includes("palindrome: true");
    if (round === 4) return out.includes("1, 2, Fizz, 4, Buzz");
    return false;
  };

  const handleGateUnlock = async () => {
    const savedConfigs = JSON.parse(localStorage.getItem("pyhunt_config_local") || "[]");
    const currentConfig = savedConfigs.find((c: any) => c.round === currentRound);
    const targetCode = currentConfig?.code || (currentRound === 1 ? "LIBRARY42" : "ALPHA");

    if (gateInput.trim().toUpperCase() === targetCode.toUpperCase()) {
      const next = currentRound + 1;
      setCurrentRound(next);
      setIsAtGate(false);
      setGateInput("");
      setGateError(false);
      setCode("");
      setOutput("");

      await supabase
        .from('odyssey_progress')
        .update({ current_round: next, last_ping: new Date().toISOString() })
        .eq('student_id', student.id);
    } else {
      setGateError(true);
      setTimeout(() => setGateError(false), 2000);
    }
  };

  if (loading) return <div className={styles.levitate}>Igniting PyHunt Engines...</div>;

  if (!isAuthorized) {
    return (
      <div className={styles.authContainer}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.authCard}
        >
          <header className={styles.authHeader}>
            <div className={styles.lobbyIcon} style={{ transform: 'scale(0.8)', marginBottom: 12 }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#00f2ff" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2>MISSION AUTHORIZATION</h2>
            <p className={styles.authSubtitle}>Enter your credentials to access the PyHunt logic nodes.</p>
          </header>

          <div className={styles.authForm}>
            <div className={styles.authInputGroup}>
              <label>Candidate USN</label>
              <input 
                type="text" 
                className={styles.authInput} 
                value={authForm.usn}
                readOnly
              />
            </div>
            <div className={styles.authInputGroup}>
              <label>Mission Start Code</label>
              <input 
                type="password" 
                className={styles.authInput} 
                placeholder="Enter authorized mission code"
                value={authForm.missionCode}
                onChange={(e) => setAuthForm(prev => ({ ...prev, missionCode: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAuthorize()}
              />
            </div>
            <button className={styles.authBtn} onClick={handleAuthorize}>AUTHORIZE MISSION</button>
            {authError && <div className={styles.authError}>{authError}</div>}
          </div>
        </motion.div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className={styles.lobbyContainer}>
        <div className={styles.lobbyContent}>
          <div className={styles.lobbyIcon}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--nexus-cyan)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" strokeDasharray="4 4" />
            </svg>
          </div>
          <h1 className={styles.lobbyTitle}>PyHunt</h1>
          <p className={styles.lobbySubtitle}>
            Python Treasure Hunt — Solve 5 rounds of challenges and decode physical hints to reach the final coordinate!
          </p>
          
          <div className={styles.roundList}>
            {ROUNDS.map(r => (
              <div key={r.id} className={styles.roundListItem}>
                <div className={styles.roundBadge}>{r.id}</div>
                <div className={styles.roundText}>Round {r.id}: {r.name}</div>
              </div>
            ))}
          </div>

          <button className={styles.startBtn} onClick={() => setHasStarted(true)}>
            🚀 Start PyHunt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pyhuntShell}>
      <AntiCheat isSubmitted={currentRound > 5} examName="PyHunt" onAutoSubmit={() => {}} />
      
      <aside className={styles.timeline}>
        {ROUNDS.map(r => (
          <div key={r.id} className={`${styles.orbitNode} ${currentRound >= r.id ? styles.active : ""} ${currentRound === r.id ? styles.pulsing : ""}`}>
            <div className={styles.orbitNumber}>{r.id}</div>
            <div className={styles.orbitMeta}>
               <div className={styles.orbitName}>{r.name}</div>
               {currentRound === r.id && <div className={styles.orbitDesc}>{ROUNDS[currentRound-1].description}</div>}
            </div>
          </div>
        ))}
      </aside>

      <main className={styles.logicChamber}>
        <AnimatePresence mode="wait">
          {isAtGate ? (
            <motion.div 
              key="gate"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className={styles.gateOverlay}
            >
              <div className={styles.gateCard}>
                <div className={styles.gateIcon}>🔒</div>
                <h2>ORBITAL UNLOCK REQUIRED</h2>
                <div className={styles.clueBox}>
                  <label>LOCATION TRANSMISSION HINT:</label>
                  <p>{JSON.parse(localStorage.getItem("pyhunt_config_local") || "[]").find((c: any) => c.round === currentRound)?.clue || "Find the next node to receive your code."}</p>
                </div>
                <div className={styles.gateInputGroup}>
                  <label>ENTER UNLOCK CODE</label>
                  <input 
                    type="text" 
                    value={gateInput}
                    onChange={(e) => setGateInput(e.target.value)}
                    className={`${styles.gateInput} ${gateError ? styles.gateError : ""}`}
                    placeholder="e.g. ALPHA_NINER"
                    onKeyDown={(e) => e.key === 'Enter' && handleGateUnlock()}
                  />
                  {gateError && <div className={styles.errorMsg}>Invalid Unlock Code. Check your surroundings.</div>}
                </div>
                <button onClick={handleGateUnlock} className={styles.unlockBtn}>🔓 Unlock Next Orbit</button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <header className={styles.chamberHeader}>
                 <h2>Orbit {currentRound}: {ROUNDS[currentRound-1].name}</h2>
                 <div className={styles.engineStatus}>
                   <div className={styles.pulseDot} />
                   {pyLoading ? "Caching Logic Engine..." : "Engine Ready"}
                 </div>
              </header>

              <div className={styles.editorContainer}>
                 <textarea 
                   className={styles.codeArea}
                   value={code}
                   onChange={(e) => setCode(e.target.value)}
                   placeholder="# Manifest your Python logic here..."
                   spellCheck={false}
                   autoComplete="off"
                   autoCorrect="off"
                   autoCapitalize="off"
                 />
                 <div className={styles.editorGlow} />
              </div>

              <div className={styles.controlPanel}>
                 <button onClick={handleExecute} disabled={pyLoading} className={styles.executeBtn}>
                   Execute Logic Protocol
                 </button>
              </div>

              <div className={styles.terminal}>
                 <div className={styles.terminalLabel}>TRANSMISSION OUTPUT</div>
                 <pre>{output}</pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
