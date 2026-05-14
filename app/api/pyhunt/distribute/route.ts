import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client for atomic orbital distribution
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Dynamic Orbital Distribution Engine
 * Objective: Assign clues to 200+ concurrent users based on Finish Velocity.
 * Logic: (Rank - 1) mod TotalClues with Sequence Scrambling.
 */
export async function POST(req: Request) {
    try {
        const { studentId, roundNum, totalClues = 4 } = await req.json();

        if (!studentId || !roundNum) {
            return NextResponse.json({ 
                error: 'Crystallization Error: studentId and roundNum are required.' 
            }, { status: 400 });
        }

        console.log(`[Orbital Engine] Processing Round ${roundNum} for Student ${studentId}`);

        // 1. Persistence Ledger & Atomic Counting (The Modulo Protocol)
        // Call the server-side RPC to fetch the current completion count atomically.
        // This prevents race conditions during high-velocity bursts from 200 users.
        const { data: rank, error: rpcError } = await supabase.rpc('increment_round_completion', {
            target_student_id: studentId,
            round_num: roundNum
        });

        if (rpcError) {
            console.error('[Orbital Engine] Atomic Counting Failure:', rpcError);
            return NextResponse.json({ 
                error: 'Persistence Ledger synchronization failed.' 
            }, { status: 500 });
        }

        // 2. The Recursive Loop Formula
        // ClueIndex = (StudentRank - 1) mod TotalClues
        let clueIndex = (rank - 1) % totalClues;

        // 3. Divergent Path Strategy (Sequence Scrambling)
        // Pattern Drift: Rounds alternate their orbital direction to minimize cheating.
        // Round 1: 0-1-2-3 (Forward Orbit)
        // Round 2: 3-2-1-0 (Reverse Orbit)
        const isReverseOrbit = roundNum % 2 === 0;
        if (isReverseOrbit) {
            clueIndex = (totalClues - 1) - clueIndex;
        }

        // 4. Persistence: Update odyssey_progress with the assigned clue node
        const roundKey = `round_${roundNum}_state`;
        const { error: updateError } = await supabase
            .from('odyssey_progress')
            .update({ 
                [roundKey]: { 
                    assigned_clue_index: clueIndex, 
                    assigned_rank: rank,
                    assigned_at: new Date().toISOString() 
                },
                last_ping: new Date().toISOString()
            })
            .eq('student_id', studentId);

        if (updateError) {
            console.warn('[Orbital Engine] State Persistence Warning:', updateError);
        }

        // 5. Zero-Crash Response
        // Crystallize the specific clue node into the response.
        return NextResponse.json({
            success: true,
            rank,
            clueIndex, // Zero-latency modular index
            clueId: clueIndex + 1,
            orbitalVector: isReverseOrbit ? 'REVERSE' : 'FORWARD'
        });

    } catch (err: any) {
        console.error('[Orbital Engine] Critical Failure:', err);
        return NextResponse.json({ 
            error: 'Orbital Engine experienced a gravitational collapse.' 
        }, { status: 500 });
    }
}
