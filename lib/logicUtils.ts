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
  if (!stdout && !expectedRaw) return true;
  
  const clean = (s: string) => (s || "")
    .replace(/[\r\n\t]/g, ' ')
    .trim()
    .replace(/^["']|["']$/g, '');

  const capturedOutput = clean(stdout);
  const targetOutput = clean(expectedRaw);

  if (targetOutput.length === 0 && capturedOutput.length === 0) return true;
  if (targetOutput.length === 0 || capturedOutput.length === 0) return false;

  const capturedLower = capturedOutput.toLowerCase();
  const targetLower = targetOutput.toLowerCase();

  // 1. Direct Match
  if (capturedLower === targetLower) return true;

  // 2. Semantic Isolation (Remove common labels)
  const labels = [
    "output", "result", "answer", "final", "count", "value",
    "the answer is", "the result is", "the count is", 
    "words starting with vowels", "total", "sum"
  ];
  
  let semanticCaptured = capturedLower;
  labels.forEach(label => {
    const regex = new RegExp(`^${label}\\s*[:=>\\-]\\s*`, 'i');
    semanticCaptured = semanticCaptured.replace(regex, '').trim();
  });

  if (semanticCaptured === targetLower) return true;

  // 3. Deep Alphanumeric Match
  const normalizeDeep = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalizeDeep(semanticCaptured) === normalizeDeep(targetLower)) return true;

  // 4. Token Presence Check (Is the expected value the last word/number?)
  const tokens = capturedLower.split(/[\s,:]+/).filter(t => t.length > 0);
  if (tokens.length > 0 && tokens[tokens.length - 1] === targetLower) return true;

  return false;
};

// ─── Strict-Only Validator (for admin preview/testing) ─────────
export const validateOutputStrict = (stdout: string, expectedRaw: string): boolean => {
  const capturedOutput = (stdout || "").trim().toLowerCase();
  const targetOutput = (expectedRaw || "").trim().toLowerCase();
  if (targetOutput.length === 0 && capturedOutput.length === 0) return true;
  return capturedOutput === targetOutput;
};
