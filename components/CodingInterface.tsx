"use client";

import React, { useState } from 'react';
import styles from './CodingInterface.module.css';
import { motion, AnimatePresence } from 'framer-motion';

interface CodingInterfaceProps {
  problem: {
    prompt: string;
    imageUrl?: string;
    test_cases?: string;
    target_output?: string;
  };
  code: string;
  setCode: (code: string) => void;
  output: string;
  onRun: () => void;
  onSubmit: () => void;
  pyLoading: boolean;
  currentRound: number;
  labelConfig: { phase: string; orbit: string };
  isRound4Passed?: boolean;
  testResults?: Array<{
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
    error?: string;
  }>;
}

export default function CodingInterface({
  problem,
  code,
  setCode,
  output,
  onRun,
  onSubmit,
  pyLoading,
  currentRound,
  labelConfig,
  isRound4Passed,
  testResults
}: CodingInterfaceProps) {
  const [activeTab, setActiveTab] = useState<'description' | 'testcases'>('description');
  const [terminalTab, setTerminalTab] = useState<'output' | 'testcase_details'>('output');

  // Parse test cases if available
  let testCases = [];
  try {
    if (problem.test_cases) {
      const parsed = JSON.parse(problem.test_cases);
      if (Array.isArray(parsed)) {
        // Handle nested structure: [{ test_cases: [...] }] or simple array [...]
        if (parsed.length > 0 && parsed[0].test_cases && Array.isArray(parsed[0].test_cases)) {
          testCases = parsed[0].test_cases;
        } else {
          testCases = parsed;
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse test cases", e);
  }

  return (
    <div className={styles.container}>
      <div className={styles.splitPane}>
        {/* LEFT: PROBLEM DESCRIPTION */}
        <div className={styles.leftPane}>
          <div className={styles.paneHeader}>
            <div className={styles.tabGroup}>
              <button 
                className={`${styles.tab} ${activeTab === 'description' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('description')}
              >
                📜 Description
              </button>
            </div>
          </div>
          <div className={styles.paneContent}>
            <div className={styles.problemHeader}>
              <h3>{labelConfig.orbit} {currentRound}</h3>
            </div>
            {problem.imageUrl && (
              <div className={styles.imageContainer}>
                <img src={problem.imageUrl} alt="Problem Visualization" className={styles.problemImage} />
              </div>
            )}
            <div className={styles.promptText}>
              {problem.prompt}
            </div>
            {testCases.length > 0 && (
              <div className={styles.examplesSection}>
                <h4>Examples:</h4>
                {testCases.slice(0, 2).map((tc: any, i: number) => (
                  <div key={i} className={styles.exampleBox}>
                    <div className={styles.exampleTitle}>Example {i + 1}</div>
                    <div className={styles.exampleItem}>
                      <span>Input:</span> <code>{tc.input || "None"}</code>
                    </div>
                    <div className={styles.exampleItem}>
                      <span>Output:</span> <code>{tc.expected || tc.output || "None"}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: EDITOR AND TERMINAL */}
        <div className={styles.rightPane}>
          <div className={styles.editorSection}>
            <div className={styles.paneHeader}>
              <div className={styles.tabGroup}>
                <div className={`${styles.tab} ${styles.activeTab}`}>🐍 Python 3</div>
              </div>
              <div className={styles.editorActions}>
                {/* Potentially reset button or others */}
              </div>
            </div>
            <div className={styles.editorWrapper}>
              <textarea
                className={styles.codeEditor}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="# Write your logic here..."
                spellCheck={false}
                autoComplete="off"
              />
              <div className={styles.lineNumbers}>
                {code.split('\n').map((_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.terminalSection}>
            <div className={styles.paneHeader}>
              <div className={styles.tabGroup}>
                <button 
                  className={`${styles.tab} ${terminalTab === 'output' ? styles.activeTab : ''}`}
                  onClick={() => setTerminalTab('output')}
                >
                  📟 Console
                </button>
                {testCases.length > 0 && (
                  <button 
                    className={`${styles.tab} ${terminalTab === 'testcase_details' ? styles.activeTab : ''}`}
                    onClick={() => setTerminalTab('testcase_details')}
                  >
                    🧪 Testcases
                  </button>
                )}
              </div>
            </div>
            <div className={styles.terminalContent}>
              <AnimatePresence mode="wait">
                {terminalTab === 'output' ? (
                  <motion.div 
                    key="output"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={styles.outputArea}
                  >
                    {output ? (
                      <pre className={output.includes('ERROR') || output.includes('❌') ? styles.errorOutput : styles.successOutput}>
                        {output}
                      </pre>
                    ) : (
                      <div className={styles.emptyOutput}>Run your code to see the output here.</div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="testcases"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={styles.testcaseArea}
                  >
                    {testResults && testResults.length > 0 && (
                      <div className={styles.testSummary}>
                        <span className={styles.summaryLabel}>Test Result:</span>
                        <span className={testResults.every(r => r.passed) ? styles.allPassed : styles.someFailed}>
                          {testResults.filter(r => r.passed).length} / {testResults.length} Case(s) Passed
                        </span>
                      </div>
                    )}
                    {testCases.map((tc: any, i: number) => {
                      const result = testResults?.[i];
                      const isPassed = result?.passed;
                      const hasRun = !!result;

                      return (
                        <div key={i} className={`${styles.testcaseRow} ${hasRun ? (isPassed ? styles.passedRow : styles.failedRow) : ''}`}>
                          <div className={styles.testcaseHeader}>
                            <div className={styles.testcaseLabel}>Case {i + 1}</div>
                            {hasRun && (
                              <span className={isPassed ? styles.passBadge : styles.failBadge}>
                                {isPassed ? '✓ PASSED' : '✗ FAILED'}
                              </span>
                            )}
                          </div>
                          <div className={styles.testcaseData}>
                            <div className={styles.dataItem}>
                              <span className={styles.dataLabel}>IN:</span>
                              <code>{tc.input || "None"}</code>
                            </div>
                            <div className={styles.dataItem}>
                              <span className={styles.dataLabel}>EXP:</span>
                              <code>{tc.expected || tc.output || "(Empty Output)"}</code>
                            </div>
                            {hasRun && (
                              <div className={styles.dataItem}>
                                <span className={styles.dataLabel}>ACT:</span>
                                <code style={{ color: isPassed ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                  {result.actual || result.error || "(No Output)"}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className={styles.terminalFooter}>
              <div className={styles.statusIndicator}>
                <div className={pyLoading ? styles.statusPulse : styles.statusReady} />
                <span>{pyLoading ? 'EXECUTING...' : 'READY'}</span>
              </div>
              <div className={styles.buttonGroup}>
                <button 
                  className={styles.runBtn} 
                  onClick={onRun}
                  disabled={pyLoading}
                >
                  ▶ Run
                </button>
                <button 
                  className={styles.submitBtn} 
                  onClick={onSubmit}
                  disabled={pyLoading || (currentRound === 4 && isRound4Passed)}
                >
                  🚀 Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
