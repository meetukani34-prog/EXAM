from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from datetime import datetime, timezone

from models.schemas import (
    QuestionsResponse, QuestionOut,
    SaveAnswerRequest, SaveAnswerResponse,
    SubmitExamRequest, SubmitExamResponse,
    StartExamResponse
)
from core.security import get_current_student
from db.supabase_client import get_supabase

router = APIRouter(prefix="/exam", tags=["exam"])
@router.get("/status")
async def get_exam_status(current: dict = Depends(get_current_student)):
    """Fetch all exam status rows for the current student."""
    db = get_supabase()
    student_id = current["student_id"]
    try:
        # Fetch status row for this student
        status_res = db.table("exam_status").select("*").eq("student_id", student_id).execute()
        # exam_results has no exam_name column — just get score/total_marks
        results_res = db.table("exam_results").select("score, total_marks").eq("student_id", student_id).limit(1).execute()
        
        status_data = status_res.data or []
        result_row = results_res.data[0] if results_res.data else None
        
        # Attach score to each status row (there's usually only one per student)
        for s in status_data:
            if result_row:
                s["last_score"] = result_row.get("score")
                s["last_total"] = result_row.get("total_marks")
        
        return status_data
    except Exception as e:
        print(f"[EXAM] Status fetch failed: {e}")
        return []

@router.post("/heartbeat")
async def heartbeat(current: dict = Depends(get_current_student)):
    """Simple authenticated ping to check if student is blocked/authorized."""
    return {"status": "ok"}



def _check_exam_active(title: str):
    """Raises 423 if the exam has been deactivated by admin."""
    db = get_supabase()
    try:
        result = db.table("exam_config").select("is_active, scheduled_start, max_attempts").eq("exam_title", title).limit(1).execute()
        if result.data:
            row = result.data[0]
            if not row.get("is_active", True):
                raise HTTPException(
                    status_code=423,
                    detail="exam_inactive",
                )
            scheduled = row.get("scheduled_start")
            if scheduled:
                start_dt = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
                if start_dt > datetime.now(timezone.utc):
                    raise HTTPException(
                        status_code=425,
                        detail=f"exam_scheduled:{scheduled}",
                    )
    except HTTPException:
        raise
    except Exception:
        pass  # If table doesn't exist yet, default to active


def update_last_active(student_id: str):
    """Background task to update student's last active timestamp."""
    db = get_supabase()
    db.table("exam_status").update(
        {"last_active": datetime.now(timezone.utc).isoformat()}
    ).eq("student_id", student_id).execute()




@router.get("/questions", response_model=QuestionsResponse)
def get_questions(
    title: str,
    background_tasks: BackgroundTasks,
    current: dict = Depends(get_current_student)
):
    """
    Return all questions for a specific exam title and branch.
    """
    _check_exam_active(title)
    db = get_supabase()

    # Update last_active in background
    background_tasks.add_task(update_last_active, current["student_id"])

    try:
        branch = current.get("branch", "CS")
        
        # ── Strategy 1: Strict Branch + Strict Title Match ──
        query = db.table("questions").select("id, text, options, branch, order_index, marks, exam_name, image_url, audio_url")
        if branch != "ALL":
            query = query.eq("branch", branch)
        
        result = query.eq("exam_name", title).order("order_index").limit(100).execute()

        # ── Strategy 2: Strict Branch + Fuzzy Title Match ──
        if not result.data:
            query = db.table("questions").select("id, text, options, branch, order_index, marks, exam_name, image_url, audio_url")
            if branch != "ALL":
                query = query.eq("branch", branch)
            result = query.ilike("exam_name", f"%{title}%").order("order_index").limit(100).execute()
            
        # ── Strategy 3: Global Title Match (Cross-Branch Fallback) ──
        if not result.data:
            result = (
                db.table("questions")
                .select("id, text, options, branch, order_index, marks, exam_name, image_url, audio_url")
                .eq("exam_name", title)
                .order("order_index")
                .limit(100)
                .execute()
            )
            
        # ── Strategy 4: Global Fuzzy Title Match ──
        if not result.data:
            result = (
                db.table("questions")
                .select("id, text, options, branch, order_index, marks, exam_name, image_url, audio_url")
                .ilike("exam_name", f"%{title}%")
                .order("order_index")
                .limit(100)
                .execute()
            )

    except Exception as e:
        print(f"[EXAM] DB Error during question fetch: {e}")
        # Return empty list instead of 500 to keep UI stable
        return QuestionsResponse(questions=[], total=0)

    questions = [
        QuestionOut(
            id=q["id"],
            text=q["text"].replace(f"⟦EXAM:{title}⟧", "").strip(),
            options=q["options"],
            branch=q.get("branch", branch),
            order_index=q["order_index"],
            marks=q["marks"],
        )
        for q in (result.data or [])
    ]

    return QuestionsResponse(questions=questions, total=len(questions))


@router.post("/save-answer", response_model=SaveAnswerResponse)
def save_answer(
    request: SaveAnswerRequest,
    background_tasks: BackgroundTasks,
    current: dict = Depends(get_current_student),
):
    """
    Upsert a single answer for (student_id, question_id).
    Also updates last_active in background. Used by auto-save every 15s.
    """
    db = get_supabase()
    student_id = current["student_id"]

    # Guard: reject if already submitted
    status_row = (
        db.table("exam_status")
        .select("status")
        .eq("student_id", student_id)
        .limit(1)
        .execute()
    )
    if status_row.data and status_row.data[0].get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Exam already submitted. Cannot save answers.",
        )

    # Fetch existing answers
    existing = (
        db.table("exam_results")
        .select("answers")
        .eq("student_id", student_id)
        .execute()
    )

    if existing.data:
        answers = existing.data[0].get("answers") or {}
        answers[request.question_id] = request.selected_option
        db.table("exam_results").update({"answers": answers}).eq(
            "student_id", student_id
        ).execute()
    else:
        db.table("exam_results").insert(
            {
                "student_id": student_id,
                "answers": {request.question_id: request.selected_option},
                "score": 0,
            }
        ).execute()

    # Update last_active in background
    background_tasks.add_task(update_last_active, student_id)

    return SaveAnswerResponse(saved=True, question_id=request.question_id)


@router.post("/submit-exam", response_model=SubmitExamResponse)
def submit_exam(
    request: SubmitExamRequest,
    current: dict = Depends(get_current_student),
):
    """
    Finalize the exam:
    1. Reject if already submitted (idempotent safety)
    2. Calculate score against correct answers
    3. Save final answers + score
    4. Mark status as submitted
    5. Clear active session
    """
    db = get_supabase()
    student_id = current["student_id"]

    # 1. Extract exam title and Guard: already submitted?
    answers = request.answers
    exam_title = answers.get("__exam_title", "General Assessment")
    
    status_row = (
        db.table("exam_status")
        .select("status")
        .eq("student_id", student_id)
        .limit(1)
        .execute()
    )
    if status_row.data and status_row.data[0].get("status") == "submitted":
        # Return existing result (exam_results has no exam_name column)
        result_row = (
            db.table("exam_results")
            .select("score, total_marks, submitted_at")
            .eq("student_id", student_id)
            .limit(1)
            .execute()
        )
        r = result_row.data[0] if result_row.data else {}
        total = r.get("total_marks", 0)
        score = r.get("score", 0)
        return SubmitExamResponse(
            submitted=True,
            score=score,
            total_marks=total,
            correct_count=r.get("correct_count", 0),
            wrong_count=r.get("wrong_count", 0),
            percentage=round(score / total * 100, 1) if total else 0,
            submitted_at=r.get("submitted_at", datetime.now(timezone.utc).isoformat()),
        )

    branch = current.get("branch", "CS")

    # Strategy 1: Strict Branch + Strict Title Match
    query = db.table("questions").select("id, correct_answer, marks")
    if branch != "ALL":
        query = query.eq("branch", branch)
    
    questions_result = query.eq("exam_name", exam_title).execute()

    # Strategy 2: Strict Branch + Fuzzy Title Match
    if not questions_result.data:
        query = db.table("questions").select("id, correct_answer, marks")
        if branch != "ALL":
            query = query.eq("branch", branch)
        questions_result = query.ilike("exam_name", f"%{exam_title}%").execute()

    # Strategy 3: Global Title Match (Cross-Branch Fallback)
    if not questions_result.data:
        questions_result = (
            db.table("questions")
            .select("id, correct_answer, marks")
            .eq("exam_name", exam_title)
            .execute()
        )
    
    # ── Scoring Configuration ──
    # Fetch global config to see if we have negative marks or a marks override
    marks_override = None
    neg_marks = 0.0
    try:
        config_res = db.table("exam_config").select("marks_per_question, negative_marks").eq("exam_title", exam_title).execute()
        if config_res.data:
            cfg = config_res.data[0]
            marks_override = cfg.get("marks_per_question")
            neg_marks = float(cfg.get("negative_marks") if cfg.get("negative_marks") is not None else 0.0)
    except Exception:
        pass

    correct_map = {
        q["id"]: (q["correct_answer"], q["marks"] if marks_override is None else marks_override)
        for q in (questions_result.data or [])
    }

    score = 0.0
    correct_count = 0
    wrong_count = 0
    total_marks = sum(m for _, m in correct_map.values())

    for q_id, selected in answers.items():
        if q_id in correct_map:
            correct_ans, marks = correct_map[q_id]
            if selected == correct_ans:
                score += marks
                correct_count += 1
            else:
                score += neg_marks  # Adding negative value (e.g. -1)
                wrong_count += 1

    # Clamp score to 0 if desired, or allow negative
    # score = max(0, score) 

    submitted_at = datetime.now(timezone.utc).isoformat()

    # 4. Upsert exam_results — student_id is UNIQUE (one row per student)
    try:
        db.table("exam_results").upsert({
            "student_id": student_id,
            "answers": answers,
            "score": score,
            "total_marks": total_marks,
            "submitted_at": submitted_at
        }, on_conflict="student_id").execute()
    except Exception as e:
        print(f"[EXAM] exam_results upsert failed: {e}")

    # 5. Mark submitted and ensure attempt is counted for THIS exam
    try:
        # Check current count to avoid double-increment
        curr_res = db.table("exam_status").select("attempts_count, id").eq("student_id", student_id).limit(1).execute()
        curr_count = 0
        record_id = None
        if curr_res.data:
            curr_count = curr_res.data[0].get("attempts_count", 0) or 0
            record_id = curr_res.data[0].get("id")
        
        final_count = curr_count if curr_count > 0 else 1
        
        update_data = {
            "exam_name": exam_title,
            "status": "submitted", 
            "submitted_at": submitted_at,
            "attempts_count": final_count
        }
        
        if record_id:
            db.table("exam_status").update(update_data).eq("id", record_id).execute()
        else:
            db.table("exam_status").insert({
                **update_data,
                "student_id": student_id,
            }).execute()
    except Exception as e:
        print(f"[EXAM] Per-exam submit failed: {e}")
        db.table("exam_status").update({
            "status": "submitted", 
            "submitted_at": submitted_at
        }).eq("student_id", student_id).execute()

    # 6. Clear active session
    db.table("students").update(
        {"is_active_session": False, "current_token": None}
    ).eq("id", student_id).execute()

    return SubmitExamResponse(
        submitted=True,
        score=score,
        total_marks=total_marks,
        correct_count=correct_count,
        wrong_count=wrong_count,
        percentage=round(score / total_marks * 100, 1) if total_marks else 0,
        submitted_at=submitted_at,
    )


@router.post("/start-exam", response_model=StartExamResponse)
async def start_exam(
    title: str,
    current: dict = Depends(get_current_student)
):
    """
    Officially starts the exam timer for the student.
    Sets status to 'active' and records 'started_at'.
    Returns the start time so the frontend can sync.
    """
    _check_exam_active(title)
    db = get_supabase()
    student_id = current["student_id"]

    # 1. Fetch config safely
    max_attempts = 1
    try:
        config_res = db.table("exam_config").select("*").eq("exam_title", title).limit(1).execute()
        if config_res.data:
            max_attempts = config_res.data[0].get("max_attempts") or 1
    except Exception: pass

    # 2. Fetch status safely for this student
    attempts_count = 0
    status_str = "not_started"
    started_at = None
    record_id = None
    try:
        # Schema: student_id is UNIQUE — one row per student
        status_res = db.table("exam_status").select("*").eq("student_id", student_id).limit(1).execute()
        if status_res.data:
            data = status_res.data[0]
            record_id = data.get("id")
            attempts_count = data.get("attempts_count", 0) or 0
            record_exam = data.get("exam_name", "")
            # Only use status/started_at from the same exam
            if record_exam == title:
                status_str = data.get("status", "not_started")
                started_at = data.get("started_at")
            else:
                # Different exam — treat as not_started for this exam
                status_str = "not_started"
                started_at = None
    except Exception: pass

    # 3. If already active for this exam, KEEP existing warnings and started_at.
    # This prevents students from resetting warnings by refreshing.
    if status_str == "active" and started_at:
        try:
            db.table("exam_status").update({
                "last_active": datetime.now(timezone.utc).isoformat()
            }).eq("id", record_id).execute()
        except Exception: pass
        return StartExamResponse(started_at=started_at, status="active")

    # 4. Block restart if already submitted for the same exam
    # This prevents bypassing auto-submission by refreshing.
    if status_str == "submitted" and record_exam == title:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Exam already submitted. You cannot restart."
        )

    # 5. Otherwise, set the start time NOW and increment attempts
    new_start = datetime.now(timezone.utc).isoformat()
    update_payload = {
        "status": "active",
        "started_at": new_start,
        "last_active": new_start,
        "warnings": 0, # Fresh start only for brand new attempts
        "exam_name": title
    }
    
    try:
        if record_id:
            # Existing row — update by primary key
            db.table("exam_status").update({
                **update_payload,
                "attempts_count": (attempts_count or 0) + 1
            }).eq("id", record_id).execute()
        else:
            # No row yet — insert
            db.table("exam_status").insert({
                **update_payload,
                "student_id": student_id,
                "attempts_count": 1
            }).execute()
    except Exception as e:
        print(f"[EXAM] Per-exam start failed: {e}")
        # Fallback to simple update
        db.table("exam_status").update(update_payload).eq("student_id", student_id).execute()

    return StartExamResponse(started_at=new_start, status="active")
