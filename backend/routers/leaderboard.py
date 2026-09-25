"""
Leaderboard Router
Returns student rankings sorted by: score DESC, time_taken ASC (dual-logic: accuracy + velocity).
"""

from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from models.schemas import LeaderboardEntry, LeaderboardResponse
from db.supabase_client import get_supabase
from routers.admin import verify_admin

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


def _compute_leaderboard() -> LeaderboardResponse:
    db = get_supabase()

    # Fetch all submitted results
    # We now use the exam_name column directly from exam_results
    results = (
        db.table("exam_results")
        .select("student_id, exam_name, score, total_marks, submitted_at, answers")
        .execute()
    )

    # Fetch all exam statuses to match sessions
    statuses = (
        db.table("exam_status")
        .select("student_id, exam_name, started_at, status")
        .execute()
    )
    # Map statuses by (student_id, exam_name)
    status_map = {(s["student_id"], s["exam_name"]): s for s in (statuses.data or [])}

    # Fetch student profiles
    students = db.table("students").select("id, usn, name, branch").execute()
    student_map = {s["id"]: s for s in (students.data or [])}

    entries: list[LeaderboardEntry] = []

    for r in (results.data or []):
        sid = r["student_id"]
        ename = r.get("exam_name") or "Initial Assessment"
        student = student_map.get(sid)
        if not student:
            continue

        # Match status for THIS specific student + exam session
        exam_status = status_map.get((sid, ename), {})
        
        # If no explicit session status found, we still check the result
        # but velocity might be missing.
        
        score = r.get("score") or 0
        total_marks = r.get("total_marks") or 0
        pct = round(score / total_marks * 100, 1) if total_marks else 0.0

        # Calculate velocity (time taken)
        time_taken: int | None = None
        start_time = exam_status.get("started_at")
        end_time = r.get("submitted_at")
        
        if start_time and end_time:
            try:
                t_start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                t_end = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                time_taken = int((t_end - t_start).total_seconds())
            except Exception:
                pass

        entries.append(
            LeaderboardEntry(
                rank=0,  # assigned below
                student_id=sid,
                usn=student.get("usn", ""),
                name=student.get("name", ""),
                branch=student.get("branch", student.get("branch", "CS")),
                score=score,
                total_marks=total_marks,
                percentage=pct,
                time_taken_seconds=time_taken,
                submitted_at=end_time,
                exam_name=ename
            )
        )

    # ── PyHunt (Odyssey) Integration ──
    # Include students currently participating in PyHunt even if not 'submitted'
    odyssey = db.table("odyssey_progress").select("*").execute()
    for p in (odyssey.data or []):
        sid = p["student_id"]
        # Skip if already added via exam_results (though PyHunt usually uses odyssey_progress)
        if any(e.student_id == sid and e.exam_name == "PyHunt" for e in entries):
            continue
            
        student = student_map.get(sid)
        if not student:
            continue
            
        current_round = p.get("current_round") or 1
        # Rounds completed = current_round - 1 (since current_round is the round they are ON)
        rounds_comp = current_round - 1
        
        # Match session status for time
        exam_status = status_map.get((sid, "PyHunt"), {})
        start_time = exam_status.get("started_at")
        # Use last_ping as the current 'finish line' for live leaderboard ranking
        end_time = p.get("last_ping")
        
        time_taken = None
        if start_time and end_time:
            try:
                t_start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                t_end = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                time_taken = int((t_end - t_start).total_seconds())
            except Exception:
                pass
                
        entries.append(
            LeaderboardEntry(
                rank=0,
                student_id=sid,
                usn=student.get("usn", ""),
                name=student.get("name", ""),
                branch=student.get("branch", "CS"),
                score=rounds_comp,
                total_marks=5, # Total PyHunt rounds
                percentage=round(rounds_comp / 5 * 100, 1),
                time_taken_seconds=time_taken,
                submitted_at=end_time,
                exam_name="PyHunt"
            )
        )

    # Sort: Highest accuracy/progress first, then fastest time taken first
    # Using percentage instead of raw score to normalize between PyHunt (5 pts) and Quizzes (100 pts)
    entries.sort(
        key=lambda e: (-e.percentage, e.time_taken_seconds if e.time_taken_seconds is not None else 9999999)
    )

    # Assign ranks
    for i, entry in enumerate(entries):
        entry.rank = i + 1

    return LeaderboardResponse(
        entries=entries,
        total_submitted=len(entries),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard():
    """Public leaderboard — shows submitted students ranked by score + speed."""
    return _compute_leaderboard()


@router.get("/admin", response_model=LeaderboardResponse)
async def get_admin_leaderboard(_: bool = Depends(verify_admin)):
    """Admin-authenticated leaderboard with full details."""
    return _compute_leaderboard()
