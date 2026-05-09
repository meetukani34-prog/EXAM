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
    status_map = {(s["student_id"], s["exam_name"]): s for s in (statuses.data or [])}

    # Fetch student profiles
    students = db.table("students").select("id, usn, name, branch").execute()
    student_map = {s["id"]: s for s in (students.data or [])}

    # --- FALLBACK LOGIC: Map questions to exams ---
    all_question_ids = []
    for r in (results.data or []):
        ans = r.get("answers") or {}
        if ans:
            all_question_ids.extend(list(ans.keys()))
    
    q_map = {}
    if all_question_ids:
        unique_q_ids = list(set(all_question_ids))
        # Limit batch size to 500 for safety
        qs = db.table("questions").select("id, exam_name").in_("id", unique_q_ids[:500]).execute()
        q_map = {q["id"]: q["exam_name"] for q in (qs.data or [])}
    # -----------------------------------------------

    entries: list[LeaderboardEntry] = []

    for r in (results.data or []):
        sid = r["student_id"]
        student = student_map.get(sid)
        if not student:
            continue

        # Resolve exam name: 1. Column, 2. Inference, 3. Default
        ename = r.get("exam_name")
        if not ename:
            ans = r.get("answers") or {}
            for qid in ans.keys():
                if qid in q_map:
                    ename = q_map[qid]
                    break
        ename = ename or "Initial Assessment"

        # Match status for THIS specific student + exam session
        exam_status = status_map.get((sid, ename), {})
        
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

    # Sort: highest score first, then fastest time first
    entries.sort(
        key=lambda e: (-e.score, e.time_taken_seconds if e.time_taken_seconds is not None else 999999)
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
