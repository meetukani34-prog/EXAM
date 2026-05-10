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
  const [student, setStudent] = useState<any>(null);

  // Lazy load pyodide only for round 2+
  const { runCode, loading: pyLoading } = usePyodide(currentRound > 1);
  const { enter: enterFullscreen } = useFullscreen();
  
  // Gate State (Modal)
  const [isAtGate, setIsAtGate] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [gateError, setGateError] = useState(false);
  
  const [globalConfigs, setGlobalConfigs] = useState<any[]>([]);
  const [mcqSet, setMcqSet] = useState<any[]>(ROUND_1_QUESTIONS);
  const [mcqSelectionMap, setMcqSelectionMap] = useState<Record<number, number>>({});
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);

  // Code Jumble (Round 2) State
  const [jumbledLines, setJumbledLines] = useState<string[]>([]);
  const [originalJumbleCode, setOriginalJumbleCode] = useState("");

  const handleAutoSubmit = useCallback(() => {
    setIsAutoSubmitted(true);
  }, []);

  // ── Initialization & Sync ──
  useEffect(() => {
    const raw = localStorage.getItem("exam_student");
    if (!raw) return;
    const info = JSON.parse(raw);
    setStudent(info);
    setAuthForm(prev => ({ ...prev, usn: info.usn || "" }));

    async function syncProgress() {
      const studentId = info.id;
      
      const { data } = await withRetry(async () => {
        return await supabase
          .from('odyssey_progress')
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle();
      });

      if (data) {
        if (data.round_1_state && (data.round_1_state as any).reset) {
          localStorage.removeItem(`pyhunt_mcq_map_${studentId}`);
          localStorage.removeItem(`pyhunt_code_draft_${studentId}`);
          setMcqSelectionMap({});
          setCode("");
          
          await supabase.from('odyssey_progress')
            .update({ round_1_state: {} })
            .eq('student_id', studentId);
        } else {
          const savedMap = localStorage.getItem(`pyhunt_mcq_map_${studentId}`);
          if (savedMap) setMcqSelectionMap(JSON.parse(savedMap));
          const savedCode = localStorage.getItem(`pyhunt_code_draft_${studentId}`);
          if (savedCode) setCode(savedCode);
        }
        setCurrentRound(data.current_round);
      } else {
        await withRetry(async () => {
          return await supabase.from('odyssey_progress').insert([{ student_id: studentId, current_round: 1 }]);
        });
        setCurrentRound(1);
      }

      try {
        await withRetry(() => startExam("PyHunt"));
      } catch (err: any) {
        if (err.message?.includes("already submitted") || (err instanceof ApiError && err.status === 403)) {
          setCurrentRound(6); 
          setIsAuthorized(true);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    }
    syncProgress();

    // Fetch Global Configs
    async function fetchGlobalConfigs() {
       const { data } = await supabase.from('pyhunt_global_config').select('*');
       if (data) {
          const rounds = data.find(c => c.config_key === 'rounds_config')?.config_value;
          if (rounds) setGlobalConfigs(rounds);

          const mcqs = data.find(c => c.config_key === 'mcqs')?.config_value;
          if (mcqs) {
             const mapped = mcqs.map((m: any) => ({
                id: m.id,
                question: m.question,
                options: m.options,
                correct: m.answer,
                output: "Key: Manifested"
             }));
             setMcqSet(mapped);
          }
          const j = data.find(c => c.config_key === 'jumbles')?.config_value;
          if (j && j.length > 0) {
             setOriginalJumbleCode(j[0].target);
          }
       }
    }
    fetchGlobalConfigs();

    // Listen for config changes
    const channel = supabase.channel('pyhunt_global_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pyhunt_global_config' }, () => fetchGlobalConfigs())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Persistence ──
  useEffect(() => {
    if (student?.id && code) {
      const timer = setTimeout(() => {
        localStorage.setItem(`pyhunt_code_draft_${student.id}`, code);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [code, student]);

  useEffect(() => {
     if (student?.id && Object.keys(mcqSelectionMap).length > 0) {
        const timer = setTimeout(() => {
           localStorage.setItem(`pyhunt_mcq_map_${student.id}`, JSON.stringify(mcqSelectionMap));
        }, 1000);
        return () => clearTimeout(timer);
     }
  }, [mcqSelectionMap, student]);

  // Load Admin Jumble Config for Round 2
  useEffect(() => {
     if (typeof window !== "undefined") {
        if (currentRound === 2 && originalJumbleCode && jumbledLines.length === 0) {
           const lines = originalJumbleCode.split('\n').filter((l: string) => l.trim() !== "");
           const shuffled = [...lines].sort(() => Math.random() - 0.5);
           setJumbledLines(shuffled);
        }
     }
  }, [currentRound, originalJumbleCode, jumbledLines.length]);

  // ── Handlers ──
  const handleAuthorize = async () => {
    const { data } = await supabase.from('pyhunt_global_config').select('*').eq('config_key', 'auth').maybeSingle();
    let targetCode = "PYHUNT67";
    let allowedUsns = "";
    if (data) {
       targetCode = data.config_value.startCode || "PYHUNT67";
       allowedUsns = data.config_value.authorizedUsns || "";
    }

    if (authForm.missionCode.toUpperCase() === targetCode.toUpperCase()) {
      if (allowedUsns.trim()) {
         const list = allowedUsns.split(',').map(u => u.trim().toUpperCase());
         if (!list.includes(student?.usn?.toUpperCase())) {
            setAuthError("CRITICAL: Your USN is not authorized.");
            return;
         }
      }
      setIsAuthorized(true);
      if (student?.id) sessionStorage.setItem(`pyhunt_auth_${student.id}`, "true");
      setAuthError("");
    } else {
      setAuthError("Invalid Mission Authorization Code.");
    }
  };

  const handleExecute = async () => {
    if (currentRound === 1) {
      const allCorrect = mcqSet.every((q, idx) => mcqSelectionMap[idx] === q.correct);
      const answeredCount = Object.keys(mcqSelectionMap).length;
      if (answeredCount < mcqSet.length) {
        setOutput(`ERROR: Incomplete logic chain. Answer all ${mcqSet.length} nodes.`);
        return;
      }
      if (allCorrect) {
        setIsAtGate(true);
        setGateError(false);
        setOutput("");
      } else {
        setOutput("ERROR: Logic mismatch in sequence. Transmission failed.");
      }
      return;
    }

    if (currentRound === 2) {
      const currentOrder = jumbledLines.join('\n').replace(/\s/g, '');
      const targetOrder = originalJumbleCode.replace(/\s/g, '');

      if (currentOrder === targetOrder) {
        setIsAtGate(true);
        setGateError(false);
        setOutput("");
      } else {
        setOutput("ERROR: Execution sequence invalid. Logic flow interrupted.");
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
    if (isValid) setIsAtGate(true);
  };

  const moveLine = (index: number, direction: 'up' | 'down') => {
    const newLines = [...jumbledLines];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newLines.length) return;
    
    [newLines[index], newLines[targetIndex]] = [newLines[targetIndex], newLines[index]];
    setJumbledLines(newLines);
    if (output.startsWith("ERROR")) setOutput("");
  };

  const handleMcqSelect = (idx: number, optIdx: number) => {
    setMcqSelectionMap(prev => ({ ...prev, [idx]: optIdx }));
    if (output.startsWith("ERROR")) setOutput("");
  };

  const validateRound = (round: number, stdout: string) => {
    const out = stdout.trim().toLowerCase();
    const roundConfig = globalConfigs.find((c: any) => c.round === round);
    if (!roundConfig) return false;
    
    // Use target_output from admin if available, otherwise fallback to defaults
    const target = (roundConfig.target_output || "").trim().toLowerCase();
    
    if (round === 3) {
       const expected = target || "palindrome: true";
       return out.includes(expected);
    }
    if (round === 4) {
       const expected = target || "1, 2, fizz, 4, buzz";
       return out.includes(expected);
    }
    return false;
  };

  const handleGateUnlock = async () => {
    const studentId = student.id;
    const currentConfig = globalConfigs.find((c: any) => c.round === currentRound);
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
      setCurrentMcqIndex(0);
      
      localStorage.removeItem(`pyhunt_code_draft_${studentId}`);
      localStorage.removeItem(`pyhunt_mcq_map_${studentId}`);

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

  if (currentRound > ROUNDS.length) {
    return (
      <div className={styles.successOverlay} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.95)' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={styles.successCard}>
          <div className={styles.successIcon}>🏆</div>
          <h2>MISSION ACCOMPLISHED</h2>
          <p>You have successfully decoded all logic nodes and reached the final coordinate.</p>
          <div className={styles.codeDisplay}>TRANSMISSION COMPLETE</div>
          <button className={styles.proceedBtn} onClick={() => window.location.href = "/dashboard"}>Return to Dashboard</button>
        </motion.div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className={styles.authContainer}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.authCard}>
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
            <div className={styles.authInputGroup}><label>Candidate USN</label><input type="text" className={styles.authInput} value={authForm.usn} readOnly /></div>
            <div className={styles.authInputGroup}><label>Mission Start Code</label><input type="password" className={styles.authInput} placeholder="Enter authorized mission code" value={authForm.missionCode} onChange={(e) => setAuthForm(prev => ({ ...prev, missionCode: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAuthorize()} /></div>
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
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3" /><path d="M12 6v6l4 2" strokeLinecap="round" /><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" strokeDasharray="4 4" />
            </svg>
          </div>
          <h1 className={styles.lobbyTitle}>PyHunt</h1>
          <p className={styles.lobbySubtitle}>Python Treasure Hunt — Solve 5 rounds of challenges!</p>
          <div className={styles.roundList}>
            {ROUNDS.map(r => (
              <div key={r.id} className={styles.roundListItem}>
                <div className={styles.roundBadge}>{r.id}</div>
                <div className={styles.roundText}>Round {r.id}: {r.name}</div>
              </div>
            ))}
          </div>
          <button className={styles.startBtn} onClick={() => { setHasStarted(true); enterFullscreen(); }}>🚀 Start PyHunt</button>
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
            <motion.div 
              key={currentRound}
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

                    <div className={styles.mcqNav}>
                       <button disabled={currentMcqIndex === 0} onClick={() => setCurrentMcqIndex(prev => prev - 1)} className={styles.navBtn}>← Previous Node</button>
                       {mcqSelectionMap[currentMcqIndex] !== undefined && currentMcqIndex < mcqSet.length - 1 && (
                         <button onClick={() => setCurrentMcqIndex(prev => prev + 1)} className={styles.navBtn}>Next Node →</button>
                       )}
                    </div>
                  </div>
                ) : currentRound === 2 ? (
                  <div className={styles.jumbleCard}>
                    <div className={styles.jumbleHeader}>
                       <h3>Fix the Logic Sequence</h3>
                       <p className={styles.jumbleSubtitle}>Drag lines into correct order so the logic is valid.</p>
                    </div>
                    <div className={styles.jumbleList}>
                      {jumbledLines.map((line, idx) => (
                        <motion.div 
                          layout 
                          key={line + idx} 
                          className={styles.jumbleItem}
                        >
                          <div className={styles.jumbleItemLeft}>
                            <span className={styles.jumbleNumber}>{idx + 1}</span>
                            <code>{line}</code>
                          </div>
                          <div className={styles.jumbleActions}>
                             <button disabled={idx === 0} onClick={() => moveLine(idx, 'up')} className={styles.orderBtn}>▲</button>
                             <button disabled={idx === jumbledLines.length - 1} onClick={() => moveLine(idx, 'down')} className={styles.orderBtn}>▼</button>
                             <div className={styles.dragHandle}>
                                <span></span><span></span><span></span>
                             </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <div className={styles.jumbleFooter}>
                      <button onClick={handleExecute} className={styles.submitOrderBtn}>
                        ✓ Submit Order
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <textarea className={styles.codeArea} value={code} onChange={(e) => setCode(e.target.value)} placeholder="# Manifest your Python logic here..." spellCheck={false} autoComplete="off" />
                    <div className={styles.editorGlow} />
                  </>
                )}
              </div>

              <div className={styles.controlPanel}>
                 {currentRound === 1 && (
                   (currentMcqIndex === mcqSet.length - 1 && Object.keys(mcqSelectionMap).length === mcqSet.length) && (
                     <button onClick={handleExecute} className={styles.executeBtn}>SUBMIT MISSION SEQUENCE</button>
                   )
                 )}
                 {currentRound > 2 && (
                   <button onClick={handleExecute} disabled={pyLoading} className={styles.executeBtn}>EXECUTE LOGIC PROTOCOL</button>
                 )}
              </div>

              {(currentRound > 1 || (output && output.includes("ERROR"))) && (
                <div className={styles.terminal}>
                   <div className={styles.terminalLabel}>TRANSMISSION OUTPUT</div>
                   <pre style={{ color: output.includes("ERROR") ? "#ff4d4d" : "inherit" }}>{output}</pre>
                </div>
              )}
            </motion.div>
        </AnimatePresence>
      </main>

      {/* MODAL GATE BOX */}
      <AnimatePresence>
        {isAtGate && (
          <div className={styles.gateModalOverlay}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className={styles.gateCard}>
              <div className={styles.gateIcon}>🔒</div>
              <h2>ORBITAL UNLOCK REQUIRED</h2>
              <div className={styles.clueBox}>
                <label>HINT:</label>
                <p>{globalConfigs.find((c: any) => c.round === currentRound)?.clue || "Locate the physical node to find your code."}</p>
              </div>
              <div className={styles.gateInputGroup}>
                <label>ORBITAL UNLOCK CODE</label>
                <input 
                  type="text" 
                  value={gateInput} 
                  onChange={(e) => setGateInput(e.target.value)} 
                  className={`${styles.gateInput} ${gateError ? styles.gateError : ""}`} 
                  placeholder="Type code here..." 
                  onKeyDown={(e) => e.key === 'Enter' && handleGateUnlock()} 
                />
                {gateError && <div className={styles.errorMsg}>Invalid Unlock Code. Transmission Rejected.</div>}
              </div>
              <div className={styles.gateActions}>
                <button onClick={handleGateUnlock} className={styles.unlockBtn}>🔓 UNLOCK NEXT ORBIT</button>
                <button onClick={() => setIsAtGate(false)} className={styles.cancelBtn}>RETURN</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
