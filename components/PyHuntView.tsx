"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { usePyodide } from '@/hooks/usePyodide';
import { supabase } from '@/lib/supabase';
import { withRetry } from '@/lib/apiUtils';
import { startExam, ApiError, fetchPublicPyHuntConfig } from '@/lib/api';
import styles from './PyHuntView.module.css';
import AntiCheat from './AntiCheat';
import { useFullscreen } from '@/hooks/useFullscreen';

const ROUNDS = [
  { id: 1, name: "MCQ Logic", description: "Identify the correct Python syntax and logic from the given options.", target: "syntax" },
  { id: 2, name: "Code Jumble", description: "Rearrange the logical blocks to achieve the target state.", target: "structural" },
  { id: 3, name: "Palindrome", description: "Symmetry Breach", target: "palindrome" },
  { id: 4, name: "FizzBuzz", description: "Numerical Sequence", target: "fizzbuzz" },
  { id: 5, name: "Final Transmission", description: "Mission Conclusion", target: null },
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

function SuccessScreen({ startTime, warningCount, wrongAttempts }: { startTime: number, warningCount: number, wrongAttempts: number }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = "/dashboard";
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.successOverlay}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={styles.successCard}>
        <div className={styles.successIcon}>🏆</div>
        <h2 className={styles.successTitle}>Congratulations! You've conquered PyHunt!</h2>
        <p className={styles.successSubtitle}>You are a true Python treasure hunter!</p>
        
        <div className={styles.statGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Time</span>
            <span className={styles.statValue}>{Math.floor((Date.now() - startTime) / 60000)}m</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Wrong Attempts</span>
            <span className={styles.statValue}>{wrongAttempts}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Warnings</span>
            <span className={styles.statValue}>{Math.min(warningCount, 3)}/3</span>
          </div>
        </div>

        <button className={styles.proceedBtn} onClick={() => window.location.href = "/dashboard"}>
          Back to Dashboard
        </button>
        <p className={styles.redirectText}>Auto-redirecting in 3s...</p>
      </motion.div>
    </div>
  );
}

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
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [warningCount, setWarningCount] = useState(0);

  const { runCode, loading: pyLoading } = usePyodide(currentRound > 1);
  const { enter: enterFullscreen } = useFullscreen();
  
  const [isAtGate, setIsAtGate] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [gateError, setGateError] = useState(false);
  const [hint, setHint] = useState("");
  const [showSuccessRipple, setShowSuccessRipple] = useState(false);
  
  const [globalConfigs, setGlobalConfigs] = useState<any[]>([]);
  const [labelConfig, setLabelConfig] = useState<any>({ phase: "Phase", orbit: "Orbit" });
  const [mcqSet, setMcqSet] = useState<any[]>(ROUND_1_QUESTIONS);
  const [mcqSelectionMap, setMcqSelectionMap] = useState<Record<number, number>>({});
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [jumbledLines, setJumbledLines] = useState<string[]>([]);
  const [jumbleSet, setJumbleSet] = useState<any[]>([]);
  const [currentJumbleIndex, setCurrentJumbleIndex] = useState(0);
  const [originalJumbleCode, setOriginalJumbleCode] = useState("");
  const [scratchCode, setScratchCode] = useState("");
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [scratchOutput, setScratchOutput] = useState("");

  const handleAutoSubmit = useCallback(() => {
    setIsAutoSubmitted(true);
  }, []);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    return `${mins}m`;
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const studentData = localStorage.getItem("exam_student");
      const studentObj = studentData ? JSON.parse(studentData) : null;
      const studentId = studentObj?.id || studentObj?.student_id;

      if (studentId) {
        await supabase.from('exam_status')
          .update({ 
            status: 'submitted', 
            submitted_at: new Date().toISOString(),
            last_score: 100,
            last_total: 100
          })
          .eq('student_id', studentId)
          .filter('exam_name', 'ilike', 'pyhunt');
      }
      setCurrentRound(6);
    } catch (err) {
      console.error("Submission error:", err);
      setCurrentRound(6);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem("exam_student");
    if (!raw) return;
    const info = JSON.parse(raw);
    setStudent(info);
    setAuthForm(prev => ({ ...prev, usn: info.usn || "" }));

    async function syncProgress() {
      const studentId = info.id || info.student_id;
      if (!studentId) return;
      
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('odyssey_progress')
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle();
      });

      if (error) {
        setLoading(false);
        return;
      }

      if (data) {
        setIsAuthorized(true);
        if (data.round_1_state && (data.round_1_state as any).reset) {
          localStorage.removeItem(`pyhunt_mcq_map_${studentId}`);
          localStorage.removeItem(`pyhunt_code_draft_${studentId}`);
          setMcqSelectionMap({});
          setCode("");
          await supabase.from('odyssey_progress').update({ round_1_state: {} }).eq('student_id', studentId);
        } else {
          const savedMap = localStorage.getItem(`pyhunt_mcq_map_${studentId}`);
          if (savedMap) setMcqSelectionMap(JSON.parse(savedMap));
          const savedCode = localStorage.getItem(`pyhunt_code_draft_${studentId}`);
          if (savedCode) setCode(savedCode);
        }
        setCurrentRound(data.current_round);
      }
      setLoading(false);
    }
    syncProgress();

    async function fetchGlobalConfigs() {
       const data = await fetchPublicPyHuntConfig();
       if (data && data.length > 0) {
          const rounds = data.find((c: any) => c.config_key === 'rounds_config')?.config_value;
          if (rounds) setGlobalConfigs(rounds);
          const mcqs = data.find((c: any) => c.config_key === 'mcqs')?.config_value;
          if (mcqs) {
              const mapped = mcqs.map((m: any) => ({
                 id: m.id,
                 question: m.question,
                 options: m.options,
                 correct: m.answer,
                 posMarks: m.positive_marks ?? 1,
                 negMarks: Math.abs(m.negative_marks ?? 0),
                 output: "Key: Manifested"
              }));
              setMcqSet(mapped);
          }
           const j = data.find((c: any) => c.config_key === 'jumbles')?.config_value;
           if (j && j.length > 0) setJumbleSet(j);
          const l = data.find((c: any) => c.config_key === 'labels')?.config_value;
          if (l) setLabelConfig(l);
       }
    }
    fetchGlobalConfigs();

    const channel = supabase.channel('pyhunt_global_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pyhunt_global_config' }, () => fetchGlobalConfigs())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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

  useEffect(() => {
    if (jumbleSet.length > 0 && jumbleSet[currentJumbleIndex]) {
      setOriginalJumbleCode(jumbleSet[currentJumbleIndex].target);
      setJumbledLines([]); // Reset for new jumble
    }
  }, [jumbleSet, currentJumbleIndex]);

  useEffect(() => {
     if (typeof window !== "undefined") {
        if (currentRound === 2 && originalJumbleCode && jumbledLines.length === 0) {
           const lines = originalJumbleCode.split('\n').filter((l: string) => l.trim() !== "");
           const shuffled = [...lines].sort(() => Math.random() - 0.5);
           setJumbledLines(shuffled);
        }
     }
  }, [currentRound, originalJumbleCode, jumbledLines.length]);

  const handleAuthorize = async () => {
    const data = await fetchPublicPyHuntConfig();
    let targetCode = "PYHUNT67";
    let allowedUsns = "";
    if (data && data.length > 0) {
       const auth = data.find((c: any) => c.config_key === 'auth')?.config_value;
       if (auth) {
          targetCode = auth.startCode || "PYHUNT67";
          allowedUsns = auth.authorizedUsns || "";
       }
    }

    if (authForm.missionCode.toUpperCase() === targetCode.toUpperCase()) {
      if (allowedUsns.trim()) {
         const list = allowedUsns.split(',').map(u => u.trim().toUpperCase());
         if (!list.includes(student?.usn?.toUpperCase())) {
            setAuthError("CRITICAL: Your USN is not authorized.");
            return;
         }
      }
      
      const studentId = student?.id || student?.student_id;
      if (studentId) {
        try {
          await withRetry(() => startExam("PyHunt"));
          sessionStorage.setItem(`pyhunt_auth_${studentId}`, "true");
        } catch (err: any) {
          setAuthError(`Mission Failed: ${err.detail || err.message || "Logic Error"}`);
          return;
        }
      }
      setIsAuthorized(true);
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
        setWrongAttempts(prev => prev + 1);
        setOutput("ERROR: Logic mismatch in sequence. Transmission failed.");
      }
      return;
    }

    if (currentRound === 2) {
      const currentOrder = jumbledLines.map(l => l.trimEnd()).join('\n').trim();
      const targetOrder = originalJumbleCode.split('\n')
        .filter(l => l.trim() !== "")
        .map(l => l.trimEnd())
        .join('\n')
        .trim();

      if (currentOrder === targetOrder) {
        if (currentJumbleIndex < jumbleSet.length - 1) {
          setCurrentJumbleIndex(prev => prev + 1);
          setOutput(`Sequence Node ${currentJumbleIndex + 1} synchronized. Calibrating next cluster...`);
        } else {
          setIsAtGate(true);
          setGateError(false);
          setOutput("");
        }
      } else {
        setWrongAttempts(prev => prev + 1);
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
    if (isValid) {
       setShowSuccessRipple(true);
       setTimeout(() => {
         setShowSuccessRipple(false);
         setIsAtGate(true);
       }, 1000);
    } else {
       setWrongAttempts(prev => prev + 1);
       setHint("Drift detected. Check your logic pattern (formatting is ignored).");
       setTimeout(() => setHint(""), 4000);
    }
  };

  const moveLine = (index: number, direction: 'up' | 'down') => {
    const newLines = [...jumbledLines];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newLines.length) return;
    [newLines[index], newLines[targetIndex]] = [newLines[targetIndex], newLines[index]];
    setJumbledLines(newLines);
    if (output.startsWith("ERROR")) setOutput("");
  };

  const handleRunScratch = async () => {
    if (!scratchCode.trim()) return;
    setScratchOutput("Running mission logic...");
    try {
      const res: any = await runCode(scratchCode);
      if (res.error) {
        setScratchOutput(`ERROR: ${res.error}`);
      } else {
        const out = (res.stdout || "") + (res.stderr || "");
        setScratchOutput(out || "Execution successful (no output)");
      }
    } catch (err: any) {
      setScratchOutput(`ERROR: ${err.message}`);
    }
  };

  const handleMcqSelect = (idx: number, optIdx: number) => {
    setMcqSelectionMap(prev => ({ ...prev, [idx]: optIdx }));
    if (output.startsWith("ERROR")) setOutput("");
  };

  const atmosphericCrystallize = (input: string) => {
    if (!input) return "";
    return input.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n').toLowerCase();
  };

  const validateRound = (round: number, stdout: string) => {
    const userOutput = atmosphericCrystallize(stdout);
    const roundConfig = globalConfigs.find((c: any) => c.round === round);
    if (!roundConfig) return false;
    const target = atmosphericCrystallize(roundConfig.target_output || "");
    if (round === 3) {
       const expected = target || "palindrome: true";
       return userOutput.includes(expected) || userOutput === expected;
    }
    if (round === 4) {
       const expected = target || "1\n2\nfizz\n4\nbuzz";
       return userOutput.includes(expected) || userOutput === expected;
    }
    return false;
  };

  const handleGateUnlock = async () => {
    const studentId = student?.id || student?.student_id;
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
          .eq('student_id', studentId || student?.student_id);
        if (error) throw error;
      });
    } else {
      setWrongAttempts(prev => prev + 1);
      setGateError(true);
      setTimeout(() => setGateError(false), 2000);
    }
  };

  if (loading) return <div className={styles.levitate}>Igniting PyHunt Engines...</div>;

  if (isAutoSubmitted) {
    return (
      <div className={styles.terminationOverlay}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={styles.terminationCard}>
          <div className={styles.terminationIcon}>🚫</div>
          <h2 className={styles.terminationTitle}>SESSION TERMINATED</h2>
          <div className={styles.statGrid}>
            <div className={styles.statItem}><span className={styles.statLabel}>Total Time</span><span className={styles.statValue}>{formatTime(Date.now() - startTime)}</span></div>
            <div className={styles.statItem}><span className={styles.statLabel}>Wrong Attempts</span><span className={styles.statValue}>{wrongAttempts}</span></div>
            <div className={styles.statItem}><span className={styles.statLabel}>Warnings</span><span className={styles.statValue}>{Math.min(warningCount, 3)}/3</span></div>
          </div>
          <p className={styles.terminationDesc}>Your PyHunt session was automatically terminated due to excessive security violations. Please contact your facilitator.</p>
          <button className={styles.proceedBtn} onClick={() => window.location.href = "/dashboard"}>Return to Dashboard</button>
        </motion.div>
      </div>
    );
  }

  if (currentRound > ROUNDS.length) {
    return <SuccessScreen startTime={startTime} warningCount={warningCount} wrongAttempts={wrongAttempts} />;
  }

  if (!isAuthorized) {
    return (
      <div className={styles.authContainer}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.authCard}>
          <header className={styles.authHeader}>
            <h2>PyHunt</h2>
            <p className={styles.authSubtitle}>Enter your credentials to access the logic nodes.</p>
          </header>
          <div className={styles.authForm}>
            <div className={styles.authInputGroup}><label>Candidate USN</label><input type="text" className={styles.authInput} value={authForm.usn} readOnly /></div>
            <div className={styles.authInputGroup}><label>Mission Start Code</label><input type="text" className={styles.authInput} placeholder="Enter authorized mission code" value={authForm.missionCode} onChange={(e) => setAuthForm(prev => ({ ...prev, missionCode: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAuthorize()} /></div>
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
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={styles.lobbyContent}
        >
          <div className={styles.lobbyIcon}>
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M40 85C40 85 20 85 20 60C20 35 40 20 60 20C80 20 100 35 100 60C100 85 80 100 60 100C40 100 35 85 45 75C55 65 75 65 75 45C75 25 55 25 45 35" 
                stroke="url(#snake_grad_lobby)" 
                strokeWidth="12" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <circle cx="45" cy="45" r="4" fill="#00FFA3" />
              <defs>
                <linearGradient id="snake_grad_lobby" x1="20" y1="60" x2="100" y2="60" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00F0FF" />
                  <stop offset="1" stopColor="#00FFA3" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className={styles.lobbyTitle}>PyHunt</h1>
          <p className={styles.lobbySubtitle}>
            Python Treasure Hunt — Solve {ROUNDS.length - 1} rounds of challenges to unlock the final transmission!
          </p>
          
          <div className={styles.nexusBadge}>
            NEXUS
          </div>

          <button 
            className={styles.startBtn} 
            onClick={() => { setHasStarted(true); enterFullscreen(); }}
          >
            🚀 Start PyHunt
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={styles.pyhuntShell}>
      <AntiCheat isSubmitted={currentRound > ROUNDS.length || isAutoSubmitted} examName="PyHunt" onAutoSubmit={handleAutoSubmit} onWarningUpdate={setWarningCount} />
      
      {showSuccessRipple && (
        <div className={styles.successRipple}>
          <div className={styles.rippleCircle} />
        </div>
      )}
      <aside className={styles.timeline}>
        {ROUNDS.map(r => (
          <div key={r.id} className={`${styles.orbitNode} ${currentRound >= r.id ? styles.active : ""} ${currentRound === r.id ? styles.pulsing : ""}`}>
            <div className={styles.orbitNumber}>{r.id}</div>
            <div className={styles.orbitMeta}>
               <div className={styles.orbitName}>{labelConfig.phase} {r.id}: {globalConfigs.find((c: any) => c.round === r.id)?.name || r.name}</div>
            </div>
          </div>
        ))}
      </aside>

      <main className={styles.logicChamber}>
        <AnimatePresence mode="wait">
            <motion.div key={currentRound} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <header className={styles.chamberHeader}>
                 <h2>{labelConfig.orbit} {currentRound}: {globalConfigs.find((c: any) => c.round === currentRound)?.name || ROUNDS[currentRound-1].name}</h2>
                 <div className={styles.engineStatus}>
                   <div className={styles.pulseDot} />
                   {pyLoading ? "Caching Logic Engine..." : "Engine Ready"}
                 </div>
                 {hint && (
                   <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={styles.hintDrift}>
                     {hint}
                   </motion.div>
                 )}
              </header>

              {(() => {
                const c = globalConfigs.find((conf: any) => conf.round === currentRound);
                if (!c?.prompt && !c?.imageUrl) return null;
                return (
                  <div className={styles.roundMeta}>
                    {c.imageUrl && <img src={c.imageUrl} alt="Logic Challenge" className={styles.roundImage} />}
                    {c.prompt && <p className={styles.roundPrompt}>{c.prompt}</p>}
                  </div>
                );
              })()}

              <div className={styles.editorContainer}>
                {currentRound === 1 ? (
                  <div className={styles.mcqWrapper}>
                    <div className={styles.mcqHeader}>
                      <span className={styles.mcqProgress}>Node {currentMcqIndex + 1} of {mcqSet.length}</span>
                      <span className={styles.scoringBadge}>+{mcqSet[currentMcqIndex].posMarks} / -{mcqSet[currentMcqIndex].negMarks}</span>
                    </div>
                    
                    <div className={styles.mcqQuestionSection}>
                      <p className={styles.mcqQuestion}>{mcqSet[currentMcqIndex].question}</p>
                      {mcqSet[currentMcqIndex].imageUrl && (
                        <div style={{ marginTop: 16, textAlign: 'center' }}>
                           <img 
                             src={mcqSet[currentMcqIndex].imageUrl} 
                             alt="Question Visual" 
                             style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }} 
                           />
                        </div>
                      )}
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
                  <div className={`${styles.jumbleSplitLayout} ${showScratchpad ? styles.withScratchpad : ""}`}>
                    <div className={styles.jumbleCard}>
                      <div className={styles.jumbleHeader}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                           <h3 style={{ margin: 0 }}>Fix the Logic Sequence</h3>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                             {jumbleSet.length > 1 && (
                               <span className={styles.mcqProgress}>Node {currentJumbleIndex + 1} of {jumbleSet.length}</span>
                             )}
                             <button 
                               className={`${styles.toggleScratchBtn} ${showScratchpad ? styles.active : ""}`}
                               onClick={() => setShowScratchpad(!showScratchpad)}
                             >
                               {showScratchpad ? "✕ Close Scratchpad" : "⌨ Open Scratchpad"}
                             </button>
                           </div>
                         </div>
                         <p className={styles.jumbleSubtitle}>Drag lines into correct order so the logic is valid.</p>
                      </div>
                      <Reorder.Group 
                        axis="y" 
                        values={jumbledLines} 
                        onReorder={setJumbledLines} 
                        className={styles.jumbleList}
                      >
                        {jumbledLines.map((line, idx) => (
                          <Reorder.Item 
                            key={line + idx} 
                            value={line}
                            className={styles.jumbleItem}
                            whileDrag={{ scale: 1.05, boxShadow: "0 10px 30px rgba(0, 242, 255, 0.2)" }}
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
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                      <div className={styles.jumbleFooter}>
                        <button onClick={handleExecute} className={styles.submitOrderBtn}>
                          ✓ Submit Order
                        </button>
                      </div>
                    </div>

                    {showScratchpad && (
                      <div className={styles.scratchpadContainer}>
                         <div className={styles.scratchpadHeader}>
                            <span className={styles.scratchpadTitle}>LOGIC SCRATCHPAD (OPTIONAL)</span>
                         </div>
                         <textarea 
                           className={styles.scratchpadEditor}
                           value={scratchCode}
                           onChange={(e) => setScratchCode(e.target.value)}
                           placeholder="# Test your Python logic here..."
                           spellCheck={false}
                         />
                         <div className={styles.scratchpadActions}>
                            <button className={styles.runScratchBtn} onClick={handleRunScratch}>
                              ▷ RUN LOGIC
                            </button>
                         </div>
                         {scratchOutput && (
                           <div className={styles.scratchOutput}>
                              {scratchOutput}
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                ) : currentRound === 5 ? (
                  <div className={styles.finalSubmitWrapper}>
                    <div className={styles.finalIcon}>🛸</div>
                    <h3>MISSION PROTOCOL COMPLETE</h3>
                    <p>All logic nodes have been synchronized. The final transmission is ready for uplink to the central nexus.</p>
                    <button 
                      onClick={handleFinalSubmit} 
                      className={styles.finalSubmitBtn}
                      disabled={loading}
                    >
                      {loading ? "TRANSMITTING..." : "UPLINK FINAL RESULTS"}
                    </button>
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
                    />
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
                 {currentRound > 2 && currentRound < 5 && (
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
              <h2>{labelConfig.orbit.toUpperCase()} UNLOCK REQUIRED</h2>
              <div className={styles.clueBox}>
                <label>CLUE:</label>
                <p>{globalConfigs.find((c: any) => c.round === currentRound)?.clue || "Locate the physical node to find your code."}</p>
              </div>
              <div className={styles.gateInputGroup}>
                <label>{labelConfig.orbit.toUpperCase()} UNLOCK CODE</label>
                <input 
                  type="text" 
                  value={gateInput} 
                  onChange={(e) => setGateInput(e.target.value)} 
                  className={`${styles.gateInput} ${gateError ? styles.gateError : ""}`} 
                  spellCheck={false}
                  autoComplete="off"
                  onKeyDown={(e) => e.key === 'Enter' && handleGateUnlock()} 
                />
                {gateError && <div className={styles.errorMsg}>Invalid Unlock Code. Transmission Rejected.</div>}
              </div>
              <div className={styles.gateActions}>
                <button onClick={handleGateUnlock} className={styles.unlockBtn}>🔓 UNLOCK NEXT {labelConfig.orbit.toUpperCase()}</button>
                <button onClick={() => setIsAtGate(false)} className={styles.cancelBtn}>RETURN</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
