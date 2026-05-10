"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePyodide } from '@/hooks/usePyodide';
import { supabase } from '@/lib/supabase';
import { withRetry } from '@/lib/apiUtils';
import { startExam, ApiError } from '@/lib/api';
import styles from './PyHuntView.module.css';
import AntiCheat from './AntiCheat';
import { useFullscreen } from '@/hooks/useFullscreen';

const ROUNDS = [
  { id: 1, name: "MCQ Logic", description: "Identify the correct Python syntax and logic from the given options.", target: "syntax" },
  { id: 2, name: "Code Jumble", description: "Rearrange the logical blocks to achieve the target state.", target: "structural" },
  { id: 3, name: "Palindrome", description: "Master the strings. Implement a palindrome verifier.", target: "linguistic" },
  { id: 4, name: "FizzBuzz", description: "Implement the FizzBuzz pattern (1-100) with maximum precision.", target: "algorithmic" },
  { id: 5, name: "Final Transmission", description: "The ultimate sequence. Decrypt the final campus coordinate.", target: "visual" },
];

const ROUND_1_QUESTIONS = [
  {
    id: 1,
    question: "What is the output of print(2 ** 3)?",
    options: ["6", "8", "9", "12"],
    correct: 1,
    output: "Key: Manifested"
  },
  {
    id: 2,
    question: "Which of these is a mutable data type in Python?",
    options: ["Tuple", "List", "String", "Int"],
    correct: 1,
    output: "Key: Manifested"
  },
  {
    id: 3,
    question: "What does 'len()' function do?",
    options: ["Returns the length of an object", "Converts to integer", "Prints a value", "Clears a list"],
    correct: 0,
    output: "Key: Manifested"
  }
];

export default function PyHuntView() {
  const [hasStarted, setHasStarted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authForm, setAuthForm] = useState({ usn: "", missionCode: "" });
  const [authError, setAuthError] = useState("");
  
  const [currentRound, setCurrentRound] = useState(1);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const { runCode, loading: pyLoading } = usePyodide(currentRound > 1);
  const { enter: enterFullscreen } = useFullscreen();
  const [student, setStudent] = useState<any>(null);
  
  // Gate State
  const [isAtGate, setIsAtGate] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [gateError, setGateError] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");

  const handleAutoSubmit = useCallback(() => {
    setIsAutoSubmitted(true);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("exam_student");
    if (!raw) return;
    const info = JSON.parse(raw);
    setStudent(info);
    setAuthForm(prev => ({ ...prev, usn: info.usn || "" }));

    async function syncProgress() {
      const studentId = info.id;
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

      // ── Fetch Student Progress ──
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('odyssey_progress')
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle();
      });

      if (data) {
        // Handle Admin Reset Signal
        if (data.round_1_state && (data.round_1_state as any).reset) {
          localStorage.removeItem(`pyhunt_mcq_map_${studentId}`);
          localStorage.removeItem(`pyhunt_code_draft_${studentId}`);
          setMcqSelectionMap({});
          setCode("");
          
          // Clear the reset flag in DB
          await supabase.from('odyssey_progress')
            .update({ round_1_state: {} })
            .eq('student_id', studentId);
        }
        setCurrentRound(data.current_round);
      } else {
        // Initialize for new student
        await withRetry(async () => {
          return await supabase.from('odyssey_progress').insert([{ student_id: studentId, current_round: 1 }]);
        });
        setCurrentRound(1);
      }

      // Load draft code for this specific student
      const savedCode = localStorage.getItem(`pyhunt_code_draft_${studentId}`);
      if (savedCode) setCode(savedCode);

      // ── Initialize exam_status for AntiCheat Sync ─────────
      try {
        await withRetry(() => startExam("PyHunt"));
      } catch (err: any) {
        if (err.message?.includes("already submitted") || (err instanceof ApiError && err.status === 403)) {
          console.log("PyHunt: Exam already marked as submitted in backend.");
          setCurrentRound(6); // Force to completion state
          setIsAuthorized(true); // Bypass authorization for finished exams
          setLoading(false); // Stop loading immediately
          return; // Exit syncProgress early
        } else {
          console.error("PyHunt start sync failed after retries:", err);
        }
      }

      setLoading(false);
    }
    syncProgress();
  }, []);

  // Save draft code periodically (Debounced)
  useEffect(() => {
    if (student?.id && code) {
      const timer = setTimeout(() => {
        localStorage.setItem(`pyhunt_code_draft_${student.id}`, code);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [code, student]);

  const handleAuthorize = () => {
    const globalAuthRaw = localStorage.getItem("pyhunt_global_auth");
    let targetCode = "PYHUNT67"; // Fallback
    if (globalAuthRaw) {
      targetCode = JSON.parse(globalAuthRaw).startCode || "PYHUNT67";
    }

    if (authForm.missionCode.toUpperCase() === targetCode.toUpperCase()) {
      if (authError.startsWith("CRITICAL")) return;
      setIsAuthorized(true);
      // Store authorization for THIS student session
      if (student?.id) {
        sessionStorage.setItem(`pyhunt_auth_${student.id}`, "true");
      }
      setAuthError("");
    } else {
      setAuthError("Invalid Mission Authorization Code.");
    }
  };

  const [mcqSet, setMcqSet] = useState<any[]>(ROUND_1_QUESTIONS);
  const [mcqSelectionMap, setMcqSelectionMap] = useState<Record<number, number>>({});
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  
  // Restore MCQ selection and load Admin MCQs
  useEffect(() => {
     if (typeof window !== "undefined") {
        const savedMcqs = localStorage.getItem("pyhunt_mcqs_local");
        if (savedMcqs) {
           try {
             const parsed = JSON.parse(savedMcqs);
             if (parsed && parsed.length > 0) {
                const mapped = parsed.map((m: any) => ({
                   id: m.id,
                   question: m.question,
                   options: m.options,
                   correct: m.answer,
                   output: "Key: Manifested"
                }));
                setMcqSet(mapped);
             }
           } catch (e) {
             console.error("Failed to parse admin mcqs:", e);
           }
        }
     }

     if (student?.id && currentRound === 1) {
        const saved = localStorage.getItem(`pyhunt_mcq_map_${student.id}`);
        if (saved) {
           setMcqSelectionMap(JSON.parse(saved));
        } else {
           setMcqSelectionMap({});
        }
     }
  }, [student?.id, currentRound]);

  // Reset session states when student changes
  useEffect(() => {
    if (student?.id) {
      setCode("");
      setOutput("");
      setCurrentMcqIndex(0);
      setIsAtGate(false);
      setShowUnlockDialog(false);
    }
  }, [student?.id]);

  useEffect(() => {
     if (student?.id && Object.keys(mcqSelectionMap).length > 0) {
        const timer = setTimeout(() => {
           localStorage.setItem(`pyhunt_mcq_map_${student.id}`, JSON.stringify(mcqSelectionMap));
        }, 1000);
        return () => clearTimeout(timer);
     }
  }, [mcqSelectionMap, student]);

  const handleExecute = async () => {
    if (currentRound === 1) {
      const allCorrect = mcqSet.every((q, idx) => mcqSelectionMap[idx] === q.correct);
      const answeredCount = Object.keys(mcqSelectionMap).length;

      if (answeredCount < mcqSet.length) {
        setOutput(`ERROR: Incomplete logic chain. Answer all ${mcqSet.length} nodes.`);
        return;
      }

      if (allCorrect) {
        // User must now enter the Orbital Unlock Code
        setIsAtGate(true);
        setGateError(false);
        setOutput("");
      } else {
        setOutput("ERROR: Logic mismatch in sequence. Transmission failed.");
      }
      return;
    }

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

  const handleMcqSelect = (idx: number, optIdx: number) => {
    setMcqSelectionMap(prev => ({ ...prev, [idx]: optIdx }));
    if (output.startsWith("ERROR")) setOutput("");
  };

  const validateRound = (round: number, stdout: string) => {
    const out = stdout.trim();
    if (round === 1) return true;
    if (round === 3) return out.toLowerCase().includes("palindrome: true");
    if (round === 4) return out.includes("1, 2, Fizz, 4, Buzz");
    return false;
  };

  const handleGateUnlock = async () => {
    const studentId = student.id;
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
      setMcqSelectionMap({});
      
      // Clear student-scoped drafts for previous round
      localStorage.removeItem(`pyhunt_mcq_${studentId}`);
      localStorage.removeItem(`pyhunt_code_draft_${studentId}`);

      await withRetry(async () => {
        const { error } = await supabase
          .from('odyssey_progress')
          .update({ current_round: next, last_ping: new Date().toISOString() })
          .eq('student_id', studentId);
        if (error) throw error;
      });
    } else {
      setGateError(true);
      setTimeout(() => setGateError(false), 2000);
    }
  };

  if (loading) return <div className={styles.levitate}>Igniting PyHunt Engines...</div>;

  // ── Mission Accomplished View (Priority) ───────────────────────────
  if (currentRound > ROUNDS.length) {
    return (
      <div className={styles.successOverlay} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.95)' }}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={styles.successCard}
        >
          <div className={styles.successIcon}>🏆</div>
          <h2>MISSION ACCOMPLISHED</h2>
          <p>You have successfully decoded all logic nodes and reached the final coordinate.</p>
          <div className={styles.codeDisplay}>TRANSMISSION COMPLETE</div>
          <p className={styles.successNote}>Your results have been synchronized with the Nexus command center.</p>
          <button className={styles.proceedBtn} onClick={() => window.location.href = "/dashboard"}>Return to Dashboard</button>
        </motion.div>
      </div>
    );
  }

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

          <button className={styles.startBtn} onClick={() => {
            setHasStarted(true);
            enterFullscreen();
          }}>
            🚀 Start PyHunt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pyhuntShell}>
      <AntiCheat isSubmitted={currentRound > 5} examName="PyHunt" onAutoSubmit={handleAutoSubmit} />
      
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
                {currentRound === 1 ? (
                  <div className={styles.mcqWrapper}>
                    <div className={styles.mcqHeader}>
                       <span className={styles.mcqProgress}>Node {currentMcqIndex + 1} of {mcqSet.length}</span>
                       <p className={styles.mcqQuestion}>{mcqSet[currentMcqIndex].question}</p>
                    </div>
                    <div className={styles.mcqOptions}>
                      {mcqSet[currentMcqIndex].options.map((opt: string, i: number) => (
                        <button
                          key={i}
                          className={`${styles.mcqOption} ${mcqSelectionMap[currentMcqIndex] === i ? styles.selected : ""}`}
                          onClick={() => handleMcqSelect(currentMcqIndex, i)}
                        >
                          <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                          {opt}
                        </button>
                      ))}
                    </div>

                    {mcqSet.length > 1 && (
                      <div className={styles.mcqNav}>
                         <button 
                           disabled={currentMcqIndex === 0} 
                           onClick={() => setCurrentMcqIndex(prev => prev - 1)}
                           className={styles.navBtn}
                         >
                           ← Previous Node
                         </button>
                         
                         {/* Only show next if an answer is selected for current question */}
                         {mcqSelectionMap[currentMcqIndex] !== undefined && currentMcqIndex < mcqSet.length - 1 && (
                           <button 
                             onClick={() => setCurrentMcqIndex(prev => prev + 1)}
                             className={styles.navBtn}
                           >
                             Next Node →
                           </button>
                         )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              <div className={styles.controlPanel}>
                 {currentRound === 1 ? (
                   // Show Submit button for Round 1 if on last question and all answered
                   (currentMcqIndex === mcqSet.length - 1 && Object.keys(mcqSelectionMap).length === mcqSet.length) && (
                     <button onClick={handleExecute} className={styles.executeBtn}>
                        Submit Mission Sequence
                     </button>
                   )
                 ) : (
                   <button onClick={handleExecute} disabled={pyLoading} className={styles.executeBtn}>
                     Execute Logic Protocol
                   </button>
                 )}
              </div>

              {/* Only show terminal for coding rounds (Round 2+) or if there is critical output */}
              {currentRound > 1 && output && (
                <div className={styles.terminal}>
                   <div className={styles.terminalLabel}>TRANSMISSION OUTPUT</div>
                   <pre>{output}</pre>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showUnlockDialog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.successOverlay}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={styles.successCard}
            >
              <div className={styles.successIcon}>🎉</div>
              <h3>Logic Sequence Verified!</h3>
              <p>You have successfully validated the first logic node. The manifested key for the next orbit is:</p>
              <div className={styles.codeDisplay}>{unlockCode}</div>
              <p className={styles.successNote}>Enter this code in the orbital gate to proceed.</p>
              <button 
                className={styles.proceedBtn}
                onClick={() => {
                  setShowUnlockDialog(false);
                  setIsAtGate(true);
                }}
              >
                Go to Orbital Gate
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
