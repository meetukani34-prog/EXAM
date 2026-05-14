"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    loadPyodide: any;
    pyodide: any;
  }
}

// --- Neural Test-Runner Configuration ---
const PYODIDE_VERSION = "0.25.0";
const EXECUTION_TIMEOUT_MS = 10000; // 10s hard cap per test case
const MAX_OUTPUT_LENGTH = 50000;    // Prevent memory bombs

export interface TestCaseResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
  executionTimeMs: number;
}

export interface TestSuiteResult {
  results: TestCaseResult[];
  allPassed: boolean;
  totalCases: number;
  passedCount: number;
  failedCount: number;
  totalTimeMs: number;
}

export function usePyodide(enabled: boolean = true) {
  const [pyodide, setPyodide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const executionLockRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    async function initPyodide() {
      if (window.pyodide) {
        setPyodide(window.pyodide);
        setLoading(false);
        return;
      }

      try {
        const script = document.createElement('script');
        script.src = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;
        script.async = true;
        script.onload = async () => {
          const py = await window.loadPyodide();
          window.pyodide = py;
          setPyodide(py);
          setLoading(false);
        };
        script.onerror = () => {
          setError("Failed to load the Logic Engine CDN.");
          setLoading(false);
        };
        document.head.appendChild(script);
      } catch (err) {
        console.error("Pyodide loading failed:", err);
        setError("Failed to ignite the Logic Engine.");
        setLoading(false);
      }
    }

    initPyodide();
  }, [enabled]);

  /**
   * Escape a string for safe injection into a Python triple-quoted string.
   * Handles backslashes, quotes, and triple-quote sequences.
   */
  const escapePythonString = useCallback((str: string): string => {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"""/g, '\\"\\"\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }, []);

  /**
   * Spectral Input Override — Core single-case executor.
   * Mocks Python's input() with a queue-based system that feeds
   * multi-line inputs one at a time, preventing browser freeze.
   */
  const runCode = useCallback(async (code: string, input: string = "") => {
    if (!pyodide) return { error: "Logic Engine not ready." };
    
    try {
      // Split input into lines for queue-based feeding
      const inputLines = input.split('\n');
      const escapedLines = inputLines.map(l => escapePythonString(l));
      const inputListStr = escapedLines.map(l => `"""${l}"""`).join(', ');

      // Wrapper: Override input() with a queue, redirect stdout/stderr
      const wrapperCode = `
import sys
import io

# --- Spectral Input Override ---
# Queue-based input mock: feeds one line per call
_input_queue = [${inputListStr}]
_input_index = 0

def input(prompt=""):
    global _input_index
    if _input_index < len(_input_queue):
        val = _input_queue[_input_index]
        _input_index += 1
        return val
    return ""

# --- Crystallized Result Capture ---
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()

${code}

# Capture crystallized results
_stdout_val = sys.stdout.getvalue()
_stderr_val = sys.stderr.getvalue()
`;

      // Execute with timeout protection
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout (10s). Check for infinite loops.")), EXECUTION_TIMEOUT_MS)
      );

      await Promise.race([
        pyodide.runPythonAsync(wrapperCode),
        timeoutPromise
      ]);
      
      let stdout = pyodide.runPython("_stdout_val") || "";
      const stderr = pyodide.runPython("_stderr_val") || "";
      
      // Truncate massive outputs to prevent memory issues
      if (stdout.length > MAX_OUTPUT_LENGTH) {
        stdout = stdout.substring(0, MAX_OUTPUT_LENGTH) + "\n... [OUTPUT TRUNCATED]";
      }
      
      return { stdout, stderr };
    } catch (err: any) {
      return { error: err.message };
    }
  }, [pyodide, escapePythonString]);

  /**
   * Neural Test-Runner — Orchestrates validation across all test cases.
   * Runs each case in isolation, applies the Atmospheric Tolerance Filter,
   * and returns a comprehensive TestSuiteResult.
   */
  const runTestSuite = useCallback(async (
    code: string,
    testCases: Array<{ input?: string; expected?: string; output?: string }>,
    validateFn: (stdout: string, expected: string) => boolean
  ): Promise<TestSuiteResult> => {
    // Prevent concurrent execution (200-user safety)
    if (executionLockRef.current) {
      return {
        results: [],
        allPassed: false,
        totalCases: testCases.length,
        passedCount: 0,
        failedCount: 0,
        totalTimeMs: 0,
      };
    }

    executionLockRef.current = true;
    const suiteStart = performance.now();
    const results: TestCaseResult[] = [];
    let allPassed = true;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const caseStart = performance.now();
      const expectedStr = (tc.expected || tc.output || "").toString().trim();

      const res = await runCode(code, tc.input || "");
      const executionTimeMs = Math.round(performance.now() - caseStart);

      if (res.error) {
        allPassed = false;
        results.push({
          input: tc.input || "",
          expected: expectedStr,
          actual: "",
          passed: false,
          error: res.error,
          executionTimeMs,
        });
        break; // Fail-fast like LeetCode
      }

      const actualStr = (res.stdout || "").toString().trim();
      const isCorrect = validateFn(res.stdout || "", expectedStr);

      results.push({
        input: tc.input || "",
        expected: expectedStr,
        actual: actualStr,
        passed: isCorrect,
        executionTimeMs,
      });

      if (!isCorrect) {
        allPassed = false;
        break; // Fail-fast
      }
    }

    executionLockRef.current = false;
    const totalTimeMs = Math.round(performance.now() - suiteStart);

    return {
      results,
      allPassed,
      totalCases: testCases.length,
      passedCount: results.filter(r => r.passed).length,
      failedCount: results.filter(r => !r.passed).length,
      totalTimeMs,
    };
  }, [runCode]);

  return { pyodide, loading, error, runCode, runTestSuite };
}
