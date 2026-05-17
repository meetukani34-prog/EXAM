import { supabase } from "@/lib/supabase";

/**
 * 3. Local Resonance Validation (The Test-Runner)
 * Intercepts local WASM output, matches it with fidelity, and triggers the clue distribution protocol.
 */
export async function validateLocalExecution(
  localStdout: string, 
  expectedOutput: string,
  studentRank: number,
  totalClues: number
): Promise<{ success: boolean; clueIndex?: number; error?: string }> {
  
  // Fidelity Match: Clean the output using an automated strip mechanism
  const cleanLocal = localStdout.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
  const cleanExpected = expectedOutput.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ');

  if (cleanLocal === cleanExpected) {
    // Orbital Reward Shift: Instantly fire circular clue distribution
    // Clue_{Index} = (Student_{Rank} - 1) % Total_{Clues}
    const clueIndex = (studentRank - 1) % totalClues;
    
    // Fire serverless Supabase handshake
    try {
      const { error } = await supabase
        .from('unlocked_clues')
        .insert({ 
          clue_index: clueIndex,
          unlocked_at: new Date().toISOString()
        });

      if (error) {
        console.error("Orbital Reward Shift Failed:", error);
        return { success: true, clueIndex, error: "Validation successful, but clue sync failed." };
      }

      return { success: true, clueIndex };
    } catch (err: any) {
      return { success: true, clueIndex, error: err.message };
    }
  }
  
  return { success: false };
}
