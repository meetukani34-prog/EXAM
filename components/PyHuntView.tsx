"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePyodide } from '@/hooks/usePyodide';
import { supabase } from '@/lib/supabase';
import styles from './PyHuntView.module.css';

const ROUNDS = [
  { id: 1, name: "MCQ", description: "Identify the correct Python syntax and logic from the given options.", target: "syntax" },
  { id: 2, name: "Code Jumble", description: "Rearrange the logical blocks to achieve the target state.", target: "structural" },
  { id: 3, name: "Palindrome", description: "Master the strings. Implement a palindrome verifier.", target: "linguistic" },
  { id: 4, name: "FizzBuzz", description: "Implement the FizzBuzz pattern (1-100) with maximum precision.", target: "algorithmic" },
  { id: 5, name: "Turtle Art", description: "Use the Turtle Logic to draw specific sacred geometry.", target: "visual" },
];

export default function PyHuntView() {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const { runCode, loading: pyLoading } = usePyodide();
  const [student, setStudent] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem("exam_student");
    if (!raw) return;
    const info = JSON.parse(raw);
    setStudent(info);

    async function syncProgress() {
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
      setLoading(false);
    }
    syncProgress();
  }, []);

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
      handleUnlockNext();
    }
  };

  const validateRound = (round: number, stdout: string) => {
    const out = stdout.trim();
    if (round === 1) return out === "Key: Manifested";
    if (round === 3) return out.toLowerCase().includes("palindrome: true");
    if (round === 4) return out.includes("1, 2, Fizz, 4, Buzz");
    return false;
  };

  const handleUnlockNext = async () => {
    const next = currentRound + 1;
    setCurrentRound(next);
    await supabase
      .from('odyssey_progress')
      .update({ current_round: next, last_ping: new Date().toISOString() })
      .eq('student_id', student.id);
  };

  if (loading) return <div className={styles.levitate}>Igniting PyHunt Engines...</div>;

  if (!hasStarted) {
    return (
      <div className={styles.lobbyContainer}>
        <div className={styles.lobbyContent}>
          <div className={styles.lobbyIcon}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--nexus-cyan)" strokeWidth="1.5">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM12 20c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
              <path d="M12 6v6l4 2" />
              <path d="M7 12h10" />
            </svg>
          </div>
          <h1 className={styles.lobbyTitle}>PyHunt</h1>
          <p className={styles.lobbySubtitle}>
            Python Treasure Hunt — Solve 5 rounds of challenges to find hidden clues across campus!
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
      <aside className={styles.timeline}>
        {ROUNDS.map(r => (
          <div key={r.id} className={`${styles.orbitNode} ${currentRound >= r.id ? styles.active : ""} ${currentRound === r.id ? styles.pulsing : ""}`}>
            <div className={styles.orbitNumber}>{r.id}</div>
            <div className={styles.orbitMeta}>
               <div className={styles.orbitName}>{r.name}</div>
               {currentRound === r.id && <div className={styles.orbitDesc}>{r.description}</div>}
            </div>
          </div>
        ))}
      </aside>

      <main className={styles.logicChamber}>
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
           />
           <div className={styles.editorGlow} />
        </div>

        <div className={styles.controlPanel}>
           <button onClick={handleExecute} disabled={pyLoading} className={styles.executeBtn}>
             Execute Crystalline protocol
           </button>
        </div>

        <div className={styles.terminal}>
           <div className={styles.terminalLabel}>TRANSMISSION OUTPUT</div>
           <pre>{output}</pre>
        </div>
      </main>
    </div>
  );
}
