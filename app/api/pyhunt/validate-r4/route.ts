import { NextRequest, NextResponse } from 'next/server';

const XAI_API_KEY = process.env.XAI_API_KEY || "";
const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const { studentCode, problemPrompt, expectedOutput } = await req.json();

    if (!studentCode || !problemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a strict Python code examiner for a coding competition. Your job is to evaluate student-submitted Python code against a problem statement.

RULES:
1. NEVER reveal the correct code, solution, or any part of the expected answer.
2. NEVER write or suggest code fixes. Do NOT show corrected code.
3. Check these aspects STRICTLY:
   - Correctness: Does the code solve the problem as described?
   - Logic: Is the algorithm/logic correct?
   - Indentation: Is Python indentation proper? (tabs vs spaces, nesting)
   - Syntax: Are there any syntax errors?
   - Output format: Does the output match what's expected?
4. Respond ONLY in this JSON format:
{
  "passed": true/false,
  "feedback": "Brief error description without revealing the answer. Max 2 sentences."
}
5. If the code is correct and produces the right output, set "passed" to true.
6. If there's ANY error (logic, indentation, syntax, wrong output), set "passed" to false and describe the TYPE of error without giving away the solution.
7. Be STRICT — partial solutions or wrong formatting should fail.`;

    const userPrompt = `Problem Statement:
${problemPrompt}

${expectedOutput ? `Expected Output Pattern: ${expectedOutput}` : ''}

Student's Submitted Code:
\`\`\`python
${studentCode}
\`\`\`

Evaluate this code strictly. Does it correctly solve the problem? Check logic, indentation, syntax, and output format. Respond ONLY in JSON format.`;

    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI Validator] API error:', response.status, errText);
      return NextResponse.json(
        { error: "AI validation service unavailable", passed: false, feedback: "Validation engine offline. Please retry." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || '';

    // Parse the AI's JSON response
    let result = { passed: false, feedback: "Unable to parse validation result." };
    try {
      // Extract JSON from possible markdown code blocks
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('[AI Validator] JSON parse error:', parseErr, 'Raw:', aiMessage);
      // If AI returned text but not JSON, treat as failure with the text as feedback
      result = {
        passed: false,
        feedback: aiMessage.substring(0, 200) || "Code validation encountered an error."
      };
    }

    // Safety: ensure feedback never contains actual code solutions
    if (result.feedback) {
      result.feedback = result.feedback
        .replace(/```[\s\S]*?```/g, '[code removed]')
        .replace(/def\s+\w+\s*\(/g, '[code removed]')
        .replace(/print\s*\(.*\)/g, '[code removed]');
    }

    return NextResponse.json({
      passed: result.passed === true,
      feedback: result.feedback || (result.passed ? "Code validated successfully." : "Code has errors."),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AI Validator] Server error:', message);
    return NextResponse.json(
      { error: "Internal validation error", passed: false, feedback: "System error during validation." },
      { status: 500 }
    );
  }
}
