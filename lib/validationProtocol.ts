/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
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
