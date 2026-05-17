// react-doctor-disable react-doctor/no-unknown-property, react-doctor/many-boolean-props, react-doctor/no-giant-component, react-doctor/no-inline-exhaustive-style
"use client";

import React, { useState } from 'react';
import styles from './CodingInterface.module.css';
import { LazyMotion, m, AnimatePresence, domAnimation } from 'framer-motion';
import Image from 'next/image';
import CognitiveBeacon from './CognitiveBeacon';


interface CodingInterfaceProps {
  problem: {
    prompt: string;
    imageUrl?: string;
    test_cases?: string;
    target_output?: string;
    starter_code?: string;
    starter_code_c?: string;
    starter_code_cpp?: string;
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
  hint?: string;
  isHintRevealed?: boolean;
  onRevealHint?: () => void;
  isCompiling?: boolean;
  showSuccessRipple?: boolean;
  selectedLanguage: "python" | "c" | "cpp";
  onLanguageChange: (lang: "python" | "c" | "cpp") => void;
}


// react-doctor-disable-next-line react-doctor/no-giant-component, react-doctor/prefer-useReducer, react-doctor/no-many-boolean-props
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
  testResults,
  hint,
  isHintRevealed = false,
  onRevealHint,
  isCompiling = false,
  showSuccessRipple = false,
  selectedLanguage,
  onLanguageChange
}: CodingInterfaceProps) {

  const [activeTerminalTab, setActiveTerminalTab] = useState<'console' | 'testcases'>('console');
  const [selectedCase, setSelectedCase] = useState(0);

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return "None";
    
    // If it's already an object/array, stringify it
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val, null, 2);
      } catch (e) {
        return "[Complex Data]";
      }
    }

    const str = val.toString().trim();
    try {
      // If it's a JSON-like string, try to parse and prettify
      if ((str.startsWith('[') && str.endsWith(']')) || (str.startsWith('{') && str.endsWith('}'))) {
        return JSON.stringify(JSON.parse(str), null, 2);
      }
    } catch (e) {}
    return str;
  };


  const hasRun = testResults && testResults.length > 0;
  const allPassed = hasRun && testResults.every(r => r.passed);
  const passedCount = hasRun ? testResults.filter(r => r.passed).length : 0;
  const totalTime = hasRun ? testResults.reduce((acc, r) => acc + (r.executionTimeMs || 0), 0) : 0;

  // --- Starter Code (Nomenclature-Locked Lines) ---
  const starterCode = selectedLanguage === 'python'
    ? (problem.starter_code || '')
    : selectedLanguage === 'c'
    ? (problem.starter_code_c || '')
    : (problem.starter_code_cpp || '');
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
      let parsed = problem.test_cases;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && (parsed[0] as any).test_cases && Array.isArray((parsed[0] as any).test_cases)) {
          testCases = (parsed[0] as any).test_cases;
        } else {
          testCases = parsed;
        }
      } else if (parsed && typeof parsed === 'object' && (parsed as any).test_cases) {
        testCases = (parsed as any).test_cases;
      }

      // Normalize string-only test cases
      if (Array.isArray(testCases)) {
        testCases = testCases.map(tc => {
          if (typeof tc === 'string') {
            return { input: tc, expected: tc }; 
          }
          return tc;
        });
      }
    }
  } catch (e) {
    console.error("Failed to parse test cases:", e);
  }

  return (
    <LazyMotion features={domAnimation}>
    <m.div 
      className={styles.container}
      animate={showSuccessRipple ? { boxShadow: [
        "0 0 0px rgba(0,255,0,0)", 
        "0 0 40px rgba(0,255,0,0.8)", 
        "0 0 0px rgba(0,255,0,0)"
      ]} : {}}
      transition={{ duration: 1, ease: "easeInOut" }}
    >
      
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
                <Image src={problem.imageUrl} alt="Problem Visualization" className={styles.problemImage} width={600} height={400} style={{ objectFit: 'contain' }} />
              </div>
            )}
            <div className={styles.promptText}>
              {problem.prompt}
            </div>
            {testCases.length > 0 && (
              <div className={styles.examplesSection}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 4, height: 16, background: 'var(--accent)', borderRadius: 2 }} />
                  <h4 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Examples & Patterns</h4>
                </div>
                {testCases.slice(0, 2).map((tc: any, i: number) => (
                    /* react-doctor-disable-next-line react-doctor/no-array-index-as-key */
                    <div key={`example-${i}`} className={styles.exampleBox}>
                      <div className={styles.exampleHeader}>
                        <span className={styles.exampleTitle}>EXAMPLE 0{i + 1}</span>
                      </div>
                      <div className={styles.exampleGrid}>
                        <div className={styles.exampleRow}>
                          <span className={styles.exampleLabel}>INPUT</span>
                          <code className={styles.exampleCode}>{formatValue(tc.input)}</code>
                        </div>
                        <div className={styles.exampleRow}>
                          <span className={styles.exampleLabel}>EXPECTED</span>
                          <code className={styles.exampleCode}>
                            {formatValue(
                              tc.expected || 
                              tc.output || 
                              tc.expected_output ||
                              tc.expected_calculations ||
                              tc.expected_status ||
                              tc.target_output
                            )}
                          </code>
                        </div>
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
                {selectedLanguage === 'python' && (
                  <>
                    <p>Use <code>input()</code> to read the test value. Print only the final result.</p>
                    <div className={styles.protocolExample}>
                      <code>val = input()</code><br/>
                      <code>print(your_result)</code>
                    </div>
                  </>
                )}
                {selectedLanguage === 'c' && (
                  <>
                    <p>Use standard input functions like <code>scanf</code> or <code>fgets</code>. Print only the final result.</p>
                    <div className={styles.protocolExample}>
                      <code>char str[100];</code><br/>
                      <code>scanf("%s", str);</code><br/>
                      <code>printf("%s\n", your_result);</code>
                    </div>
                  </>
                )}
                {selectedLanguage === 'cpp' && (
                  <>
                    <p>Use standard input stream <code>cin</code>. Print only the final result.</p>
                    <div className={styles.protocolExample}>
                      <code>string str;</code><br/>
                      <code>cin &gt;&gt; str;</code><br/>
                      <code>cout &lt;&lt; your_result &lt;&lt; endl;</code>
                    </div>
                  </>
                )}
              </div>
            </div>

            {hint && (
              <CognitiveBeacon 
                hint={hint} 
                isRevealed={isHintRevealed} 
                onReveal={onRevealHint || (() => {})} 
              />
            )}
          </div>
        </div>


        {/* RIGHT: EDITOR AND TERMINAL */}
        <div className={styles.rightPane}>
          <div className={styles.editorSection}>
            <div className={styles.paneHeader}>
              <div className={styles.tabGroup} style={{ display: 'flex', gap: 4 }}>
                {(['python', 'c', 'cpp'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => onLanguageChange(lang)}
                    className={`${styles.tab} ${selectedLanguage === lang ? styles.activeTab : ''}`}
                    /* react-doctor-disable-next-line react-doctor/no-inline-exhaustive-style */
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: selectedLanguage === lang ? 700 : 500,
                      transition: 'opacity 0.2s ease, color 0.2s ease',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {lang === 'python' ? '🐍 Python 3' : lang === 'c' ? '🇨 C (GCC)' : '➕ C++ (G++)'}
                  </button>
                ))}
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
                  /* react-doctor-disable-next-line react-doctor/no-array-index-as-key */
                  <span key={`line-${i}`} className={i < lockedLineCount ? styles.lockedLine : ''}>
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
                  <m.div 
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
                  </m.div>
                ) : (
                  <m.div 
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
                            /* react-doctor-disable-next-line react-doctor/no-array-index-as-key */
                            <button 
                              key={`case-${i}`}
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
                        <code className={styles.dataValue}>{formatValue(testCases[selectedCase]?.input)}</code>
                      </div>
                      <div className={styles.dataBlock}>
                        <div className={styles.dataLabel}>Expected Output</div>
                        <code className={styles.dataValue}>
                          {formatValue(
                            testCases[selectedCase]?.expected || 
                            testCases[selectedCase]?.output || 
                            testCases[selectedCase]?.expected_output ||
                            testCases[selectedCase]?.expected_calculations ||
                            testCases[selectedCase]?.expected_status ||
                            testCases[selectedCase]?.target_output
                          )}
                        </code>
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
                              : formatValue(testResults[selectedCase].actual)
                            }
                          </code>
                        </div>
                      )}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className={styles.terminalFooter}>
              <div className={styles.statusIndicator}>
                {pyLoading ? (
                  <>
                    <div className={styles.statusPulse} />
                    <span>EXECUTING…</span>
                  </>
                ) : (
                  <>
                    <div className={styles.statusReady} />
                    <span>READY</span>
                  </>
                )}
              </div>
              <div className={styles.buttonGroup}>
                <m.button 
                  className={styles.runBtn} 
                  onClick={onRun}
                  disabled={pyLoading}
                  animate={isCompiling ? { 
                    scale: [1, 0.95, 1],
                    boxShadow: ["0 0 0px rgba(0,242,255,0)", "0 0 20px rgba(0,242,255,0.6)", "0 0 0px rgba(0,242,255,0)"]
                  } : {}}
                  transition={isCompiling ? { repeat: Infinity, duration: 1.5 } : {}}
                >
                  {isCompiling ? "⚛️ Syncing\u2026" : selectedLanguage === 'python' ? "▶ Run Python (Pyodide)" : "▶ Run WASM Compiler"}
                </m.button>
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
    </m.div>
    </LazyMotion>
  );
}
