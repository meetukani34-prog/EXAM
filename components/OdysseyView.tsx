"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePyodide } from '@/hooks/usePyodide';
import { supabase } from '@/lib/supabase';
import styles from './OdysseyView.module.css';

const ROUNDS = [
  { id: 1, name: "Syntax Rectification", description: "Correct the high-entropy Python snippet to manifest the first key.", target: "syntax" },
  { id: 2, name: "Structural Alignment", description: "Rearrange the logical blocks to achieve the target state.", target: "structural" },
  { id: 3, name: "Linguistic Logic", description: "Master the strings. Implement a palindrome verifier.", target: "linguistic" },
  { id: 4, name: "Algorithmic Velocity", description: "Implement the FizzBuzz pattern (1-100) with maximum precision.", target: "algorithmic" },
  { id: 5, name: "Visual Manifestation", description: "Use the Turtle Logic to draw the Golden Spiral.", target: "visual" },
];

export default function OdysseyView() {
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

  if (loading) return <div className={styles.levitate}>Igniting Odyssey Engines...</div>;

  return (
    <div className={styles.odysseyShell}>
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
