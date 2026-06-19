from fastapi import APIRouter, HTTPException, status, Header, Depends, File, UploadFile, Query
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional, List
from core.config import get_settings
from db.supabase_client import get_supabase
from core.security import hash_password
from models.schemas import (
    AdminQuestionsResponse, AdminQuestionOut,
    QuestionCreate, QuestionUpdate,
    StudentStatus, StudentCreate, StudentUpdate,
    ExamConfig, ExamConfigUpdate, FolderRenameRequest,
    FolderEditBranchRequest, SupportRequestResponse,
    ViolationHistoryOut, StudentFidelity, GlobalConfigUpdate
)
from datetime import datetime, timezone
import io
import xlsxwriter
from pydantic import BaseModel

class AdminExamResetRequest(BaseModel):
    exam_name: Optional[str] = None

router = APIRouter(prefix="/admin", tags=["admin management"])
settings = get_settings()

async def verify_admin(x_admin_secret: str = Header(...)):
    """Security dependency to check for admin secret."""
    if x_admin_secret != settings.admin_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials"
        )
    return True

# ── Questions Management ──────────────────────────────────────

@router.get("/questions", response_model=AdminQuestionsResponse)
async def get_all_questions(_: bool = Depends(verify_admin)):
    """
    Retrieve all questions with Spectral Tag parsing for virtual folders.
    """
    db = get_supabase()
    result = db.table("questions").select("*").order("order_index").execute()
    
    import json
    processed_questions = []
    for q in result.data:
        text = q.get("text", "")
        # Default exam name from DB or model default
        exam_name = q.get("exam_name", "Initial Assessment")
        
        # ── Spectral Tag Parser ──
        # Pattern: ⟦EXAM:My Name⟧
        if text.startswith("⟦EXAM:"):
            end_idx = text.find("⟧")
            if end_idx != -1:
                # Extract the tag
                tag_content = text[6:end_idx]
                # Override exam_name for the response
                exam_name = tag_content
                # Strip the tag from the text
                text = text[end_idx + 1:].strip()
        
        # Build the final object
        q["text"] = text
        q["exam_name"] = exam_name
        q["category"] = q.get("category", "other")

        # Parse options[0] for coding questions to populate starter_code, test_cases, target_output, clue, etc.
        if q.get("options") and len(q["options"]) > 0:
            try:
                parsed = json.loads(q["options"][0])
                if isinstance(parsed, dict):
                    q["starter_code"] = parsed.get("starter_code")
                    q["starter_code_c"] = parsed.get("starter_code_c")
                    q["starter_code_cpp"] = parsed.get("starter_code_cpp")
                    q["test_cases"] = parsed.get("test_cases")
                    q["target_output"] = parsed.get("target_output")
            except Exception:
                pass

        processed_questions.append(q)

    return AdminQuestionsResponse(questions=processed_questions, total=len(processed_questions))

@router.post("/questions")
async def create_question(request: QuestionCreate, _: bool = Depends(verify_admin)):
    try:
        db = get_supabase()
        # ── Dynamic Schema Discovery ──
        probe = db.table("questions").select("*").limit(1).execute()
        db_columns = list(probe.data[0].keys()) if (probe.data and len(probe.data) > 0) else [
            "text", "options", "branch", "correct_answer", "marks", "order_index", "exam_name"
        ]
        full_data = request.model_dump()
        data = {k: v for k, v in full_data.items() if k in db_columns}

        result = db.table("questions").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to insert question - no data returned")
        return result.data[0]
    except Exception as e:
        print(f"CRITICAL create_question: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.patch("/questions/{question_id}")
async def update_question(question_id: str, request: QuestionUpdate, _: bool = Depends(verify_admin)):
    try:
        db = get_supabase()
        # ── Dynamic Schema Discovery ──
        probe = db.table("questions").select("*").limit(1).execute()
        db_columns = list(probe.data[0].keys()) if (probe.data and len(probe.data) > 0) else [
            "text", "options", "branch", "correct_answer", "marks", "order_index", "exam_name"
        ]
        full_update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        update_data = {k: v for k, v in full_update_data.items() if k in db_columns}

        result = db.table("questions").update(update_data).eq("id", question_id).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update question - no data returned")
        return result.data[0]
    except Exception as e:
        print(f"CRITICAL update_question: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, _: bool = Depends(verify_admin)):
    db = get_supabase()
    db.table("questions").delete().eq("id", question_id).execute()
    return {"deleted": True}

@router.post("/questions/upload")
async def upload_question_image(
    file: UploadFile = File(...),
    _: bool = Depends(verify_admin)
):
    """
    Upload a question image to Supabase Storage and return the public URL.
    """
    import uuid
    db = get_supabase()
    
    # 1. Bucket initialization (Safe-check)
    bucket_name = "question-images"
    try:
        buckets = db.storage.list_buckets()
        if not any(b.name == bucket_name for b in buckets):
            db.storage.create_bucket(bucket_name, options={"public": True})
    except Exception as e:
        print(f"Bucket init alert: {e}")

    # 2. File preparation
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    unique_name = f"{uuid.uuid4()}.{file_ext}"
    contents = await file.read()

    # 3. Upload to Supabase Storage
    try:
        # Use storage.from_(...).upload pattern
        res = db.storage.from_(bucket_name).upload(
            path=unique_name,
            file=contents,
            file_options={"content-type": file.content_type or "image/jpeg"}
        )
        
        # 4. Generate Public URL
        # Format: {BASE_URL}/storage/v1/object/public/{bucket}/{path}
        public_url = db.storage.from_(bucket_name).get_public_url(unique_name)
        
        return {"image_url": public_url}
    except Exception as e:
        print(f"CRITICAL image_upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Students Management ───────────────────────────────────────

@router.get("/students", response_model=list[StudentStatus])
async def get_all_students(exam: Optional[str] = Query(None), _: bool = Depends(verify_admin)):
    try:
        db = get_supabase()
        # Query students joined with ALL their exam_status and exam_results records
        result = db.table("students").select("*, exam_status(id, student_id, exam_name, status, warnings, last_active, submitted_at, started_at), odyssey_progress(current_round, round_1_state), exam_results(score, total_marks, exam_name)").execute()

        rows = []
        if result.data:
            for s in result.data:
                e_statuses = s.get("exam_status") or []
                e_results = s.get("exam_results") or []
                odyssey = s.get("odyssey_progress") or {}
                if isinstance(odyssey, list) and len(odyssey) > 0:
                    odyssey = odyssey[0]
                
                current_round = odyssey.get("current_round")
                round_1_state = odyssey.get("round_1_state")

                # Get the best/latest result for the current exam
                score = 0.0
                total_marks = 100
                if e_results:
                    # If an exam filter is provided, try to find a matching result
                    if exam:
                        matching_results = [r for r in e_results if (r.get("exam_name") or "").lower() == exam.lower()]
                        if matching_results:
                            res = matching_results[0]
                            score = res.get("score", 0.0)
                            total_marks = res.get("total_marks", 100)
                    else:
                        # Otherwise take the first one (most recent usually)
                        res = e_results[0]
                        score = res.get("score", 0.0)
                        total_marks = res.get("total_marks", 100)

                # ─── ROUND 1 MARK INTEGRATION ───
                # If score is still 0 and we have round_1_state, use those marks
                if score == 0 and round_1_state:
                    score = round_1_state.get("mcq_score", 0.0)
                    total_marks = round_1_state.get("mcq_total", 100)
                # ────────────────────────────────

                latest = None
                if exam:
                    # Filter for specific exam (case-insensitive)
                    specific = [e for e in e_statuses if (e.get("exam_name") or "").lower() == exam.lower()]
                    if specific:
                        # Prioritize active/submitted over not_started, then by last_active
                        def session_priority(s):
                            priority = {"active": 2, "submitted": 1, "not_started": 0}
                            return (priority.get(s.get("status"), -1), s.get("last_active") or "")
                        
                        sorted_specific = sorted(specific, key=session_priority, reverse=True)
                        latest = sorted_specific[0]
                else:
                    if e_statuses:
                        # Global view: sort all sessions by last activity
                        sorted_sessions = sorted(e_statuses, key=lambda x: x.get("last_active") or "", reverse=True)
                        latest = sorted_sessions[0]

                if not latest:
                    rows.append(StudentStatus(
                        student_id=s["id"],
                        usn=s.get("usn") or s.get("roll_number") or "UNKNOWN",
                        name=s.get("name", "UNKNOWN"),
                        email=s.get("email"),
                        branch=s.get("branch", "CS"),
                        status="not_started",
                        warnings=0,
                        score=score,
                        total_marks=total_marks,
                        last_active=None,
                        submitted_at=None,
                        started_at=None,
                        is_blocked=s.get("is_blocked", False),
                        exam_name=exam,
                        current_round=current_round,
                        round_1_state=round_1_state
                    ))
                else:
                    rows.append(StudentStatus(
                        student_id=s["id"],
                        usn=s.get("usn") or s.get("roll_number") or "UNKNOWN",
                        name=s.get("name", "UNKNOWN"),
                        email=s.get("email"),
                        branch=s.get("branch", "CS"),
                        status=latest.get("status", "not_started"),
                        warnings=latest.get("warnings", 0),
                        score=score,
                        total_marks=total_marks,
                        last_active=latest.get("last_active"),
                        submitted_at=latest.get("submitted_at"),
                        started_at=latest.get("started_at"),
                        is_blocked=s.get("is_blocked", False),
                        exam_name=latest.get("exam_name"),
                        current_round=current_round,
                        round_1_state=round_1_state
                    ))

        return rows
    except Exception as e:
        print(f"CRITICAL get_all_students: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/students/{student_id}/fidelity", response_model=StudentFidelity)
async def get_student_fidelity(student_id: str, _: bool = Depends(verify_admin)):
    """Fetch high-fidelity student data including all relations."""
    db = get_supabase()
    
    # 1. Fetch Student Core
    student_res = db.table("students").select("*").eq("id", student_id).execute()
    if not student_res.data:
        raise HTTPException(status_code=404, detail="Student not found")
    s = student_res.data[0]

    # 2. Fetch Relations (Explicit columns to avoid last_score/last_total issues)
    status_res = db.table("exam_status").select("id, student_id, exam_name, status, warnings, last_active, submitted_at, started_at").eq("student_id", student_id).execute()
    results_res = db.table("exam_results").select("*").eq("student_id", student_id).execute()
    
    # Odyssey is optional, handle missing table (PGRST205)
    odyssey = {}
    try:
        odyssey_res = db.table("odyssey_progress").select("*").eq("student_id", student_id).execute()
        if odyssey_res.data:
            odyssey = odyssey_res.data[0]
    except Exception as e:
        print(f"Odyssey telemetry unavailable: {e}")

    status = status_res.data[0] if status_res.data else {}
    results = results_res.data or []

    # 3. Calculate Category Breakdown & Group Results
    cat_scores = {
        "aptitude": {"score": 0.0, "total": 0.0},
        "programming": {"score": 0.0, "total": 0.0},
        "other": {"score": 0.0, "total": 0.0}
    }
    results_by_cat = {
        "aptitude": [],
        "programming": [],
        "other": []
    }

    if results:
        # Process ALL result sessions to get a full picture
        for res in results:
            student_answers = res.get("answers", {})
            e_name = res.get("exam_name")
            if not e_name: continue
            
            # Fetch questions for this specific exam
            try:
                questions_res = db.table("questions").select("id, category, correct_answer, marks").eq("exam_name", e_name).execute()
                if questions_res.data:
                    # Determine primary category for this result node
                    # (Simplified: check which category has most questions)
                    cat_counts = {}
                    for q in questions_res.data:
                        q_id = q["id"]
                        cat = q.get("category", "other").lower()
                        if cat not in cat_scores: cat = "other"
                        cat_counts[cat] = cat_counts.get(cat, 0) + 1
                        
                        q_marks = q.get("marks", 1)
                        cat_scores[cat]["total"] += q_marks
                        
                        if q_id in student_answers and student_answers[q_id] == q["correct_answer"]:
                            cat_scores[cat]["score"] += q_marks
                    
                    # Sort result into its primary category bucket
                    primary_cat = max(cat_counts, key=cat_counts.get) if cat_counts else "other"
                    results_by_cat[primary_cat].append(res)
            except Exception as e:
                print(f"Category calculation failed for {e_name}: {e}")

    # 4. Consolidate
    return StudentFidelity(
        student_id=s["id"],
        name=s.get("name", "Unknown"),
        usn=s.get("usn", "N/A"),
        email=s.get("email"),
        branch=s.get("branch", "CS"),
        status=status.get("status", "not_started"),
        warnings=status.get("warnings", 0),
        score=results[0].get("score", 0) if results else 0,
        total_marks=results[0].get("total_marks", 0) if results else 0,
        last_active=status.get("last_active"),
        submitted_at=status.get("submitted_at"),
        started_at=status.get("started_at"),
        is_blocked=status.get("is_blocked", s.get("is_blocked", False)),
        exam_name=status.get("exam_name", "General"),
        exam_results=results,
        odyssey_progress=odyssey,
        category_scores=cat_scores,
        results_by_category=results_by_cat
    )

@router.post("/students")
async def create_student(request: StudentCreate, _: bool = Depends(verify_admin)):
    db = get_supabase()
    existing = db.table("students").select("id").eq("usn", request.usn.upper()).execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="USN already exists")

    student_data = {
        "usn": request.usn.upper(),
        "roll_number": request.usn.upper(),
        "name": request.name,
        "email": request.email,
        "branch": request.branch,
        "password_hash": hash_password(request.password)
    }

    try:
        s_result = db.table("students").insert(student_data).execute()
    except Exception as e:
        print(f"CRITICAL create_student: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if not s_result.data:
        raise HTTPException(status_code=500, detail="Failed to insert student - no data returned")

    student = s_result.data[0]
    db.table("exam_status").insert({"student_id": student["id"]}).execute()
    return student

@router.patch("/students/{student_id}")
async def update_student(student_id: str, request: StudentUpdate, _: bool = Depends(verify_admin)):
    db = get_supabase()

    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name
    if request.email is not None:
        update_data["email"] = request.email
    if request.usn is not None:
        update_data["usn"] = request.usn.upper()
    if request.branch is not None:
        update_data["branch"] = request.branch
    if request.password is not None:
        update_data["password_hash"] = hash_password(request.password)
    if request.is_active_session is not None:
        update_data["is_active_session"] = request.is_active_session
        if not request.is_active_session:
            update_data["current_token"] = None
    if request.is_blocked is not None:
        update_data["is_blocked"] = request.is_blocked

    if update_data:
        db.table("students").update(update_data).eq("id", student_id).execute()

    return {"updated": True}

@router.post("/students/{student_id}/block")
async def block_student(student_id: str, _: bool = Depends(verify_admin)):
    db = get_supabase()
    db.table("students").update({"is_blocked": True}).eq("id", student_id).execute()
    return {"blocked": True}

@router.post("/students/{student_id}/unblock")
async def unblock_student(student_id: str, _: bool = Depends(verify_admin)):
    db = get_supabase()
    db.table("students").update({"is_blocked": False}).eq("id", student_id).execute()
    return {"blocked": False}

@router.delete("/students/{student_id}")
async def delete_student(student_id: str, _: bool = Depends(verify_admin)):
    db = get_supabase()
    db.table("students").delete().eq("id", student_id).execute()
    return {"deleted": True}

@router.delete("/students-all")
async def delete_all_students(_: bool = Depends(verify_admin)):
    db = get_supabase()
    # Use 'usn' for the dummy filter instead of 'id' because 'id' is a UUID and parsing "dummy" fails
    db.table("students").delete().neq("usn", "dummy_delete_all").execute()
    return {"deleted_all": True}

@router.post("/students/{student_id}/reset")
async def reset_student_exam(student_id: str, payload: Optional[AdminExamResetRequest] = None, _: bool = Depends(verify_admin)):
    """Reset a student's exam so they can retake it."""
    db = get_supabase()
    
    exam_name = payload.exam_name if payload else None

    # Reset active session
    db.table("students").update({
        "is_active_session": False,
        "current_token": None
    }).eq("id", student_id).execute()

    if exam_name:
        # Delete only specific exam records (Hard delete to allow fresh start)
        db.table("exam_status").delete().eq("student_id", student_id).ilike("exam_name", exam_name).execute()
        db.table("exam_results").delete().eq("student_id", student_id).ilike("exam_name", exam_name).execute()
        db.table("student_responses").delete().eq("student_id", student_id).ilike("exam_name", exam_name).execute()
        db.table("live_alerts").delete().eq("student_id", student_id).ilike("exam_name", exam_name).execute()
    else:
        # Reset ALL exams (legacy behavior)
        db.table("exam_status").update({
            "status": "not_started",
            "warnings": 0,
            "started_at": None,
            "submitted_at": None,
            "last_active": None
        }).eq("student_id", student_id).execute()
        db.table("exam_results").delete().eq("student_id", student_id).execute()
        db.table("student_responses").delete().eq("student_id", student_id).execute()

    return {"reset": True}

@router.post("/students/cleanup-stale")
async def cleanup_stale_sessions(_: bool = Depends(verify_admin)):
    """Bulk move sessions idle for > 4h to 'submitted' (force-submit) or reset them."""
    # For now, we'll reset them to prevent infinite 'Active' state
    from datetime import timedelta
    db = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat()
    
    # 1. Find stale IDs
    stale_res = db.table("exam_status").select("student_id").eq("status", "active").lt("last_active", cutoff).execute()
    stale_ids = [r["student_id"] for r in (stale_res.data or [])]
    
    if not stale_ids:
        return {"count": 0}

    # 2. Reset status
    db.table("exam_status").update({
        "status": "not_started",
        "started_at": None,
        "last_active": None,
        "warnings": 0
    }).in_("student_id", stale_ids).execute()

    # 3. Clear results to keep it clean
    db.table("exam_results").delete().in_("student_id", stale_ids).execute()

    # 4. Clear active sessions
    db.table("students").update({
        "is_active_session": False,
        "current_token": None
    }).in_("id", stale_ids).execute()

    return {"count": len(stale_ids)}

@router.post("/students/{student_id}/force-submit")
async def force_submit_student(student_id: str, _: bool = Depends(verify_admin)):
    """Admin tool to force submission of a student session using current saved answers."""
    db = get_supabase()
    
    # 1. Fetch student for context (branch)
    student_res = db.table("students").select("branch").eq("id", student_id).execute()
    if not student_res.data:
        raise HTTPException(status_code=404, detail="Student not found")
    branch = student_res.data[0]["branch"]

    # 2. Get saved answers (Safe check - may not exist if 0 answers)
    results_res = db.table("exam_results").select("answers").eq("student_id", student_id).execute()
    answers = results_res.data[0].get("answers") or {} if results_res.data else {}
    
    # 3. Calculate Score
    # Fetch questions for this branch
    qs_res = db.table("questions").select("id, correct_answer, marks").eq("branch", branch).execute()
    correct_map = {q["id"]: (q["correct_answer"], q["marks"]) for q in (qs_res.data or [])}

    score = 0
    total_marks = sum(m for _, m in correct_map.values())
    for q_id, selected in answers.items():
        if q_id in correct_map:
            correct_ans, marks = correct_map[q_id]
            if selected == correct_ans:
                score += marks

    submitted_at = datetime.now(timezone.utc).isoformat()
    
    # 4. Finalize session
    if results_res.data:
        db.table("exam_results").update({
            "score": score,
            "total_marks": total_marks,
            "submitted_at": submitted_at
        }).eq("student_id", student_id).execute()
    else:
        db.table("exam_results").insert({
            "student_id": student_id,
            "answers": answers,
            "score": score,
            "total_marks": total_marks,
            "submitted_at": submitted_at
        }).execute()

    db.table("exam_status").update({
        "status": "submitted",
        "submitted_at": submitted_at
    }).eq("student_id", student_id).execute()

    db.table("students").update({
        "is_active_session": False,
        "current_token": None
    }).eq("id", student_id).execute()

    return {"status": "success", "score": score}

# ── Exam Config (Dynamic Fallbacks) ─────────────────────────────

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

@router.get("/exam/config", response_model=ExamConfig)
async def get_exam_config(title: Optional[str] = None, _: bool = Depends(verify_admin)):
    """Get exam activation state and schedule. If title is provided, fetch specific config."""
    db = get_supabase()
    try:
        query = db.table("exam_config").select("*")
        if title:
            result = query.eq("exam_title", title).execute()
        else:
            result = query.limit(1).execute()

        row = None
        if result.data:
            row = result.data[0]
        else:
            if title:
                row = next((c for c in DYNAMIC_CONFIGS if c["exam_title"] == title), None)
            elif DYNAMIC_CONFIGS:
                row = DYNAMIC_CONFIGS[0]

        if row:
            return ExamConfig(
                is_active=row.get("is_active", True),
                scheduled_start=row.get("scheduled_start"),
                scheduled_end=row.get("scheduled_end"),
                duration_minutes=row.get("duration_minutes", 60),
                exam_title=row.get("exam_title", "ExamGuard Assessment"),
                marks_per_question=row.get("marks_per_question", 4),
                negative_marks=float(row.get("negative_marks") if row.get("negative_marks") is not None else -1.0),
                shuffle_questions=row.get("shuffle_questions", False),
                shuffle_options=row.get("shuffle_options", False),
                max_attempts=row.get("max_attempts", 1),
                show_answers_after=row.get("show_answers_after", True),
                total_questions=row.get("total_questions", 30),
                total_marks=row.get("total_marks", 120),
                exam_description=row.get("exam_description"),
                branch=row.get("branch", "ALL"),
                category=row.get("category", "other")
            )
    except Exception as e:
        print(f"Error fetching config: {e}")
    
    return ExamConfig(exam_title=title) if title else ExamConfig()


@router.get("/exam/config/all", response_model=List[ExamConfig])
async def get_all_exam_configs(_: bool = Depends(verify_admin)):
    """Fetch all exam configurations for management."""
    db = get_supabase()
    try:
        res = db.table("exam_config").select("*").execute()
        res_data = res.data or []
        
        # Merge dynamic configurations
        for dyn in DYNAMIC_CONFIGS:
            if not any(row.get("exam_title") == dyn["exam_title"] for row in res_data):
                res_data.append(dyn)
                
        return [
            ExamConfig(
                is_active=row.get("is_active", True),
                scheduled_start=row.get("scheduled_start"),
                scheduled_end=row.get("scheduled_end"),
                duration_minutes=row.get("duration_minutes", 60),
                exam_title=row.get("exam_title", "ExamGuard Assessment"),
                marks_per_question=row.get("marks_per_question", 4),
                negative_marks=float(row.get("negative_marks") if row.get("negative_marks") is not None else -1.0),
                shuffle_questions=row.get("shuffle_questions", False),
                shuffle_options=row.get("shuffle_options", False),
                max_attempts=row.get("max_attempts", 1),
                show_answers_after=row.get("show_answers_after", True),
                total_questions=row.get("total_questions", 30),
                total_marks=row.get("total_marks", 120),
                exam_description=row.get("exam_description"),
                branch=row.get("branch", "ALL"),
                category=row.get("category", "other")
            ) for row in res_data
        ]
    except Exception as e:
        print(f"Error fetching all configs: {e}")
        return []


@router.post("/exam/config", response_model=ExamConfig)
async def update_exam_config(request: ExamConfigUpdate, _: bool = Depends(verify_admin)):
    """Update exam activation state, schedule, duration by title (upsert)."""
    db = get_supabase()

    if not request.exam_title:
        raise HTTPException(status_code=400, detail="exam_title is required for configuration")

    update_data: dict = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "exam_title": request.exam_title
    }
    if request.is_active is not None:
        update_data["is_active"] = request.is_active
    if request.scheduled_start is not None:
        update_data["scheduled_start"] = request.scheduled_start
    if request.scheduled_end is not None:
        update_data["scheduled_end"] = request.scheduled_end
    if request.duration_minutes is not None:
        update_data["duration_minutes"] = request.duration_minutes
    if request.marks_per_question is not None:
        update_data["marks_per_question"] = request.marks_per_question
    if request.negative_marks is not None:
        update_data["negative_marks"] = request.negative_marks
    if request.shuffle_questions is not None:
        update_data["shuffle_questions"] = request.shuffle_questions
    if request.shuffle_options is not None:
        update_data["shuffle_options"] = request.shuffle_options
    if request.max_attempts is not None:
        update_data["max_attempts"] = request.max_attempts
    if request.show_answers_after is not None:
        update_data["show_answers_after"] = request.show_answers_after
    if request.total_questions is not None:
        update_data["total_questions"] = request.total_questions
    if request.total_marks is not None:
        update_data["total_marks"] = request.total_marks
    if request.exam_description is not None:
        update_data["exam_description"] = request.exam_description
    if request.branch is not None:
        update_data["branch"] = request.branch

    try:
        # Use upsert based on UNIQUE exam_title
        result = db.table("exam_config").upsert(update_data, on_conflict="exam_title").execute()
        
        if result.data:
            row = result.data[0]
            return ExamConfig(
                is_active=row.get("is_active", True),
                scheduled_start=row.get("scheduled_start"),
                scheduled_end=row.get("scheduled_end"),
                duration_minutes=row.get("duration_minutes", 60),
                exam_title=row.get("exam_title"),
                marks_per_question=row.get("marks_per_question", 4),
                negative_marks=float(row.get("negative_marks") if row.get("negative_marks") is not None else -1.0),
                shuffle_questions=row.get("shuffle_questions", False),
                shuffle_options=row.get("shuffle_options", False),
                max_attempts=row.get("max_attempts", 1),
                show_answers_after=row.get("show_answers_after", True),
                total_questions=row.get("total_questions", 30),
                total_marks=row.get("total_marks", 120),
                exam_description=row.get("exam_description"),
                branch=row.get("branch", "ALL"),
                category=row.get("category", "other")
            )
    except Exception as e:
        err_str = str(e)
        if "PGRST205" in err_str or "Could not find the table" in err_str:
            raise HTTPException(
                status_code=400,
                detail="Database Table Missing: Please run the SQL script in 'supabase/exam_config.sql' in your Supabase SQL Editor to initialize the multi-quiz system."
            )
        print(f"CRITICAL update_exam_config: {e}")
        raise HTTPException(status_code=500, detail=err_str)

    return ExamConfig(**{k: v for k, v in update_data.items() if k in ExamConfig.model_fields})




# ── PyHunt Global Configuration ────────────────────────────────

@router.get("/pyhunt/config")
async def get_pyhunt_config(_: bool = Depends(verify_admin)):
    """Fetch all global configuration key-values for PyHunt."""
    db = get_supabase()
    try:
        result = db.table("pyhunt_global_config").select("*").execute()
        return result.data or []
    except Exception as e:
        print(f"[ADMIN] pyhunt_config fetch failed: {e}")
        return []

@router.post("/pyhunt/config")
async def update_pyhunt_config(request: GlobalConfigUpdate, _: bool = Depends(verify_admin)):
    """Upsert a global configuration key-value (bypasses RLS)."""
    db = get_supabase()
    try:
        # We use the config_key as the on_conflict target
        result = db.table("pyhunt_global_config").upsert({
            "config_key": request.config_key,
            "config_value": request.config_value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="config_key").execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update configuration")
        return result.data[0]
    except Exception as e:
        err_msg = str(e)
        if "PGRST204" in err_msg or "PGRST205" in err_msg or "relation" in err_msg:
             raise HTTPException(
                status_code=400,
                detail="Database Table Missing: Please run the SQL to create the 'pyhunt_global_config' table."
            )
        print(f"CRITICAL update_pyhunt_config: {e}")
        raise HTTPException(status_code=500, detail=err_msg)



# ── Orbital Node Management (Folder CRUD) ─────────────────────

@router.delete("/folders/{folder_name}")
async def delete_folder(folder_name: str, branch: Optional[str] = None, _: bool = Depends(verify_admin)):
    """
    Delete an entire Isolation Node (Folder) and all its questions.
    """
    db = get_supabase()
    
    # Discovery
    probe = db.table("questions").select("*").limit(1).execute()
    has_exam_column = False
    if probe.data and len(probe.data) > 0:
        has_exam_column = "exam_name" in probe.data[0].keys()

    if has_exam_column:
        q = db.table("questions").delete().eq("exam_name", folder_name)
        if branch:
            q = q.eq("branch", branch)
        q.execute()
    else:
        tag_prefix = f"⟦EXAM:{folder_name}⟧"
        db.table("questions").delete().like("text", f"{tag_prefix}%").execute()

    # Also delete associated config if it exists
    if branch:
        # Check if other branches still use this exam
        leftover = db.table("questions").select("id").eq("exam_name", folder_name).limit(1).execute()
        if not leftover.data:
            db.table("exam_config").delete().eq("exam_title", folder_name).execute()
    else:
        db.table("exam_config").delete().eq("exam_title", folder_name).execute()

    return {"status": "success", "deleted_folder": folder_name}


@router.patch("/folders/{folder_name}")
async def rename_folder(folder_name: str, request: FolderRenameRequest, _: bool = Depends(verify_admin)):
    """
    Rename an entire Isolation Node (Folder).
    Updates column or Spectral Tag.
    """
    db = get_supabase()
    new_name = request.new_name.strip()
    
    # Discovery
    probe = db.table("questions").select("*").limit(1).execute()
    has_exam_column = False
    if probe.data and len(probe.data) > 0:
        has_exam_column = "exam_name" in probe.data[0].keys()

    if has_exam_column:
        q = db.table("questions").update({"exam_name": new_name}).eq("exam_name", folder_name)
        if request.branch:
            q = q.eq("branch", request.branch)
        q.execute()
    else:
        # Spectral Tag Rename: Fetch and batch update
        tag_old = f"⟦EXAM:{folder_name}⟧"
        tag_new = f"⟦EXAM:{new_name}⟧"
        
        # Get all relevant questions
        res = db.table("questions").select("id, text").like("text", f"{tag_old}%").execute()
        
        for q in res.data:
            updated_text = q["text"].replace(tag_old, tag_new, 1)
            db.table("questions").update({"text": updated_text}).eq("id", q["id"]).execute()

    return {"status": "success", "old_name": folder_name, "new_name": new_name}


@router.patch("/folders/{folder_name}/branch")
async def edit_folder_branch(folder_name: str, request: FolderEditBranchRequest, _: bool = Depends(verify_admin)):
    """
    Update/Sync the branches for an entire Isolation Node (Folder).
    Supports multi-branch assignment by duplicating questions across selected branches.
    """
    db = get_supabase()
    target_branches = [b.strip() for b in request.new_branches if b.strip()]
    if not target_branches:
        raise HTTPException(status_code=400, detail="At least one branch must be selected")

    # 1. Fetch all existing questions for this folder
    res = db.table("questions").select("*").eq("exam_name", folder_name).execute()
    existing_questions = res.data or []
    
    # 2. Group existing by branch
    by_branch = {}
    for q in existing_questions:
        br = q.get("branch", "CS")
        if br not in by_branch: by_branch[br] = []
        by_branch[br].append(q)
    
    existing_branches = list(by_branch.keys())
    
    # 3. Reference set for copying (use the first available branch's questions as template)
    reference_qs = existing_questions if not existing_branches else by_branch[existing_branches[0]]
    
    # 4. Handle Deletions: Remove branches no longer in target list
    for br in existing_branches:
        if br not in target_branches:
            db.table("questions").delete().eq("exam_name", folder_name).eq("branch", br).execute()
            
    # 5. Handle Additions: Create questions for new target branches
    for br in target_branches:
        if br not in existing_branches:
            # Copy all questions from reference to this new branch
            new_rows = []
            for q in reference_qs:
                new_q = {k: v for k, v in q.items() if k != "id"} # Strip ID for new insert
                new_q["branch"] = br
                new_rows.append(new_q)
            
            if new_rows:
                db.table("questions").insert(new_rows).execute()

    return {"status": "success", "folder": folder_name, "branches": target_branches}


# ── Crystalline Data Export ───────────────────────────────────

@router.get("/export")
async def export_results(
    quiz_name: Optional[str] = Query(None),
    _: bool = Depends(verify_admin)
):
    """
    Export all exam results as a structured Excel file.
    Includes: student info, score, percentage, time taken, submitted_at.
    """
    try:
        import xlsxwriter  # type: ignore
    except ImportError:
        raise HTTPException(status_code=500, detail="xlsxwriter not installed")

    db = get_supabase()
    
    # ── Filtering & Data Gathering ──
    # 1. Fetch relevant exam results
    results_query = db.table("exam_results").select("student_id, score, total_marks, submitted_at, exam_name")
    if quiz_name:
        results_query = results_query.ilike("exam_name", f"%{quiz_name}%")
    results = results_query.execute()

    # 2. Fetch statuses for time tracking and warnings
    status_query = db.table("exam_status").select("student_id, started_at, status, warnings, exam_name, submitted_at")
    if quiz_name:
        status_query = status_query.ilike("exam_name", f"%{quiz_name}%")
    statuses = status_query.execute()

    # 3. Fetch student info
    students = db.table("students").select("id, usn, name, branch, email").execute()

    status_map = {s["student_id"]: s for s in (statuses.data or [])}
    student_map = {s["id"]: s for s in (students.data or [])}

    # 4. Build rows
    rows = []
    # Map results by student_id + exam_name for quick lookup
    # We want to export every unique student-exam combination
    for res in (results.data or []):
        sid = res["student_id"]
        ename = res.get("exam_name") or "Unknown"
        student = student_map.get(sid, {})
        exam_st = status_map.get(sid, {}) # This might match any exam for the student, but it's a fallback

        score = res.get("score") if res.get("score") is not None else 0
        total = res.get("total_marks") if res.get("total_marks") is not None else 0
        pct = round(float(score) / float(total) * 100, 1) if total else 0.0
        
        submitted_at = res.get("submitted_at") or exam_st.get("submitted_at", "")

        time_taken = ""
        if submitted_at and exam_st.get("started_at"):
            try:
                t0 = datetime.fromisoformat(exam_st["started_at"].replace("Z", "+00:00"))
                t1 = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
                secs = int((t1 - t0).total_seconds())
                time_taken = f"{secs // 60}m {secs % 60}s"
            except Exception:
                pass

        rows.append({
            "USN": student.get("usn", ""),
            "Name": student.get("name", ""),
            "Branch": student.get("branch", ""),
            "Email": student.get("email", ""),
            "Exam": ename,
            "Score": score,
            "Total": total,
            "Percentage": f"{pct}%",
            "Time Taken": time_taken,
            "Submitted At": submitted_at,
            "Warnings": exam_st.get("warnings", 0)
        })

    # 5. Handle PyHunt/Odyssey specifically if not already in results
    if not quiz_name or "pyhunt" in quiz_name.lower():
        try:
            odyssey = db.table("odyssey_progress").select("*").execute()
            for p in (odyssey.data or []):
                sid = p["student_id"]
                # Skip if already added via results
                if any(r["USN"] == student_map.get(sid, {}).get("usn") and r["Exam"] == "PyHunt" for r in rows):
                    continue
                
                student = student_map.get(sid, {})
                exam_st = status_map.get(sid, {})
                
                rounds_comp = (p.get("current_round") or 1) - 1
                if p.get("is_completed"): rounds_comp = 5
                
                time_taken = "Live"
                if exam_st.get("started_at"):
                    try:
                        t0 = datetime.fromisoformat(exam_st["started_at"].replace("Z", "+00:00"))
                        t1 = datetime.now(timezone.utc)
                        secs = int((t1 - t0).total_seconds())
                        time_taken = f"{secs // 60}m {secs % 60}s (Live)"
                    except Exception:
                        pass

                rows.append({
                    "USN": student.get("usn", ""),
                    "Name": student.get("name", ""),
                    "Branch": student.get("branch", ""),
                    "Email": student.get("email", ""),
                    "Exam": "PyHunt (Live)",
                    "Score": rounds_comp,
                    "Total": 5,
                    "Percentage": f"{round(rounds_comp/5*100, 1)}%",
                    "Time Taken": time_taken,
                    "Submitted At": p.get("last_ping", ""),
                    "Warnings": exam_st.get("warnings", 0)
                })
        except Exception as e:
            print(f"Odyssey export fallback failed: {e}")

    if not rows:
        return JSONResponse(status_code=200, content={"detail": f"No submitted results found for quiz: {quiz_name or 'All'}"})

    # Sort by score descending
    rows.sort(key=lambda x: -x["Score"])

    # Build Excel in memory
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {"in_memory": True})
    worksheet = workbook.add_worksheet("Results")

    # Formats
    header_fmt = workbook.add_format({
        "bold": True, "bg_color": "#1a1a2e", "font_color": "#e0aaff",
        "border": 1, "align": "center", "valign": "vcenter", "font_size": 11,
    })
    cell_fmt = workbook.add_format({"border": 1, "valign": "vcenter", "font_size": 10})
    pct_fmt = workbook.add_format({"border": 1, "valign": "vcenter", "num_format": "0.0\"%\"", "font_size": 10})
    top_fmt = workbook.add_format({
        "border": 1, "valign": "vcenter", "font_size": 10,
        "bg_color": "#f0fff4", "bold": True,
    })

    headers = list(rows[0].keys()) if rows else [
        "USN", "Name", "Branch", "Email", "Status", "Score",
        "Total Marks", "Percentage (%)", "Time Taken", "Warnings", "Submitted At"
    ]

    worksheet.set_row(0, 22)
    for col, h in enumerate(headers):
        worksheet.write(0, col, h, header_fmt)
        worksheet.set_column(col, col, max(len(h) + 4, 14))

    for row_idx, row in enumerate(rows, start=1):
        fmt = top_fmt if row_idx <= 3 else cell_fmt
        for col_idx, key in enumerate(headers):
            val = row.get(key, "")
            if key == "Percentage (%)":
                worksheet.write_number(row_idx, col_idx, val, pct_fmt)
            else:
                worksheet.write(row_idx, col_idx, val, fmt)

    workbook.close()
    output.seek(0)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = quiz_name.replace(" ", "_").lower() if quiz_name else "all"
    filename = f"examguard_results_{safe_name}_{timestamp}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

# ── Support Requests Management ───────────────────────────────

@router.get("/violations", response_model=list[ViolationHistoryOut])
async def get_violation_history(student_id: str | None = None, _: bool = Depends(verify_admin)):
    """Fetch recorded violations, optionally filtered by student_id."""
    db = get_supabase()
    
    query = db.table("violations").select("*, students(name, usn)")
    
    if student_id:
        query = query.eq("student_id", student_id)
        
    res = query.order("timestamp", desc=True).limit(100).execute()
    
    rows = []
    for r in (res.data or []):
        student = r.get("students", {})
        metadata = r.get("metadata") or {}
        # Try to get exam_name from root, then metadata, then fallback
        exam_name = r.get("exam_name") or metadata.get("exam_name") or "General"
        
        rows.append(ViolationHistoryOut(
            id=r["id"],
            student_id=r["student_id"],
            student_name=student.get("name", "Unknown"),
            usn=student.get("usn", "Unknown"),
            type=r["type"],
            exam_name=exam_name,
            created_at=r["timestamp"],
            metadata=metadata
        ))
    return rows

@router.post("/students/{student_id}/reset-odyssey")
async def reset_odyssey(student_id: str, _: bool = Depends(verify_admin)):
    """Reset PyHunt (Odyssey) progress for a student."""
    db = get_supabase()
    try:
        res = db.table("odyssey_progress").update({
            "current_round": 1,
            "round_1_state": {"reset": True},
            "round_2_state": {},
            "round_3_state": {},
            "round_4_state": {},
            "round_5_state": {},
            "is_completed": False,
            "error_entropy": 0,
            "last_ping": datetime.now(timezone.utc).isoformat()
        }).eq("student_id", student_id).execute()
        return {"status": "success", "updated": len(res.data or []) > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/support-requests")
async def get_support_requests(_: bool = Depends(verify_admin)):
    """Fetch all support/help requests from students."""
    db = get_supabase()
    try:
        res = db.table("support_requests").select("*").order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        err_str = str(e)
        if "PGRST" in err_str or "relation" in err_str:
            # Table doesn't exist yet — return empty list instead of crashing
            return []
        print(f"[ADMIN] support_requests fetch failed: {e}")
        return []

@router.patch("/support-requests/{request_id}/status")
async def update_support_status(request_id: str, request: dict, _: bool = Depends(verify_admin)):
    """Update status of a help ticket (open, resolved, closed)."""
    db = get_supabase()
    status_val = request.get("status")
    if not status_val:
        raise HTTPException(status_code=400, detail="Status is required")
        
    db.table("support_requests").update({"status": status_val}).eq("id", request_id).execute()
    return {"updated": True, "id": request_id, "new_status": status_val}


# ── Faculty Management ────────────────────────────────────────

@router.get("/faculty")
async def get_all_faculty(_: bool = Depends(verify_admin)):
    """List all faculty with their assigned branches."""
    db = get_supabase()
    faculty_res = db.table("faculty").select("*").order("created_at", desc=True).execute()

    faculty_list = []
    for f in (faculty_res.data or []):
        # Fetch branches for each faculty
        branches_res = db.table("faculty_subjects").select("branch").eq("faculty_id", f["id"]).execute()
        branches = [r["branch"] for r in (branches_res.data or [])]
        faculty_list.append({
            "id": f["id"],
            "name": f["name"],
            "email": f["email"],
            "is_active": f.get("is_active", True),
            "branches": branches,
            "categories": f.get("categories", []),
            "created_at": f.get("created_at")
        })

    return {"faculty": faculty_list, "total": len(faculty_list)}


@router.post("/faculty")
async def create_faculty(request: dict, _: bool = Depends(verify_admin)):
    """Create a new faculty account with branch assignments."""
    db = get_supabase()

    name = request.get("name", "").strip()
    email = request.get("email", "").strip().lower()
    password = request.get("password", "")
    branches = request.get("branches", [])
    categories = request.get("categories", [])

    if not name or not email or not password:
        raise HTTPException(status_code=400, detail="Name, email, and password are required.")

    # Check for duplicate email
    existing = db.table("faculty").select("id").eq("email", email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"Faculty with email '{email}' already exists.")

    # Create faculty record
    faculty_data = {
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "is_active": True,
        "categories": categories
    }
    result = db.table("faculty").insert(faculty_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create faculty")

    faculty_id = result.data[0]["id"]

    # Assign branches
    for branch in branches:
        try:
            db.table("faculty_subjects").insert({
                "faculty_id": faculty_id,
                "branch": branch
            }).execute()
        except Exception as e:
            print(f"[ADMIN] Branch assignment failed for {branch}: {e}")

    return {"success": True, "faculty": {**result.data[0], "branches": branches, "categories": categories}}


@router.put("/faculty/{faculty_id}")
async def update_faculty(faculty_id: str, request: dict, _: bool = Depends(verify_admin)):
    """Update faculty account details and/or branch assignments."""
    db = get_supabase()

    update_data = {}
    if request.get("name"):
        update_data["name"] = request["name"].strip()
    if request.get("email"):
        update_data["email"] = request["email"].strip().lower()
    if request.get("password"):
        update_data["password_hash"] = hash_password(request["password"])
    if "is_active" in request:
        update_data["is_active"] = request["is_active"]
    if "categories" in request:
        update_data["categories"] = request["categories"]

    if update_data:
        db.table("faculty").update(update_data).eq("id", faculty_id).execute()

    # Update branches if provided
    if "branches" in request:
        # Clear existing assignments
        db.table("faculty_subjects").delete().eq("faculty_id", faculty_id).execute()
        # Re-assign
        for branch in request["branches"]:
            try:
                db.table("faculty_subjects").insert({
                    "faculty_id": faculty_id,
                    "branch": branch
                }).execute()
            except Exception:
                pass

    return {"success": True, "updated": faculty_id}


@router.delete("/faculty/{faculty_id}")
async def delete_faculty(faculty_id: str, _: bool = Depends(verify_admin)):
    """Delete a faculty account (cascade deletes branch assignments)."""
    db = get_supabase()
    db.table("faculty").delete().eq("id", faculty_id).execute()
    return {"success": True, "deleted": faculty_id}


@router.put("/faculty/{faculty_id}/branches")
async def assign_faculty_branches(faculty_id: str, request: dict, _: bool = Depends(verify_admin)):
    """Assign or revoke branch access for a faculty member."""
    db = get_supabase()
    branches = request.get("branches", [])

    # Clear existing
    db.table("faculty_subjects").delete().eq("faculty_id", faculty_id).execute()

    # Re-assign
    assigned = []
    for branch in branches:
        try:
            db.table("faculty_subjects").insert({
                "faculty_id": faculty_id,
                "branch": branch
            }).execute()
            assigned.append(branch)
        except Exception:
            pass

    return {"success": True, "faculty_id": faculty_id, "branches": assigned}
