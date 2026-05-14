
export const normalizeTokens = (input: string) => {
  if (!input) return [];
  return input
    .toLowerCase()
    .split(/[\n,]+/)           // split on newlines and commas
    .map(t => t.trim())         // trim whitespace
    .filter(t => t.length > 0); // remove empties
};

export const validateOutput = (stdout: string, expectedRaw: string) => {
  const userTokens = normalizeTokens(stdout);
  const expectedTokens = normalizeTokens(expectedRaw);

  // Normalize full strings for flexible checking
  const capturedOutput = (stdout || "").toLowerCase().trim();
  const targetOutput = (expectedRaw || "").toLowerCase().trim();

  // If both are empty, it's a pass (nothing expected, nothing given)
  if (targetOutput.length === 0 && capturedOutput.length === 0) return true;
  
  // If admin didn't provide any expected output, but user produced something, it's a failure (missing target)
  // EXCEPT if the problem description implies any output is fine (not handled here yet)
  if (targetOutput.length === 0 && capturedOutput.length > 0) return false;
  
  if (capturedOutput.length === 0) return false;

  // Flexible Check (Recommended): 
  // If the expected output exists anywhere inside the captured output, it's a PASS.
  // This allows students to print "Output: PYTHON" or "The result is 123"
  if (capturedOutput.includes(targetOutput)) {
    return true;
  }

  // Token-based fallback (for multi-line or comma-separated lists)
  if (userTokens.length > 0 && expectedTokens.length > 0) {
    const userFlat = userTokens.join(' ');
    const expectedFlat = expectedTokens.join(' ');
    if (userFlat.includes(expectedFlat)) return true;
  }

  return false;
};
