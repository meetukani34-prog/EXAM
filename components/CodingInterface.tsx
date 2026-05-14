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
    starter_code?: string;
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
    executionTimeMs?: number;
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
  const [activeTerminalTab, setActiveTerminalTab] = useState<'console' | 'testcases'>('console');
  const [selectedCase, setSelectedCase] = useState(0);

  const hasRun = testResults && testResults.length > 0;
  const allPassed = hasRun && testResults.every(r => r.passed);
  const passedCount = hasRun ? testResults.filter(r => r.passed).length : 0;
  const totalTime = hasRun ? testResults.reduce((acc, r) => acc + (r.executionTimeMs || 0), 0) : 0;

  // --- Starter Code (Nomenclature-Locked Lines) ---
  const starterCode = problem.starter_code || '';
  const lockedLineCount = starterCode ? starterCode.split('\n').length : 0;

  // Protect immutable starter code prefix
  const handleCodeChange = (newValue: string) => {
    if (starterCode && !newValue.startsWith(starterCode)) {
      // Student tried to edit the locked lines — reject the edit
      return;
    }
    setCode(newValue);
  };

  // Parse test cases if available
  let testCases: any[] = [];
  try {
    if (problem.test_cases) {
      const parsed = JSON.parse(problem.test_cases);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && parsed[0].test_cases && Array.isArray(parsed[0].test_cases)) {
          testCases = parsed[0].test_cases;
        } else {
          testCases = parsed;
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse test cases:", e);
  }

  return (
    <div className={styles.container}>
      <div className={styles.splitPane}>
        {/* LEFT: PROBLEM DESCRIPTION */}
        <div className={styles.leftPane}>
          <div className={styles.paneHeader}>
            <div className={styles.tabGroup}>
              <div className={`${styles.tab} ${styles.activeTab}`}>📜 Description</div>
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
                      <span>Output:</span> <code>{tc.expected || tc.output || tc.expected_output || "None"}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Protocol Guidance — Luminous Protocol Note */}
            <div className={styles.protocolNote}>
              <div className={styles.protocolIcon}>⚡</div>
              <div className={styles.protocolContent}>
                <div className={styles.protocolTitle}>PROTOCOL NOTE</div>
                <p>Use <code>input()</code> to read the test value. Print only the final result.</p>
                <div className={styles.protocolExample}>
                  <code>val = input()</code><br/>
                  <code>print(your_result)</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: EDITOR AND TERMINAL */}
        <div className={styles.rightPane}>
          <div className={styles.editorSection}>
            <div className={styles.paneHeader}>
              <div className={styles.tabGroup}>
                <div className={`${styles.tab} ${styles.activeTab}`}>🐍 Python 3</div>
              </div>
            </div>
            <div className={styles.editorWrapper}>
              <textarea
                className={styles.codeEditor}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="# Write your logic here..."
                spellCheck={false}
                autoComplete="off"
              />
              <div className={styles.lineNumbers}>
                {code.split('\n').map((_, i) => (
                  <span key={i} className={i < lockedLineCount ? styles.lockedLine : ''}>
                    {i < lockedLineCount ? '🔒' : i + 1}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.terminalSection}>
            <div className={styles.paneHeader}>
              <div className={styles.tabGroup}>
                <button 
                  className={`${styles.tab} ${activeTerminalTab === 'console' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTerminalTab('console')}
                >
                  📟 Console
                </button>
                {testCases.length > 0 && (
                  <button 
                    className={`${styles.tab} ${activeTerminalTab === 'testcases' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTerminalTab('testcases')}
                  >
                    🧪 Testcases
                  </button>
                )}
              </div>

              {/* Overall Status Badge in header */}
              {hasRun && (
                <div className={`${styles.overallBadge} ${allPassed ? styles.overallPassed : styles.overallFailed}`}>
                  {allPassed ? '✓ Accepted' : `✗ ${passedCount}/${testResults.length} Passed`}
                  {totalTime > 0 && <span className={styles.timeBadge}>{totalTime}ms</span>}
                </div>
              )}
            </div>
            <div className={styles.terminalContent}>
              <AnimatePresence mode="wait">
                {activeTerminalTab === 'console' ? (
                  <motion.div 
                    key="console"
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
                    <div className={styles.caseTabsWrapper}>
                      <div className={styles.caseTabs}>
                        {testCases.map((_: any, i: number) => {
                          const passed = testResults?.[i]?.passed;
                          const hasResult = testResults?.[i] !== undefined;
                          return (
                            <button 
                              key={i}
                              onClick={() => setSelectedCase(i)}
                              className={`${styles.caseTab} ${selectedCase === i ? styles.caseTabActive : ''}`}
                            >
                              {hasResult && <span className={styles.caseStatusDot} style={{ background: passed ? '#10b981' : '#ef4444' }} />}
                              Case {i + 1}
                              {hasResult && testResults[i].executionTimeMs !== undefined && (
                                <span className={styles.caseTiming}>{testResults[i].executionTimeMs}ms</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className={styles.caseContent}>
                      <div className={styles.dataBlock}>
                        <div className={styles.dataLabel}>Input</div>
                        <code className={styles.dataValue}>{testCases[selectedCase]?.input || "None"}</code>
                      </div>
                      <div className={styles.dataBlock}>
                        <div className={styles.dataLabel}>Expected Output</div>
                        <code className={styles.dataValue}>{testCases[selectedCase]?.expected || testCases[selectedCase]?.output || testCases[selectedCase]?.expected_output || "(Empty Output)"}</code>
                      </div>
                      {hasRun && testResults?.[selectedCase] && (
                        <div className={styles.dataBlock}>
                          <div className={styles.dataLabel}>
                            Actual Output
                            {testResults[selectedCase].passed 
                              ? <span className={styles.inlinePass}> ✓ MATCH</span>
                              : <span className={styles.inlineFail}> ✗ MISMATCH</span>
                            }
                          </div>
                          <code className={`${styles.dataValue} ${testResults[selectedCase].passed ? styles.statusAccepted : styles.statusFailed}`}>
                            {testResults[selectedCase].error 
                              ? `Error: ${testResults[selectedCase].error}`
                              : testResults[selectedCase].actual || "(No Output)"
                            }
                          </code>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className={styles.terminalFooter}>
              <div className={styles.statusIndicator}>
                {pyLoading ? (
                  <>
                    <div className={styles.statusPulse} />
                    <span>EXECUTING...</span>
                  </>
                ) : (
                  <>
                    <div className={styles.statusReady} />
                    <span>READY</span>
                  </>
                )}
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
