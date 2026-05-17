// react-doctor-disable react-doctor/label-has-associated-control, react-doctor/inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/array-index-key, react-doctor/cascading-set-state, react-doctor/effect-needs-cleanup, react-doctor/no-giant-component, react-doctor/prefer-useReducer, react-doctor/js-combine-iterations, react-doctor/design-no-three-period-ellipsis, react-doctor/rerender-state-only-in-handlers, react-doctor/many-boolean-props, react-doctor/use-lazy-motion, react-doctor/no-effect-chain, react-doctor/async-parallel, react-doctor/js-length-check-first, react-doctor/js-cache-storage, react-doctor/nextjs-no-img-element
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
// react-doctor-disable-next-line react-doctor/use-lazy-motion
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import Image from 'next/image';
import { useWasmCompiler } from '@/hooks/useWasmCompiler';
import { usePyodide } from '@/hooks/usePyodide';
import { supabase } from '@/lib/supabase';
import { withRetry } from '@/lib/apiUtils';
import { startExam, ApiError, fetchPublicPyHuntConfig } from '@/lib/api';
import styles from './PyHuntView.module.css';
import AntiCheat from './AntiCheat';
import { useFullscreen } from '@/hooks/useFullscreen';
import CodingInterface from './CodingInterface';
import CognitiveBeacon from './CognitiveBeacon';
import { validateOutput as sharedValidateOutput } from '@/lib/logicUtils';


const ROUNDS = [
  { id: 1, name: "MCQ Logic", description: "Identify the correct Python syntax and logic from the given options.", target: "syntax" },
  { id: 2, name: "Code Jumble", description: "Rearrange the logical blocks to achieve the target state.", target: "structural" },
  { id: 3, name: "Palindrome", description: "Symmetry Breach", target: "palindrome" },
  { id: 4, name: "FizzBuzz", description: "Numerical Sequence", target: "fizzbuzz" },
  { id: 5, name: "Final Transmission", description: "Mission Conclusion", target: null },
];

const ATMOSPHERIC_HINTS: Record<number, string> = {
  1: "Focus on the syntax patterns. Operators like ** signify power, and mutability is a key trait of lists.",
  2: "Indentation is the backbone of Python. Ensure control structures correctly nest the child statements.",
  3: "Filter the linguistic noise using .isalpha() and initiate a spatial reversal.",
  4: "Transform the string into a list node before performing a .join() transition."
};



const ROUND_1_QUESTIONS = [
  {
    id: 1,
    question: "What is the output of print(2 ** 3)?",
    options: ["6", "8", "9", "12"],
    correct: 1,
    posMarks: 1,
    negMarks: 0,
    output: "Key: Manifested"
  },
  {
    id: 2,
    question: "Which of these is a mutable data type in Python?",
    options: ["Tuple", "List", "String", "Int"],
    correct: 1,
    posMarks: 1,
    negMarks: 0,
    output: "Key: Manifested"
  },
  {
    id: 3,
    question: "What does 'len()' function do?",
    options: ["Returns the length of an object", "Converts to integer", "Prints a value", "Clears a list"],
    correct: 0,
    posMarks: 1,
    negMarks: 0,
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
            <span className={styles.statValue} suppressHydrationWarning>{Math.floor((Date.now() - startTime) / 60000)}m</span>
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
        <p className={styles.redirectText}>Auto-redirecting in 3s…</p>
      </motion.div>
    </div>
  );
}

// react-doctor-disable-next-line react-doctor/no-giant-component, react-doctor/prefer-useReducer
export default function PyHuntView() {
  // react-doctor-disable-next-line react-doctor/rerender-state-only-in-handlers -- used in render at L929
  const [hasStarted, setHasStarted] = useState(false);
  // react-doctor-disable-next-line react-doctor/rerender-state-only-in-handlers -- used in render at L948
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authForm, setAuthForm] = useState({ usn: "", missionCode: "" });
  const [authError, setAuthError] = useState("");

  const [currentRound, setCurrentRound] = useState(1);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);
  const [code, setCode] = useState("");
  const [isHintRevealed, setIsHintRevealed] = useState(false);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [startTime] = useState(() => Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [warningCount, setWarningCount] = useState(0);

  const [selectedLanguage, setSelectedLanguage] = useState<"python" | "c" | "cpp">("python");

  // Hook 1: WASM compiler for C/C++ local browser compilation
  const { runC_Cpp: runWasm, runTestSuite: runWasmTestSuite, isCompiling: wasmCompiling, isDownloading: wasmDownloading, isRunning: wasmRunning } = useWasmCompiler();

  // Hook 2: WebWorker Pyodide sandbox for Python local browser running
  const { runCode: runPython, runTestSuite: runPythonTestSuite, loading: pyLocalLoading } = usePyodide(currentRound === 3 || currentRound === 4);

  // Combined Loading/Compiling Flags
  const pyLoading = selectedLanguage === 'python'
    ? pyLocalLoading
    : (wasmDownloading || wasmCompiling || wasmRunning);

  const isCompiling = selectedLanguage === 'python' ? false : wasmCompiling;

  const runActiveCode = useCallback(async (code: string, input: any = ""): Promise<{ stdout: string; error?: string }> => {
    if (selectedLanguage === 'python') {
      const res = await runPython(code, input);
      return { stdout: res.stdout || "", error: res.error };
    } else {
      const res = await runWasm(code, Array.isArray(input) ? input : [String(input)]);
      return { stdout: res.stdout || "", error: res.error };
    }
  }, [selectedLanguage, runPython, runWasm]);

  const runActiveTestSuite = useCallback(async (code: string, testCases: any[]) => {
    if (selectedLanguage === 'python') {
      return await runPythonTestSuite(code, testCases, (stdout, expected) => {
        return sharedValidateOutput(stdout, expected);
      });
    } else {
      return await runWasmTestSuite(code, testCases, (stdout, expected) => {
        return sharedValidateOutput(stdout, expected);
      });
    }
  }, [selectedLanguage, runPythonTestSuite, runWasmTestSuite]);

  const { enter: enterFullscreen } = useFullscreen();

  const [isAtGate, setIsAtGate] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [gateError, setGateError] = useState(false);
  const [hint, setHint] = useState("");
  const [showSuccessRipple, setShowSuccessRipple] = useState(false);

  const [assignedClueIndex, setAssignedClueIndex] = useState<number | null>(null);
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
  const [codingChallenges, setCodingChallenges] = useState<any>({});
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [testResults, setTestResults] = useState<any[]>([]);

  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

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
      // react-doctor-disable-next-line react-doctor/js-cache-storage
      const studentData = localStorage.getItem("exam_student");
      const studentObj = studentData ? JSON.parse(studentData) : null;
      const studentId = studentObj?.id || studentObj?.student_id;

      if (studentId) {
        const now = new Date().toISOString();
        // Run all DB updates in parallel
        await Promise.all([
          supabase.from('exam_status')
            .update({ status: 'submitted', submitted_at: now })
            .eq('student_id', studentId)
            .filter('exam_name', 'ilike', 'pyhunt'),
          supabase.from('exam_results').upsert({
            student_id: studentId,
            exam_name: 'PyHunt',
            score: 100,
            total_marks: 100,
            submitted_at: now
          }, { onConflict: 'student_id,exam_name' }),
          supabase.from('odyssey_progress')
            .update({ is_completed: true, last_ping: now })
            .eq('student_id', studentId),
        ]);
      }
      setCurrentRound(6);
    } catch (err) {
      console.error("Submission error:", err);
      setCurrentRound(6);
    } finally {
      setLoading(false);
    }
  };

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/js-cache-storage
    const raw = localStorage.getItem("exam_student");
    let channel: any = null;
    let timerId: any = null;

    if (raw) {
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

          // Restore assigned clue for current round
          const currentRoundKey = `round_${data.current_round}_state`;
          const currentRoundState = (data as any)[currentRoundKey];
          if (currentRoundState?.assigned_clue_index !== undefined) {
            setAssignedClueIndex(currentRoundState.assigned_clue_index);
          }
        }
        setLoading(false);
      }
      syncProgress();

      async function fetchGlobalConfigs(force: boolean = false) {
        // Throttling: prevent redundant fetches within 30 seconds unless forced
        const now = Date.now();
        if (!force && isFetchingRef.current) return;
        if (!force && now - lastFetchRef.current < 30000) return;

        isFetchingRef.current = true;
        try {
          const data = await fetchPublicPyHuntConfig();
          lastFetchRef.current = Date.now();
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
            const cc = data.find((c: any) => c.config_key === 'coding_challenges')?.config_value;
            if (cc) setCodingChallenges(cc);
          }
        } finally {
          isFetchingRef.current = false;
        }
      }
      fetchGlobalConfigs();

      channel = supabase.channel('pyhunt_global_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pyhunt_global_config' }, () => {
          // Add jitter: 2-6 seconds delay to spread the load across 200 clients
          const jitter = Math.random() * 4000 + 2000;
          if (timerId) clearTimeout(timerId);
          timerId = setTimeout(() => fetchGlobalConfigs(true), jitter);
        })
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (student?.id && code) {
      const timer = setTimeout(() => {
        localStorage.setItem(`pyhunt_code_draft_${student.id}_${selectedLanguage}`, code);
        localStorage.setItem(`pyhunt_code_draft_${student.id}`, code);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [code, student, selectedLanguage]);

  const handleLanguageChange = useCallback((lang: "python" | "c" | "cpp") => {
    setSelectedLanguage(lang);
    setTestResults([]);
    setOutput("");

    // Load draft or starter code for this language!
    const roundChallenges = codingChallenges[currentRound] || [];
    const currentChallenge = roundChallenges[currentProblemIndex];
    const roundConfig = globalConfigs.find((c: any) => c.round === currentRound);
    const activeProblem = currentChallenge || roundConfig;

    const starter = lang === 'python'
      ? (activeProblem?.starter_code || 'def solution(input_str):\n    # Write your logic here\n    pass')
      : lang === 'c'
      ? (activeProblem?.starter_code_c || `#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char input[2048];\n    if (fgets(input, sizeof(input), stdin)) {\n        input[strcspn(input, "\\n")] = 0;\n        \n    }\n    return 0;\n}`)
      : (activeProblem?.starter_code_cpp || `#include <iostream>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    string input;\n    if (getline(cin, input)) {\n        \n    }\n    return 0;\n}`);

    const draftKey = `pyhunt_code_draft_${student?.id || student?.student_id}_${lang}`;
    const savedDraft = localStorage.getItem(draftKey);

    if (savedDraft && savedDraft.startsWith(starter)) {
      setCode(savedDraft);
    } else {
      setCode(starter + (
        lang === 'python'
          ? '\n\n# Transform the input string into the expected output\n# Print only the final result\n'
          : '\n\n// Transform the input string into the expected output\n// Print only the final result\n'
      ));
    }
  }, [currentRound, currentProblemIndex, codingChallenges, globalConfigs, student]);

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

  // react-doctor-disable-next-line react-doctor/no-effect-chain
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (currentRound === 2 && originalJumbleCode && jumbledLines.length === 0) {
        const lines = originalJumbleCode.split('\n').filter((l: string) => l.trim() !== "");
        const shuffled = lines.toSorted(() => Math.random() - 0.5);
        setJumbledLines(shuffled);
      }
    }
  }, [currentRound, originalJumbleCode, jumbledLines.length]);

  // --- Initialization Singularity: Seed editor with starter code ---
  useEffect(() => {
    if (currentRound > 2 && currentRound < 5) {
      const roundChallenges = codingChallenges[currentRound] || [];
      const currentChallenge = roundChallenges[currentProblemIndex];
      const roundConfig = globalConfigs.find((c: any) => c.round === currentRound);
      const activeProblem = currentChallenge || roundConfig;
      
      const starter = selectedLanguage === 'python'
        ? (activeProblem?.starter_code || 'def solution(input_str):\n    # Write your logic here\n    pass')
        : selectedLanguage === 'c'
        ? (activeProblem?.starter_code_c || `#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char input[2048];\n    if (fgets(input, sizeof(input), stdin)) {\n        input[strcspn(input, "\\n")] = 0;\n        \n    }\n    return 0;\n}`)
        : (activeProblem?.starter_code_cpp || `#include <iostream>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    string input;\n    if (getline(cin, input)) {\n        \n    }\n    return 0;\n}`);

      if (starter && !code.startsWith(starter)) {
        // Check for a saved draft first
        const draftKey = `pyhunt_code_draft_${student?.id || student?.student_id}_${selectedLanguage}`;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft && savedDraft.startsWith(starter)) {
          setCode(savedDraft);
        } else {
          setCode(starter + (
            selectedLanguage === 'python'
              ? '\n\n# Transform the input string into the expected output\n# Print only the final result\n'
              : '\n\n// Transform the input string into the expected output\n// Print only the final result\n'
          ));
        }
      }
    }
  }, [currentRound, currentProblemIndex, selectedLanguage, codingChallenges, globalConfigs, student, code]);

  const handleAuthorize = async () => {
    let targetCode = "PYHUNT67";
    let allowedUsns = "";

    // 1. Try to use already-fetched config first to avoid API call
    const authConfig = globalConfigs.find((c: any) => c.config_key === 'auth')?.config_value;

    if (authConfig) {
      targetCode = authConfig.startCode || "PYHUNT67";
      allowedUsns = authConfig.authorizedUsns || "";
    } else {
      // 2. Fallback to API if not in state yet (unlikely)
      const data = await fetchPublicPyHuntConfig();
      if (data && data.length > 0) {
        const auth = data.find((c: any) => c.config_key === 'auth')?.config_value;
        if (auth) {
          targetCode = auth.startCode || "PYHUNT67";
          allowedUsns = auth.authorizedUsns || "";
        }
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

      // High-Velocity Orbital Distribution Engine: Initial Assignment for Round 1
      try {
        const distRes = await fetch('/api/pyhunt/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            roundNum: 1,
            totalClues: 4
          })
        });
        const distData = await distRes.json();
        if (distData.success) {
          setAssignedClueIndex(distData.clueIndex);
        }
      } catch (err) {
        console.warn("[Orbital Engine] Initial crystallization failed.");
      }
    } else {
      setAuthError("Invalid Mission Authorization Code.");
    }
  };

  const handleRevealHint = async () => {
    const studentId = student?.id || student?.student_id;
    if (!studentId || isHintRevealed) return;

    setIsHintRevealed(true);

    // Update local state for immediate feedback
    setStudent((prev: any) => ({
      ...prev,
      hints_taken: (prev?.hints_taken || 0) + 1
    }));

    try {
      await supabase.rpc('increment_hints_taken', {
        student_id_val: studentId
      });
    } catch (err) {
      console.error("Hint increment failed:", err);
    }
  };

  const handleExecute = async () => {
    if (currentRound === 1) {
      // ─── Calculate MCQ Score ───
      let mcqScore = 0;
      let mcqTotal = 0;
      mcqSet.forEach((q, idx) => {
        mcqTotal += q.posMarks;
        if (mcqSelectionMap[idx] === q.correct) {
          mcqScore += q.posMarks;
        } else if (mcqSelectionMap[idx] !== undefined) {
          mcqScore -= q.negMarks;
        }
      });
      // ──────────────────────────

      const allCorrect = Object.keys(mcqSelectionMap).length === mcqSet.length && mcqSet.every((q, idx) => mcqSelectionMap[idx] === q.correct);
      const answeredCount = Object.keys(mcqSelectionMap).length;
      if (answeredCount < mcqSet.length) {
        setOutput(`ERROR: Incomplete logic chain. Answer all ${mcqSet.length} nodes.`);
        return;
      }

      if (!allCorrect) {
        setWrongAttempts(prev => prev + 1);
        setOutput("Logic sequence discrepancies detected. Mission bypass authorized.");
      } else {
        setOutput("");
      }

      // --- Clue Logic Integration ---
      try {
        const { data: rankData } = await supabase.rpc('increment_completion_count', {
          round: currentRound
        });
        if (rankData) {
          const totalClues = 4;
          const count = typeof rankData === 'object' ? (rankData.current_count || 1) : rankData;
          setAssignedClueIndex((count - 1) % totalClues);
        }
      } catch (err) {
        console.error("Clue assignment failed:", err);
      }
      // ------------------------------

      // Persist the score in round_1_state
      const studentId = student?.id || student?.student_id;
      if (studentId) {
        await syncOdysseyState({
          round_1_state: {
            mcq_score: mcqScore,
            mcq_total: mcqTotal,
            submitted_at: new Date().toISOString()
          }
        });
      }

      setIsAtGate(true);
      setGateError(false);
      return;
    }

    if (currentRound === 2) {
      const currentOrder = jumbledLines.map(l => l.trimEnd()).join('\n').trim();
      const targetOrder = originalJumbleCode.split('\n')
        .reduce((acc: string[], l) => {
          if (l.trim() !== "") {
            acc.push(l.trimEnd());
          }
          return acc;
        }, [])
        .join('\n')
        .trim();

      if (currentOrder === targetOrder) {
        if (currentJumbleIndex < jumbleSet.length - 1) {
          setCurrentJumbleIndex(prev => prev + 1);
          setOutput(`Sequence Node ${currentJumbleIndex + 1} synchronized. Calibrating next cluster...`);
        } else {
          // --- Clue Logic Integration ---
          try {
            const { data: rankData } = await supabase.rpc('increment_completion_count', {
              round: currentRound
            });
            if (rankData) {
              const totalClues = 4;
              const count = typeof rankData === 'object' ? (rankData.current_count || 1) : rankData;
              setAssignedClueIndex((count - 1) % totalClues);
            }
          } catch (err) {
            console.error("Clue assignment failed:", err);
          }
          // ------------------------------

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

    const roundChallenges = codingChallenges[currentRound] || [];
    const currentChallenge = roundChallenges[currentProblemIndex];

    // Fallback to legacy single-config if no challenge set found
    const roundConfig = globalConfigs.find((c: any) => c.round === currentRound);
    const activeProblem = currentChallenge || roundConfig;

    let testCases: any[] = [];
    try {
      if (activeProblem?.test_cases) {
        let parsed = activeProblem.test_cases;
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }

        if (Array.isArray(parsed)) {
          // Handle nested Supabase JSON structure
          if (parsed.length > 0 && parsed[0].test_cases && Array.isArray(parsed[0].test_cases)) {
            testCases = parsed[0].test_cases;
          } else {
            testCases = parsed;
          }
        } else if (parsed && typeof parsed === 'object' && (parsed as any).test_cases) {
          testCases = (parsed as any).test_cases;
        }
      }
    } catch (e) {
      console.error("Invalid test cases JSON configuration.");
    }
    if (Array.isArray(testCases) && testCases.length > 0) {
      // ═══ Neural Test-Runner Execution ═══
      const suite = await runActiveTestSuite(code, testCases);

      // Build console output from suite results
      let finalResults = "";
      for (let i = 0; i < suite.results.length; i++) {
        const r = suite.results[i];
        if (r.error) {
          finalResults += `❌ CASE ${i + 1}: LOGIC ERROR (${r.executionTimeMs}ms)\n   ${r.error}\n`;
        } else if (r.passed) {
          finalResults += `✅ CASE ${i + 1}: PASSED (${r.executionTimeMs}ms)\n`;
        } else {
          finalResults += `❌ CASE ${i + 1}: FAILED (${r.executionTimeMs}ms)\n   Input: ${r.input || "None"}\n   Expected: ${r.expected}\n   Got: ${r.actual || "(empty)"}\n`;
        }
      }
      finalResults += `\n━━━ ${suite.results.filter((r: any) => r.passed).length}/${suite.results.length} passed · ${suite.totalTimeMs}ms ━━━`;

      setTestResults(suite.results);
      setOutput(finalResults);

      if (suite.allPassed) {
        setShowSuccessRipple(true);
        setTimeout(() => setShowSuccessRipple(false), 1000);

        // ─── Orbital Clue Manifestation (Modulo Integration) ───
        try {
          const { data: rankData } = await supabase.rpc('increment_completion_count', {
            round: currentRound
          });
          if (rankData) {
            const totalClues = 4;
            const count = typeof rankData === 'object' ? (rankData.current_count || 1) : rankData;
            setAssignedClueIndex((count - 1) % totalClues);
          } else {
            setAssignedClueIndex(Math.floor(Math.random() * 4));
          }
        } catch (err) {
          console.error("Clue assignment failed:", err);
          setAssignedClueIndex(0);
        }

        // Sequence Check: More problems in this round?
        if (currentProblemIndex < roundChallenges.length - 1) {
          setOutput(`Problem ${currentProblemIndex + 1} solved. Initializing next data node...`);
          setCurrentProblemIndex(prev => prev + 1);
          setCode(""); // Clear for next problem
        } else {
          // Round finished
          if (currentRound === 4) {
            setIsAtGate(true);
          } else {
            setIsAtGate(true);
          }
        }
      } else {
        setWrongAttempts(prev => prev + 1);
        setHint("Logic discrepancies detected across test nodes. Debug and retry.");
        setTimeout(() => setHint(""), 4000);
      }
      return;
    }

    // Legacy Single-Output Validation (Fallback)
    const result = await runActiveCode(code);
    if (result.error) {
      setOutput(`ERROR: ${result.error}`);
      return;
    }
    setOutput(result.stdout || "No output generated.");

    const targetExpected = activeProblem?.target_output;
    const isValid = validateRound(currentRound, result.stdout || "", targetExpected);
    if (isValid) {
      setShowSuccessRipple(true);
      if (currentRound === 4) {
        setTimeout(() => setShowSuccessRipple(false), 1000);
        setIsAtGate(true);
      } else {
        setTimeout(() => {
          setShowSuccessRipple(false);
          setIsAtGate(true);
        }, 1000);
      }
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
      const res = await runActiveCode(scratchCode);
      if (res.error) {
        setScratchOutput(`ERROR: ${res.error}`);
      } else {
        const out = res.stdout || "";
        setScratchOutput(out || "Execution successful (no output)");
      }
    } catch (err: any) {
      setScratchOutput(`ERROR: ${err.message}`);
    }
  };

  const syncOdysseyState = useCallback(async (overrides: any = {}) => {
    const studentId = student?.id || student?.student_id;
    if (!studentId) return;

    // Update local state for immediate UI feedback
    setStudent((prev: any) => {
      if (!prev) return prev;
      return { ...prev, ...overrides };
    });

    try {
      const { error } = await supabase
        .from('odyssey_progress')
        .update({
          ...overrides,
          last_ping: new Date().toISOString()
        })
        .eq('student_id', studentId);
      if (error) throw error;
    } catch (err) {
      console.warn("Real-time sync drift:", err);
    }
  }, [student?.id, student?.student_id]);

  const handleMcqSelect = (idx: number, optIdx: number) => {
    const newMap = { ...mcqSelectionMap, [idx]: optIdx };
    setMcqSelectionMap(newMap);
    if (output.startsWith("ERROR")) setOutput("");

    // Live Sync Progress to Admin
    if (currentRound === 1) {
      const totalQuestions = mcqSet.length || ROUND_1_QUESTIONS.length;
      const correctCount = mcqSet.reduce((acc, q, i) => acc + (newMap[i] === q.correct ? 1 : 0), 0);
      syncOdysseyState({
        round_1_state: {
          mcq_score: correctCount,
          mcq_total: totalQuestions,
          answered_count: Object.keys(newMap).length,
          current_index: idx
        }
      });
    }
  };

  const atmosphericCrystallize = (input: string) => {
    if (!input) return "";
    return input.split('\n').reduce((acc: string[], line) => {
      const trimmed = line.trim();
      if (trimmed.length > 0) acc.push(trimmed);
      return acc;
    }, []).join('\n').toLowerCase();
  };


  const validateRound = (round: number, stdout: string, expectedTarget?: string) => {
    const roundConfig = globalConfigs.find((c: any) => c.round === round);
    if (!roundConfig && !expectedTarget) return false;

    const targetRaw = expectedTarget || roundConfig?.target_output || "";

    // Fallback defaults if no config target
    const fallbackTargets: Record<number, string> = {
      3: "palindrome: true",
      4: "1, 2, fizz, 4, buzz",
    };

    const expected = targetRaw || fallbackTargets[round] || "";
    return sharedValidateOutput(stdout, expected);
  };

  const handleGateUnlock = async () => {
    const studentId = student?.id || student?.student_id;
    const currentConfig = globalConfigs.find((c: any) => c.round === currentRound);
    let targetCode = currentConfig?.code || (currentRound === 1 ? "LIBRARY42" : "ALPHA");

    // Support multiple codes for different clue variants
    if (assignedClueIndex !== null && targetCode.includes('|')) {
      const codes = targetCode.split('|').map((s: string) => s.trim());
      targetCode = codes[assignedClueIndex % codes.length] || codes[0];
    }

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
      setIsHintRevealed(false);

      setIsHintRevealed(false);


      localStorage.removeItem(`pyhunt_code_draft_${studentId}`);
      localStorage.removeItem(`pyhunt_mcq_map_${studentId}`);

      // High-Velocity Orbital Distribution Engine
      // Assigns clue node based on completion rank (n-1 mod 4)
      try {
        const distRes = await fetch('/api/pyhunt/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            roundNum: next,
            totalClues: 4
          })
        });
        const distData = await distRes.json();
        if (distData.success) {
          setAssignedClueIndex(distData.clueIndex);
        }
      } catch (err) {
        console.warn("[Orbital Engine] Fallback engaged due to gravitational drift.");
      }

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

  if (loading) return <div className={styles.levitate}>Igniting PyHunt Engines\u2026</div>;

  if (isAutoSubmitted) {
    return (
      <div className={styles.terminationOverlay}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={styles.terminationCard}>
          <div className={styles.terminationIcon}>🚫</div>
          <h2 className={styles.terminationTitle}>SESSION TERMINATED</h2>
          <div className={styles.statGrid}>
            <div className={styles.statItem}><span className={styles.statLabel}>Total Time</span><span className={styles.statValue} suppressHydrationWarning>{formatTime(Date.now() - startTime)}</span></div>
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
            <div className={styles.authInputGroup}>
              <label htmlFor="candidate-usn">Candidate USN</label>
              <input id="candidate-usn" type="text" className={styles.authInput} value={authForm.usn} readOnly />
            </div>
            <div className={styles.authInputGroup}>
              <label htmlFor="mission-code">Mission Start Code</label>
              <input id="mission-code" type="text" className={styles.authInput} placeholder="Enter authorized mission code" value={authForm.missionCode} onChange={(e) => setAuthForm(prev => ({ ...prev, missionCode: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAuthorize()} />
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
            Python Treasure Hunt, Solve {ROUNDS.length - 1} rounds of challenges to unlock the final transmission!
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
              <h2>{labelConfig.orbit} {currentRound}: {globalConfigs.find((c: any) => c.round === currentRound)?.name || ROUNDS[currentRound - 1].name}</h2>
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

            {(currentRound > 2 && currentRound < 5) ? (
              <CodingInterface
                problem={{
                  prompt: (codingChallenges[currentRound] || [])[currentProblemIndex]?.prompt || globalConfigs.find((c: any) => c.round === currentRound)?.prompt || "",
                  imageUrl: (codingChallenges[currentRound] || [])[currentProblemIndex]?.imageUrl || globalConfigs.find((c: any) => c.round === currentRound)?.imageUrl || "",
                  test_cases: (codingChallenges[currentRound] || [])[currentProblemIndex]?.test_cases || globalConfigs.find((c: any) => c.round === currentRound)?.test_cases || "[]",
                  target_output: (codingChallenges[currentRound] || [])[currentProblemIndex]?.target_output || globalConfigs.find((c: any) => c.round === currentRound)?.target_output || "",
                  starter_code: (codingChallenges[currentRound] || [])[currentProblemIndex]?.starter_code || globalConfigs.find((c: any) => c.round === currentRound)?.starter_code || "",
                  starter_code_c: (codingChallenges[currentRound] || [])[currentProblemIndex]?.starter_code_c || globalConfigs.find((c: any) => c.round === currentRound)?.starter_code_c || "",
                  starter_code_cpp: (codingChallenges[currentRound] || [])[currentProblemIndex]?.starter_code_cpp || globalConfigs.find((c: any) => c.round === currentRound)?.starter_code_cpp || ""
                }}
                code={code}
                setCode={setCode}
                output={output}
                onRun={handleExecute}
                onSubmit={handleExecute}
                pyLoading={pyLoading}
                currentRound={currentRound}
                labelConfig={labelConfig}
                testResults={testResults}
                hint={ATMOSPHERIC_HINTS[currentRound]}
                isHintRevealed={isHintRevealed}
                onRevealHint={handleRevealHint}
                isCompiling={isCompiling}
                showSuccessRipple={showSuccessRipple}
                selectedLanguage={selectedLanguage}
                onLanguageChange={handleLanguageChange}
              />

            ) : (
              <>
                {(() => {
                  const roundChallenges = codingChallenges[currentRound] || [];
                  const currentChallenge = roundChallenges[currentProblemIndex];
                  const c = currentChallenge || globalConfigs.find((conf: any) => conf.round === currentRound);

                  if (!c?.prompt && !c?.imageUrl && roundChallenges.length <= 1) return null;
                  return (
                    <div className={styles.roundMeta}>
                      {roundChallenges.length > 1 && (
                        <div className={styles.challengeProgress} style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>
                          CHALLENGE {currentProblemIndex + 1} OF {roundChallenges.length}
                        </div>
                      )}
                      {c?.imageUrl && <Image src={c.imageUrl} alt="Logic Challenge" className={styles.roundImage} width={600} height={300} unoptimized />}
                      {c?.prompt && <p className={styles.roundPrompt} style={{ whiteSpace: 'pre-wrap' }}>{c.prompt}</p>}
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
                            <Image
                              src={mcqSet[currentMcqIndex].imageUrl}
                              alt="Question Visual"
                              width={400}
                              height={200}
                              unoptimized
                              style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                          </div>
                        )}
                      </div>

                      <div className={styles.mcqOptions}>
                        {mcqSet[currentMcqIndex].options.map((opt: string, i: number) => (
                          <button
                            key={opt}
                            className={`${styles.mcqOption} ${mcqSelectionMap[currentMcqIndex] === i ? styles.selected : ""}`}
                            onClick={() => handleMcqSelect(currentMcqIndex, i)}
                          >
                            <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                            {opt}
                          </button>
                        ))}
                      </div>

                      <div className={styles.mcqNav}>
                        <button disabled={currentMcqIndex === 0} onClick={() => {
                          const prevIdx = currentMcqIndex - 1;
                          setCurrentMcqIndex(prevIdx);
                          syncOdysseyState({
                            round_1_state: {
                              mcq_score: mcqSet.reduce((acc, q, i) => acc + (mcqSelectionMap[i] === q.correct ? 1 : 0), 0),
                              mcq_total: mcqSet.length,
                              answered_count: Object.keys(mcqSelectionMap).length,
                              current_index: prevIdx
                            }
                          });
                        }} className={styles.navBtn}>← Previous Node</button>
                        {mcqSelectionMap[currentMcqIndex] !== undefined && currentMcqIndex < mcqSet.length - 1 && (
                          <button onClick={() => {
                            const nextIdx = currentMcqIndex + 1;
                            setCurrentMcqIndex(nextIdx);
                            syncOdysseyState({
                              round_1_state: {
                                mcq_score: mcqSet.reduce((acc, q, i) => acc + (mcqSelectionMap[i] === q.correct ? 1 : 0), 0),
                                mcq_total: mcqSet.length,
                                answered_count: Object.keys(mcqSelectionMap).length,
                                current_index: nextIdx
                              }
                            });
                          }} className={styles.navBtn}>Next Node →</button>
                        )}
                      </div>

                      <CognitiveBeacon
                        hint={ATMOSPHERIC_HINTS[1]}
                        isRevealed={isHintRevealed}
                        onReveal={handleRevealHint}
                      />
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

                        <CognitiveBeacon
                          hint={ATMOSPHERIC_HINTS[2]}
                          isRevealed={isHintRevealed}
                          onReveal={handleRevealHint}
                        />
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
                            placeholder="# Test your Python logic here…"
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

                      {assignedClueIndex !== null && (
                        <div className={styles.finalClueBox} style={{ margin: '20px 0', padding: '15px', background: 'rgba(0, 242, 255, 0.05)', borderRadius: '8px', border: '1px border rgba(0, 242, 255, 0.2)' }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '5px' }}>CONCLUDING CLUE:</span>
                          <p style={{ margin: 0, fontSize: '1.1rem' }}>
                            {(() => {
                              const c = globalConfigs.find((conf: any) => conf.round === 4);
                              if (!c) return "The treasure is within reach.";
                              if (c.clues && Array.isArray(c.clues)) return c.clues[assignedClueIndex] || c.clue;
                              if (c.clue_variants) {
                                const variants = c.clue_variants.split('|');
                                return variants[assignedClueIndex % variants.length] || c.clue;
                              }
                              return c.clue || "The treasure is within reach.";
                            })()}
                          </p>
                        </div>
                      )}

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
                        placeholder="# Manifest your Python logic here…"
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
                </div>

                {(currentRound === 2 || (output && output.includes("ERROR"))) && (
                  <div className={styles.terminal}>
                    <div className={styles.terminalLabel}>TRANSMISSION OUTPUT</div>
                    <pre style={{ color: output.includes("ERROR") ? "#ff4d4d" : "inherit" }}>{output}</pre>
                  </div>
                )}
              </>
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

              {currentRound === 1 && student?.id && (
                <div style={{ marginBottom: 20, textAlign: 'center', padding: '10px', background: 'rgba(0, 242, 255, 0.1)', borderRadius: '8px', border: '1px solid rgba(0, 242, 255, 0.2)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Round 1 Scorecard</span>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: '#fff' }}>
                    {(() => {
                      try {
                        const r1State = typeof student.round_1_state === 'string' ? JSON.parse(student.round_1_state) : student.round_1_state;
                        return r1State?.mcq_score !== undefined ? `${r1State.mcq_score}/${r1State.mcq_total || 3}` : "Pending...";
                      } catch (e) { return "Calculating..."; }
                    })()}
                  </span>
                </div>
              )}

              <div className={styles.clueBox}>
                <label>CLUE {assignedClueIndex !== null ? String.fromCharCode(65 + assignedClueIndex) : ""}:</label>
                <p>
                  {(() => {
                    const c = globalConfigs.find((conf: any) => conf.round === currentRound);
                    if (!c) return "Locate the physical node to find your code.";

                    // Support multiple clues if provided in config as comma-separated or array
                    if (assignedClueIndex !== null && c.clues && Array.isArray(c.clues)) {
                      return c.clues[assignedClueIndex] || c.clue || "Locate the physical node.";
                    }
                    if (assignedClueIndex !== null && c.clue_variants) {
                      const variants = c.clue_variants.split('|');
                      return variants[assignedClueIndex % variants.length] || c.clue;
                    }

                    return c.clue || "Locate the physical node to find your code.";
                  })()}
                </p>
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
