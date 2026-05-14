"use client";

import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    loadPyodide: any;
    pyodide: any;
  }
}

export function usePyodide(enabled: boolean = true) {
  const [pyodide, setPyodide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
        script.async = true;
        script.onload = async () => {
          const py = await window.loadPyodide();
          window.pyodide = py;
          setPyodide(py);
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

  const runCode = useCallback(async (code: string, input: string = "") => {
    if (!pyodide) return { error: "Logic Engine not ready." };
    
    try {
      // Create a clean output buffer and set stdin
      await pyodide.runPythonAsync(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
sys.stdin = io.StringIO("""${input.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")
      `);

      await pyodide.runPythonAsync(code);
      
      const stdout = pyodide.runPython("sys.stdout.getvalue()");
      const stderr = pyodide.runPython("sys.stderr.getvalue()");
      
      return { stdout, stderr };
    } catch (err: any) {
      return { error: err.message };
    }
  }, [pyodide]);

  return { pyodide, loading, error, runCode };
}
