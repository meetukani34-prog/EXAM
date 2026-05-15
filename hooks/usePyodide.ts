"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

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

// ─── Spectral Worker Script (Blob-ready) ───
// This code runs in a separate thread to prevent main UI freezes.
const workerScript = `
  importScripts("https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js");
  
  let pyodide;

  async function initPyodide() {
    if (!pyodide) {
      pyodide = await loadPyodide();
    }
  }

  self.onmessage = async (e) => {
    const { code, inputListStr, id } = e.data;
    
    try {
      await initPyodide();

      const wrapperCode = \`
import sys
import io

# Clear previous run artifacts
_stdout_val = ""
_stderr_val = ""

# --- Spectral Input Override ---
_input_queue = [\${inputListStr}]
_input_index = 0

def input(prompt=""):
    global _input_index
    if _input_index < len(_input_queue):
        val = _input_queue[_input_index]
        _input_index += 1
        return val
    return ""

# --- Legacy Compatibility ---
# Provides the full input as a single string for older logic patterns
input_string = "\\n".join(_input_queue)

# --- Crystallized Result Capture ---
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()

try:
\${code.split('\\n').map(line => '    ' + line).join('\\n')}
finally:
    _stdout_val = sys.stdout.getvalue()
    _stderr_val = sys.stderr.getvalue()
\`;

      await pyodide.runPythonAsync(wrapperCode);
      
      const stdout = pyodide.runPython("_stdout_val") || "";
      const stderr = pyodide.runPython("_stderr_val") || "";
      
      self.postMessage({ id, stdout, stderr });
    } catch (err) {
      self.postMessage({ id, error: err.message });
    }
  };
`;

export function usePyodide(enabled: boolean = true) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<Map<string, { resolve: Function, reject: Function, timeout: any }>>(new Map());

  const initWorker = useCallback(() => {
    if (workerRef.current) workerRef.current.terminate();
    
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    worker.onmessage = (e) => {
      const { id, stdout, stderr, error } = e.data;
      const request = pendingRequests.current.get(id);
      
      if (request) {
        clearTimeout(request.timeout);
        pendingRequests.current.delete(id);
        if (error) {
          request.resolve({ error });
        } else {
          request.resolve({ stdout, stderr });
        }
      }
    };

    worker.onerror = (e) => {
      console.error("Worker Error:", e);
      // Fail all pending requests
      pendingRequests.current.forEach((req, id) => {
        clearTimeout(req.timeout);
        req.resolve({ error: "Logic Engine Crashed. Restarting..." });
      });
      pendingRequests.current.clear();
      initWorker(); // Restart worker
    };

    workerRef.current = worker;
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled && !workerRef.current) {
      initWorker();
    }
    return () => {
      workerRef.current?.terminate();
    };
  }, [enabled, initWorker]);

  const escapePythonString = useCallback((str: string): string => {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }, []);

  const runCode = useCallback((code: string, input: any = ""): Promise<{ stdout?: string; stderr?: string; error?: string }> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        resolve({ error: "Logic Engine not ready." });
        return;
      }

      const id = Math.random().toString(36).substring(7);
      
      // Prep inputs
      let inputStr = "";
      if (typeof input === 'string') {
        inputStr = input;
      } else if (Array.isArray(input)) {
        inputStr = input.join('\n');
      }
      
      const inputLines = inputStr.split('\n');
      const inputListStr = inputLines.map(l => `"""${escapePythonString(l)}"""`).join(', ');

      const timeout = setTimeout(() => {
        pendingRequests.current.delete(id);
        initWorker(); // Terminate and restart the worker on timeout
        resolve({ error: "Execution timeout (10s). Infinite loop detected and neutralized." });
      }, EXECUTION_TIMEOUT_MS);

      pendingRequests.current.set(id, { resolve, reject, timeout });
      
      workerRef.current.postMessage({ id, code, inputListStr });
    });
  }, [initWorker, escapePythonString]);

  const runTestSuite = useCallback(async (
    code: string,
    testCases: Array<{ input?: string; expected?: string; output?: string; expected_output?: string }>,
    validateFn: (stdout: string, expected: string) => boolean
  ): Promise<TestSuiteResult> => {
    const suiteStart = performance.now();
    const results: TestCaseResult[] = [];
    let allPassed = true;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const caseStart = performance.now();
      const expectedStr = (tc.expected || tc.output || tc.expected_output || "").toString().trim();

      const res = await runCode(code, tc.input || "");
      const executionTimeMs = Math.round(performance.now() - caseStart);

      if (res.error) {
        allPassed = false;
        results.push({
          input: tc.input || "",
          expected: expectedStr,
          actual: (res.stdout || "").trim(),
          passed: false,
          error: res.error,
          executionTimeMs,
        });
        break; // Fail-fast
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

  return { loading, error, runCode, runTestSuite };
}
