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
  // ── Stage 0: Empty Checks ──
  // Strip non-printable characters and standardize
  const clean = (s: string) => s
    .replace(/[\r\n\t]/g, ' ')      // Standardize whitespace
    .replace(/[^\x20-\x7E]/g, '')   // Remove non-printable characters
    .trim()
    .replace(/^["']|["']$/g, '');   // Remove accidental surrounding quotes

  const capturedOutput = clean(stdout || "");
  const targetOutput = clean(expectedRaw || "");

  // Both empty = pass (e.g., empty input producing empty output)
  if (targetOutput.length === 0 && capturedOutput.length === 0) return true;
  // Admin didn't set expected output → fail (misconfigured test case)
  if (targetOutput.length === 0 && capturedOutput.length > 0) return false;
  // Student produced nothing but something was expected → fail
  if (capturedOutput.length === 0) return false;

  // Case-insensitive versions for comparison
  const capturedLower = capturedOutput.toLowerCase();
  const targetLower = targetOutput.toLowerCase();

  // ── Stage 1: Standard Normalized Match ──
  // Direct match after cleaning (handles whitespace/invisible chars)
  if (capturedLower === targetLower) return true;

  // ── Stage 2: Deep Alphanumeric Match ──
  // If they are identical after stripping ALL punctuation/whitespace
  // This handles OS differences like trailing periods or quotes in config.
  const normalizeDeepLocal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const deepCaptured = normalizeDeepLocal(capturedOutput);
  const deepTarget = normalizeDeepLocal(targetOutput);
  
  if (deepCaptured === deepTarget && deepTarget.length > 0) return true;

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
