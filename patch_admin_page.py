import re

file_path = r"c:\EXAM_new\EXAM\app\admin\page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update states
content = re.sub(
    r'const \[subCategory, setSubCategory\] = useState<"compiler" \| "mcq">.*?;',
    r'''const [subCategory, setSubCategory] = useState<"jumble" | "compiler" | "mcq">("compiler");
  const [previewChallenge, setPreviewChallenge] = useState<any>(null);
  const [previewCode, setPreviewCode] = useState("");
  const [previewOutput, setPreviewOutput] = useState("");
  const [previewTestResults, setPreviewTestResults] = useState<any[]>([]);
  const [previewLanguage, setPreviewLanguage] = useState<"python" | "c" | "cpp">("python");
  const { runCode: runPreviewCode, loading: previewLoading } = usePyodide();''',
    content
)

# 2. Add handleRunPreview function
handle_run_preview = '''const [schedulingExam, setSchedulingExam] = useState<string | null>(null);

  const handleRunPreview = async () => {
    if (!previewChallenge) return;
    setPreviewOutput("Initializing Logic...");

    let testCases: any[] = [];
    try {
      if (previewChallenge.test_cases) {
        let parsed = previewChallenge.test_cases;
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (Array.isArray(parsed)) {
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
      setPreviewOutput("ERROR: Invalid Test Cases JSON");
      return;
    }

    if (Array.isArray(testCases) && testCases.length > 0) {
      let finalResults = "";
      const results = [];
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const res: any = await runPreviewCode(previewCode, tc.input || "");
        const expected = (tc.expected || tc.output || tc.expected_output || "").toString().trim();
        const actual = (res.stdout || "").toString().trim();
        const passed = validateOutput(res.stdout, expected);

        results.push({
          input: tc.input, expected: expected, actual: actual,
          passed: passed, error: res.error
        });

        if (res.error) finalResults += `❌ CASE ${i + 1}: ERROR\\n   ${res.error}\\n`;
        else finalResults += `${passed ? '✅' : '❌'} CASE ${i + 1} ${passed ? 'PASSED' : 'FAILED'}\\n   Output: ${actual}\\n`;
      }
      setPreviewTestResults(results);
      setPreviewOutput(finalResults);
    } else {
      const res: any = await runPreviewCode(previewCode);
      setPreviewOutput(res.error ? `ERROR: ${res.error}` : res.stdout || "Success (No Output)");
    }
  };'''

content = content.replace(
    'const [schedulingExam, setSchedulingExam] = useState<string | null>(null);',
    handle_run_preview
)

# 3. Rename isCompiler to isCodingChallenge globally inside QuestionsTab
content = content.replace(
    'const isCompiler = formCategory === "programming" && formData.programming_type === "compiler";',
    'const isCodingChallenge = formCategory === "programming" && (formData.programming_type === "compiler" || formData.programming_type === "jumble");'
)
content = re.sub(r'\bisCompiler\b', 'isCodingChallenge', content)

# 4. Update the subCategory UI tabs
subcat_tabs_target = '''           <button
            onClick={() => setSubCategory('compiler')}'''

subcat_tabs_replacement = '''           <button
            onClick={() => setSubCategory('jumble')}
            style={{
              padding: '6px 16px',
              borderRadius: '99px',
              border: '1px solid var(--border)',
              background: subCategory === 'jumble' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: subCategory === 'jumble' ? '#fff' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            🧩 Code Jumble
          </button>
           <button
            onClick={() => setSubCategory('compiler')}'''

content = content.replace(subcat_tabs_target, subcat_tabs_replacement)

# 5. Update programming_type dropdown in Add Question modal
type_select_target = '''<select
                    className={adminStyles.input}
                    style={{
                      height: "44px",
                      fontSize: "15px",
                      fontWeight: "600",
                      background: "var(--bg-secondary) !important",
                      border: "1.5px solid var(--border)",
                      color: "var(--text-primary)",
                      cursor: "pointer"
                    }}
                    value={formData.programming_type || 'compiler'}
                    onChange={(e) => setFormData(prev => ({ ...prev, programming_type: e.target.value as "compiler" | "mcq" }))}
                  >
                    <option value="compiler">📁 Coding Challenges</option>
                    <option value="mcq">📝 Conceptual MCQs</option>
                  </select>'''

type_select_replacement = '''<select
                    className={adminStyles.input}
                    style={{
                      height: "44px",
                      fontSize: "15px",
                      fontWeight: "600",
                      background: "var(--bg-secondary) !important",
                      border: "1.5px solid var(--border)",
                      color: "var(--text-primary)",
                      cursor: "pointer"
                    }}
                    value={formData.programming_type || 'compiler'}
                    onChange={(e) => setFormData(prev => ({ ...prev, programming_type: e.target.value as "jumble" | "compiler" | "mcq" }))}
                  >
                    <option value="jumble">🧩 Code Jumble</option>
                    <option value="compiler">📁 Logic Building</option>
                    <option value="mcq">📝 Conceptual MCQs</option>
                  </select>'''
content = content.replace(type_select_target, type_select_replacement)

# 6. Add "Preview" button inside isCodingChallenge section
preview_button_logic = '''                  <div style={{ marginTop: 16 }}>
                    <button className="btn btn-primary" onClick={(e) => {
                      e.preventDefault();
                      setPreviewChallenge({
                        prompt: formData.text,
                        test_cases: challengeTestCases,
                        target_output: challengeTargetOutput,
                        starter_code: challengeStarterCode,
                        starter_code_c: challengeStarterCodeC,
                        starter_code_cpp: challengeStarterCodeCpp,
                        round: formData.programming_type === "jumble" ? 2 : 3
                      });
                      setPreviewLanguage(adminActiveLangTab);
                      setPreviewCode(
                        adminActiveLangTab === 'python' ? challengeStarterCode :
                        adminActiveLangTab === 'c' ? challengeStarterCodeC : challengeStarterCodeCpp
                      );
                      setPreviewOutput("");
                      setPreviewTestResults([]);
                    }}>
                      👁️ Preview Coding Challenge
                    </button>
                  </div>'''

# Inject it after the clues/testcases area. Look for 'Test Cases (JSON format)' textarea container
test_cases_target = '''<textarea
                      className={adminStyles.input}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 13, minHeight: 100, background: "rgba(0,0,0,0.3) !important", border: "1.5px solid var(--border)" }}
                      value={challengeTestCases}
                      onChange={(e) => setChallengeTestCases(e.target.value)}
                      placeholder='[{"input": "5\\n10", "expected": "15"}]'
                      rows={5}
                    />
                  </div>
                </div>'''

content = content.replace(test_cases_target, test_cases_target + "\n" + preview_button_logic)

# 7. Add Preview Modal at the very end of QuestionsTab
preview_modal_jsx = '''

      {previewChallenge && (
        <div className={adminStyles.modalOverlay} onClick={() => setPreviewChallenge(null)} onKeyDown={e => { if (e.key === 'Enter') setPreviewChallenge(null); }}  role="button" tabIndex={0}>
          <div className={adminStyles.modal} style={{ maxWidth: '90vw', width: '1200px', height: '85vh', padding: '20px', background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}  role="button" tabIndex={0}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Live IDE Preview</h3>
              <button onClick={() => setPreviewChallenge(null)} className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>✕ Close Preview</button>
            </div>
            <div style={{ height: 'calc(100% - 60px)' }}>
              <CodingInterface
                problem={previewChallenge}
                code={previewCode}
                setCode={setPreviewCode}
                output={previewOutput}
                onRun={handleRunPreview}
                onSubmit={handleRunPreview}
                pyLoading={previewLoading}
                currentRound={previewChallenge.round}
                labelConfig={{ phase: "Preview", orbit: "Test" }}
                testResults={previewTestResults}
                selectedLanguage={previewLanguage}
                onLanguageChange={(lang) => {
                  setPreviewLanguage(lang);
                  const starter = lang === 'python'
                    ? (previewChallenge.starter_code || '')
                    : lang === 'c'
                    ? (previewChallenge.starter_code_c || '')
                    : (previewChallenge.starter_code_cpp || '');
                  setPreviewCode(starter);
                }}
              />
            </div>
          </div>
        </div>
      )}'''

# Inject before the final closing div of QuestionsTab
content = re.sub(r'(\s+</div>\s+);\s+}\s*// ── Students Tab', preview_modal_jsx + r'\1; } // ── Students Tab', content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied.")
