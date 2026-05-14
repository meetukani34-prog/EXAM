
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

  // If both are empty, it's a pass (nothing expected, nothing given)
  if (expectedTokens.length === 0 && userTokens.length === 0) return true;
  
  // If admin didn't provide any expected output, but user produced something, it's a failure (missing target)
  if (expectedTokens.length === 0 && userTokens.length > 0) return false;
  
  if (userTokens.length === 0) return false;

  // Exact token list match
  if (userTokens.length === expectedTokens.length && userTokens.every((t, i) => t === expectedTokens[i])) {
    return true;
  }

  // Smart check: Does any part of the output contain the joined expected tokens?
  // This helps when students print "Output: Result" instead of just "Result"
  const userFlat = userTokens.join(' ');
  const expectedFlat = expectedTokens.join(' ');
  
  // Also check individual lines for exact matches of the expected flat string
  const userLines = stdout.toLowerCase().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (const line of userLines) {
    if (line === expectedFlat || line.endsWith(` ${expectedFlat}`) || line.startsWith(`${expectedFlat} `)) {
      return true;
    }
  }

  return userFlat.includes(expectedFlat);
};
