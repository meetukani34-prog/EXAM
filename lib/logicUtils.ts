/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ATMOSPHERIC TOLERANCE FILTER — Validation Logic Engine     ║
 * ║  Flexible Drift Check with Regex-powered semantic isolation ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Strategy:
 *   Strict Alignment  → capturedOutput === expected  (high friction)
 *   Flexible Drift    → Regex isolation of core semantic result
 *   Token Fallback    → Normalized token comparison for lists/multiline
 *
 * The filter cascades through 4 stages before declaring failure.
 */

// ─── Token Normalizer ────────────────────────────────────────
export const normalizeTokens = (input: string) => {
  if (!input) return [];
  return input
    .toLowerCase()
    .split(/[\n,]+/)           // split on newlines and commas
    .map(t => t.trim())         // trim whitespace
    .filter(t => t.length > 0); // remove empties
};

// ─── Regex-based Semantic Result Isolator ──────────────────────
// Strips common student labels like "Output:", "Result:", "Answer:"
// to extract the pure semantic value for comparison.
const isolateSemanticResult = (raw: string): string => {
  if (!raw) return "";
  
  // Remove common prefixes students add
  const cleaned = raw
    .replace(/^(output|result|answer|the\s+result\s+is|the\s+answer\s+is)\s*[:=>\-]\s*/gim, '')
    .trim();
  
  // If the cleaning removed everything, return the original
  return cleaned.length > 0 ? cleaned : raw.trim();
};

// ─── Extract last meaningful line ──────────────────────────────
// Students often print debug info; the last non-empty line is usually the answer
const extractLastLine = (raw: string): string => {
  if (!raw) return "";
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.length > 0 ? lines[lines.length - 1] : "";
};

// ─── Main Validation Pipeline ──────────────────────────────────
export const validateOutput = (stdout: string, expectedRaw: string): boolean => {
  const capturedOutput = (stdout || "").trim();
  const targetOutput = (expectedRaw || "").trim();

  // ── Stage 0: Empty Checks ──
  // Both empty = pass (e.g., empty input producing empty output)
  if (targetOutput.length === 0 && capturedOutput.length === 0) return true;
  // Admin didn't set expected output → fail (misconfigured test case)
  if (targetOutput.length === 0 && capturedOutput.length > 0) return false;
  // Student produced nothing but something was expected → fail
  if (capturedOutput.length === 0) return false;

  // Case-insensitive versions for comparison
  const capturedLower = capturedOutput.toLowerCase();
  const targetLower = targetOutput.toLowerCase();

  // ── Stage 1: Strict Alignment ──
  // Direct match (fastest path, zero friction)
  if (capturedLower === targetLower) return true;

  // ── Stage 2: Flexible Drift Check ──
  // If the expected output exists anywhere inside the captured output
  // Handles: "Output: PYTHON" contains "PYTHON" → PASS
  if (capturedLower.includes(targetLower)) return true;

  // Also check if captured output ends with the expected value
  // Handles: "The result is PYTHON" endsWith "PYTHON" → PASS
  if (capturedLower.endsWith(targetLower)) return true;

  // ── Stage 3: Regex Semantic Isolation ──
  // Strip labels from student output and compare
  const semanticResult = isolateSemanticResult(capturedOutput).toLowerCase();
  if (semanticResult === targetLower) return true;
  if (semanticResult.includes(targetLower)) return true;

  // Extract last line (most likely the actual answer)
  const lastLine = extractLastLine(capturedOutput).toLowerCase();
  const lastLineClean = isolateSemanticResult(lastLine);
  if (lastLineClean === targetLower) return true;

  // ── Stage 4: Token-based Fallback ──
  // For multi-line or comma-separated expected outputs
  const userTokens = normalizeTokens(capturedOutput);
  const expectedTokens = normalizeTokens(targetOutput);

  if (userTokens.length > 0 && expectedTokens.length > 0) {
    const userFlat = userTokens.join(' ');
    const expectedFlat = expectedTokens.join(' ');
    if (userFlat.includes(expectedFlat)) return true;

    // Check if all expected tokens exist in user output (order-independent)
    const allTokensPresent = expectedTokens.every(et => 
      userTokens.some(ut => ut === et || ut.includes(et))
    );
    if (allTokensPresent && expectedTokens.length >= 2) return true;
  }

  // ── All stages failed ──
  return false;
};

// ─── Strict-Only Validator (for admin preview/testing) ─────────
export const validateOutputStrict = (stdout: string, expectedRaw: string): boolean => {
  const capturedOutput = (stdout || "").trim().toLowerCase();
  const targetOutput = (expectedRaw || "").trim().toLowerCase();
  if (targetOutput.length === 0 && capturedOutput.length === 0) return true;
  return capturedOutput === targetOutput;
};
