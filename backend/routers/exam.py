from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks, Query
from typing import Optional, List
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
        status_res = db.table("exam_status").select("id, student_id, exam_name, status, warnings, last_active, submitted_at, started_at, attempts_count").eq("student_id", student_id).execute()
        status_data = status_res.data or []
        
        # 2. Fetch all result rows for this student
        results_res = db.table("exam_results").select("score, total_marks, exam_name").eq("student_id", student_id).execute()
        results_data = results_res.data or []
        
        # Create a lookup map for results by exam_name
        results_map = { r.get("exam_name"): r for r in results_data }
        
        # 3. Attach scores to matching status rows
        for s in status_data:
            exam_title = s.get("exam_name")
            res = results_map.get(exam_title)
            if res:
                s["last_score"] = res.get("score")
                s["last_total"] = res.get("total_marks")
        
        return status_data
    except Exception as e:
        print(f"[EXAM] Status fetch failed: {e}")
        return []

@router.post("/heartbeat")
async def heartbeat(current: dict = Depends(get_current_student)):
    """Simple authenticated ping to check if student is blocked/authorized."""
    return {"status": "ok"}

DYNAMIC_CONFIGS = [
    {
        "exam_title": "hii",
        "branch": "DS",
        "is_active": True,
        "duration_minutes": 60,
        "total_questions": 20,
        "total_marks": 80.0,
        "marks_per_question": 4.0,
        "negative_marks": -1.0,
        "max_attempts": 5,
        "shuffle_questions": False,
        "shuffle_options": False,
        "show_answers_after": True,
        "exam_description": "Conceptual MCQs Assessment",
        "scheduled_start": None,
        "scheduled_end": None,
    },
    {
        "exam_title": "meet",
        "branch": "CS",
        "is_active": True,
        "duration_minutes": 60,
        "total_questions": 1,
        "total_marks": 10.0,
        "marks_per_question": 10.0,
        "negative_marks": 0.0,
        "max_attempts": 5,
        "shuffle_questions": False,
        "shuffle_options": False,
        "show_answers_after": True,
        "exam_description": "Coding Challenges Assessment",
        "scheduled_start": None,
        "scheduled_end": None,
    },
    {
        "exam_title": "Meet",
        "branch": "DS",
        "is_active": True,
        "duration_minutes": 60,
        "total_questions": 1,
        "total_marks": 10.0,
        "marks_per_question": 10.0,
        "negative_marks": 0.0,
        "max_attempts": 5,
        "shuffle_questions": False,
        "shuffle_options": False,
        "show_answers_after": True,
        "exam_description": "Aptitude Assessment",
        "scheduled_start": None,
        "scheduled_end": None,
    }
]

@router.get("/config/public")
async def get_exam_config_public(branch: Optional[str] = Query(None)):
    """Public exam config endpoint (no auth) — filtered by branch and active status."""
    db = get_supabase()
    try:
        # 1. Start with basic active filter
        query = db.table("exam_config").select("*").eq("is_active", True)
        
        # 2. Add Branch-Level SQL Filtering (Optimized for 200+ students)
        if branch:
            # Match specific branch OR global "ALL" branch
            query = query.or_(f"branch.eq.{branch.upper()},branch.eq.ALL,branch.is.null")
        
        result = query.execute()
        res_data = result.data or []
        
        # 3. Dynamic Configuration Merging
        for dyn in DYNAMIC_CONFIGS:
            if any(row.get("exam_title") == dyn["exam_title"] for row in res_data):
                continue
            
            if branch:
                b_upper = branch.upper()
                dyn_b = dyn["branch"].upper()
                if dyn_b != "ALL" and dyn_b != b_upper:
                    continue
                    
            res_data.append(dyn)
            
        return res_data
    except Exception as e:
        print(f"[EXAM] Public config SQL fetch failed: {e}")
        # Fallback to filtered dynamic configs in case database fails completely
        res_data = []
        for dyn in DYNAMIC_CONFIGS:
            if branch:
                b_upper = branch.upper()
                dyn_b = dyn["branch"].upper()
                if dyn_b != "ALL" and dyn_b != b_upper:
                    continue
            res_data.append(dyn)
        return res_data



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
        query = db.table("questions").select("id, text, options, branch, order_index, marks, exam_name, image_url, audio_url, category, programming_type")
        if branch != "ALL":
            query = query.eq("branch", branch)
        
        result = query.eq("exam_name", title).order("order_index").limit(100).execute()

        # ── Strategy 2 (Swapped): Global Title Match (Cross-Branch Fallback) ──
        if not result.data:
            result = (
                db.table("questions")
                .select("id, text, options, branch, order_index, marks, exam_name, image_url, audio_url, category, programming_type")
                .eq("exam_name", title)
                .order("order_index")
                .limit(100)
                .execute()
            )

        # ── Strategy 3 (Swapped): Strict Branch + Fuzzy Title Match ──
        if not result.data:
            query = db.table("questions").select("id, text, options, branch, order_index, marks, exam_name, image_url, audio_url, category, programming_type")
            if branch != "ALL":
                query = query.eq("branch", branch)
            result = query.ilike("exam_name", f"%{title}%").order("order_index").limit(100).execute()
            
        # ── Strategy 4: Global Fuzzy Title Match ──
        if not result.data:
            result = (
                db.table("questions")
                .select("id, text, options, branch, order_index, marks, exam_name, image_url, audio_url, category, programming_type")
                .ilike("exam_name", f"%{title}%")
                .order("order_index")
                .limit(100)
                .execute()
            )

    except Exception as e:
        print(f"[EXAM] DB Error during question fetch: {e}")
        # Return empty list instead of 500 to keep UI stable
        return QuestionsResponse(questions=[], total=0)

    # ── Scoring Configuration for the frontend ──
    marks_override = None
    neg_marks = 0.0
    try:
        config_res = db.table("exam_config").select("marks_per_question, negative_marks").eq("exam_title", title).execute()
        if config_res.data:
            cfg = config_res.data[0]
            marks_override = cfg.get("marks_per_question")
            neg_marks = float(cfg.get("negative_marks") if cfg.get("negative_marks") is not None else 0.0)
    except Exception: pass

    import json
    questions = []
    for q in (result.data or []):
        parsed = {}
        if q.get("options") and len(q["options"]) > 0:
            try:
                parsed = json.loads(q["options"][0])
            except Exception:
                pass
        
        questions.append(
            QuestionOut(
                id=q["id"],
                text=(q["text"] or "").replace(f"⟦EXAM:{title}⟧", "").strip(),
                options=q["options"],
                branch=q.get("branch", branch),
                order_index=q["order_index"],
                marks=q["marks"] if marks_override is None else marks_override,
                neg_marks=neg_marks,
                image_url=q.get("image_url"),
                audio_url=q.get("audio_url"),
                category=q.get("category", "other"),
                programming_type=q.get("programming_type"),
                starter_code=parsed.get("starter_code"),
                starter_code_c=parsed.get("starter_code_c"),
                starter_code_cpp=parsed.get("starter_code_cpp"),
                test_cases=parsed.get("test_cases"),
                target_output=parsed.get("target_output")
            )
        )

    return QuestionsResponse(
        questions=questions, 
        total=len(questions),
        pos_marks_global=marks_override if marks_override is not None else (questions[0].marks if questions else 1.0),
        neg_marks_global=neg_marks
    )


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

    exam_name = request.exam_name or "General Assessment"
    
    # Guard: reject if THIS specific exam is already submitted
    status_row = (
        db.table("exam_status")
        .select("status")
        .eq("student_id", student_id)
        .eq("exam_name", exam_name)
        .limit(1)
        .execute()
    )
    if status_row.data and status_row.data[0].get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Exam '{exam_name}' already submitted. Cannot save answers.",
        )

    # Fetch existing answers for THIS specific exam
    existing = (
        db.table("exam_results")
        .select("answers")
        .eq("student_id", student_id)
        .eq("exam_name", exam_name)
        .execute()
    )

    if existing.data:
        answers = existing.data[0].get("answers") or {}
        answers[request.question_id] = request.selected_option
        db.table("exam_results").update({"answers": answers}).eq(
            "student_id", student_id
        ).eq("exam_name", exam_name).execute()
    else:
        db.table("exam_results").insert(
            {
                "student_id": student_id,
                "exam_name": exam_name,
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
        .eq("exam_name", exam_title)
        .limit(1)
        .execute()
    )
    if status_row.data and status_row.data[0].get("status") == "submitted":
        # Return existing result scoped to THIS exam
        # We use a try-except here in case the migration columns (correct_count) aren't ready yet
        try:
            result_row = (
                db.table("exam_results")
                .select("score, total_marks, submitted_at, correct_count, wrong_count")
                .eq("student_id", student_id)
                .eq("exam_name", exam_title)
                .limit(1)
                .execute()
            )
        except Exception:
            # Fallback for old schema
            result_row = (
                db.table("exam_results")
                .select("score, total_marks, submitted_at")
                .eq("student_id", student_id)
                .eq("exam_name", exam_title)
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

    # ── 4-Strategy Question Fetching (Sync with get_questions) ──
    # Strategy 1: Strict Branch + Strict Title
    query = db.table("questions").select("id, correct_answer, marks")
    if branch != "ALL":
        query = query.eq("branch", branch)
    questions_result = query.eq("exam_name", exam_title).execute()

    # Strategy 2 (Swapped): Global Title Match
    if not questions_result.data:
        questions_result = (
            db.table("questions")
            .select("id, correct_answer, marks")
            .eq("exam_name", exam_title)
            .execute()
        )

    # Strategy 3 (Swapped): Strict Branch + Fuzzy Title
    if not questions_result.data:
        query = db.table("questions").select("id, correct_answer, marks")
        if branch != "ALL":
            query = query.eq("branch", branch)
        questions_result = query.ilike("exam_name", f"%{exam_title}%").execute()
    
    # Strategy 4: Global Fuzzy Title Match
    if not questions_result.data:
        questions_result = (
            db.table("questions")
            .select("id, correct_answer, marks")
            .ilike("exam_name", f"%{exam_title}%")
            .execute()
        )

    if not questions_result.data:
        print(f"[EXAM] CRITICAL: No questions found for exam '{exam_title}' during submission!")
    
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

    # 4. Upsert exam_results — unique per (student_id, exam_name)
    # Fetch existing score, total_marks, correct_count, and wrong_count if any
    existing_score = None
    existing_total = None
    existing_correct = None
    existing_wrong = None
    try:
        existing_res = db.table("exam_results").select("score, total_marks, correct_count, wrong_count").eq("student_id", student_id).eq("exam_name", exam_title).limit(1).execute()
        if existing_res.data:
            r = existing_res.data[0]
            existing_score = r.get("score")
            existing_total = r.get("total_marks")
            existing_correct = r.get("correct_count")
            existing_wrong = r.get("wrong_count")
    except Exception as ee:
        print(f"[SUBMIT] Existing score check failed: {ee}")

    final_score = float(score)
    final_total = float(total_marks)
    final_correct = int(correct_count)
    final_wrong = int(wrong_count)

    if existing_score is not None and float(existing_score) > float(score):
        print(f"[SUBMIT] Storing highest previous score {existing_score} instead of new score {score}")
        final_score = float(existing_score)
        if existing_total is not None:
            final_total = float(existing_total)
        if existing_correct is not None:
            final_correct = int(existing_correct)
        if existing_wrong is not None:
            final_wrong = int(existing_wrong)

    try:
        # Construct payload with all reporting columns
        results_payload = {
            "student_id": student_id,
            "exam_name": exam_title,
            "answers": answers,
            "score": float(final_score),
            "total_marks": float(final_total),
            "correct_count": int(final_correct),
            "wrong_count": int(final_wrong),
            "submitted_at": submitted_at
        }
        
        print(f"[SUBMIT] Attempting upsert for {student_id} on {exam_title}...")
        upsert_res = db.table("exam_results").upsert(results_payload, on_conflict="student_id,exam_name").execute()
        print(f"[SUBMIT] Results upserted successfully.")
        
    except Exception as e:
        print(f"[EXAM] Full upsert failed: {e}")
        # Secondary fallback for older schema
        try:
            db.table("exam_results").upsert({
                "student_id": student_id,
                "exam_name": exam_title,
                "answers": answers,
                "score": float(final_score),
                "total_marks": float(final_total),
                "submitted_at": submitted_at
            }, on_conflict="student_id,exam_name").execute()
            print(f"[SUBMIT] Fallback upsert successful.")
        except Exception as e2:
            print(f"[EXAM] CRITICAL: Fallback upsert also failed: {e2}")
            # Raise clear error for global handler to catch and return to student portal
            raise HTTPException(
                status_code=500,
                detail=f"DATABASE_ERROR: Could not save results for {exam_title}. {str(e2)}"
            )

    # 5. Mark submitted and ensure attempt is counted for THIS exam
    try:
        # Fetch existing status to preserve attempts_count
        curr_res = db.table("exam_status").select("attempts_count, id").eq("student_id", student_id).eq("exam_name", exam_title).execute()
        
        curr_count = 1
        if curr_res.data:
            curr_count = (curr_res.data[0].get("attempts_count", 0) or 0) + 1
            print(f"[SUBMIT] Incremented active attempt count: {curr_count}")
        
        status_payload = {
            "student_id": student_id,
            "exam_name": exam_title,
            "status": "submitted", 
            "submitted_at": submitted_at,
            "attempts_count": curr_count,
            "warnings": 0  # Clear warnings on submission
        }
        
        db.table("exam_status").upsert(status_payload, on_conflict="student_id,exam_name").execute()
        print(f"[SUBMIT] Status marked as submitted for {student_id}.")
    except Exception as e:
        print(f"[EXAM] Status update failed: {e}")
        # Don't fail the whole submission if just status update fails, but log it

    # 6. Clear active session
    db.table("students").update(
        {"is_active_session": False, "current_token": None}
    ).eq("id", student_id).execute()

    return SubmitExamResponse(
        submitted=True,
        score=final_score,
        total_marks=final_total,
        correct_count=final_correct,
        wrong_count=final_wrong,
        percentage=round(final_score / final_total * 100, 1) if final_total else 0,
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

    title = title.strip()
    # 1. Fetch config safely
    max_attempts = 1
    try:
        config_res = db.table("exam_config").select("*").ilike("exam_title", title).limit(1).execute()
        if config_res.data:
            max_attempts = config_res.data[0].get("max_attempts") or 1
    except Exception: pass

    # 2. Fetch status safely for this student AND this specific exam
    attempts_count = 0
    status_str = "not_started"
    started_at = None
    record_id = None
    try:
        # Use robust check to find existing record case-insensitively
        status_res = db.table("exam_status").select("*").eq("student_id", student_id).execute()
        
        for r in (status_res.data or []):
            db_exam_name = (r.get("exam_name") or "").strip().lower()
            if db_exam_name == title.lower():
                record_id = r.get("id")
                attempts_count = r.get("attempts_count", 0) or 0
                status_str = r.get("status", "not_started")
                started_at = r.get("started_at")
                break
    except Exception as e:
        print(f"[EXAM] Status check error: {e}")

    # 3. If already active for this exam, KEEP existing warnings and started_at.
    # This prevents students from resetting warnings by refreshing.
    if status_str == "active" and started_at:
        try:
            db.table("exam_status").update({
                "last_active": datetime.now(timezone.utc).isoformat()
            }).eq("id", record_id).execute()
        except Exception: pass
        return StartExamResponse(started_at=started_at, status="active")

    # 4. Block restart if already submitted OR reached max attempts
    #    EXCEPTION: PyHunt and Admin Previews always allow mission restart
    is_pyhunt = title.lower() == "pyhunt"
    is_admin = current["student_id"] == "ADMIN_PREVIEW"

    if status_str == "submitted":
        if is_pyhunt or is_admin:
            print(f"[{'PYHUNT' if is_pyhunt else 'ADMIN'}] Allowing restart for submitted student {student_id}")
            if record_id:
                try:
                    db.table("exam_status").delete().eq("id", record_id).execute()
                    print(f"[{'PYHUNT' if is_pyhunt else 'ADMIN'}] Cleared old submitted record {record_id}")
                except Exception as de:
                    print(f"[{'PYHUNT' if is_pyhunt else 'ADMIN'}] Delete failed, will upsert over it: {de}")
            record_id = None
            attempts_count = 0
            status_str = "not_started"
        elif (attempts_count or 0) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Exam already submitted and maximum attempts ({max_attempts}) reached."
            )
        else:
            # Allow restart since attempts < max_attempts
            print(f"[RESTART] Allowing restart for {student_id} (attempts {attempts_count}/{max_attempts})")
            status_str = "not_started"

    if (attempts_count or 0) >= max_attempts and status_str != "active":
        if is_pyhunt or is_admin:
            print(f"[{'PYHUNT' if is_pyhunt else 'ADMIN'}] Bypassing max-attempts check for {student_id}")
            attempts_count = 0
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Maximum attempts ({max_attempts}) reached for this assessment."
            )

    # 5. Otherwise, set the start time NOW and determine attempt count
    new_start = datetime.now(timezone.utc).isoformat()
    new_count = (attempts_count or 0) + 1

    # Normalize exam name for PyHunt to ensure case consistency in results
    normalized_title = title
    if title.lower() == "pyhunt":
        normalized_title = "PyHunt"

    update_payload = {
        "student_id": student_id,
        "exam_name": normalized_title,
        "status": "active",
        "started_at": new_start,
        "last_active": new_start,
        "warnings": 0,
        "attempts_count": new_count
    }
    
    try:
        db.table("exam_status").upsert(update_payload, on_conflict="student_id,exam_name").execute()
        
        # ── PyHunt Specialized Initialization ──
        if normalized_title == "PyHunt":
            # Reset or Initialize odyssey_progress
            try:
                # Use upsert to either create a new record or reset the existing one to round 1
                db.table("odyssey_progress").upsert({
                    "student_id": student_id,
                    "current_round": 1,
                    "round_1_state": {"reset": True},
                    "round_2_state": {},
                    "round_3_state": {},
                    "round_4_state": {},
                    "is_completed": False,
                    "last_ping": datetime.now(timezone.utc).isoformat()
                }, on_conflict="student_id").execute()
                print(f"[PYHUNT] Progress reset/initialized for {student_id}")
            except Exception as pe:
                print(f"[PYHUNT] Progress initialization failed: {pe}")

    except Exception as e:
        print(f"[EXAM] Per-exam start failed: {e}")
        # Fallback to simple update if ID exists
        if record_id:
            db.table("exam_status").update(update_payload).eq("id", record_id).execute()

    return StartExamResponse(started_at=new_start, status="active")


@router.get("/pyhunt/config")
async def get_pyhunt_config():
    """Public endpoint for students to fetch PyHunt configuration."""
    db = get_supabase()
    try:
        res = db.table("pyhunt_global_config").select("*").execute()
        return res.data or []
    except Exception as e:
        print(f"[EXAM] PyHunt config fetch failed: {e}")
        return []
