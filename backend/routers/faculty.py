from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone

from models.schemas import (
    FacultyLoginRequest, FacultyLoginResponse,
    FacultyOut, LiveAlertOut,
    QuestionCreate, QuestionUpdate,
    AdminQuestionsResponse
)
from core.security import get_current_faculty, verify_password, create_access_token
from db.supabase_client import get_supabase

router = APIRouter(prefix="/faculty", tags=["faculty"])


# ── Helper: validate branch access ──────────────────────────────
def _check_branch_access(faculty: dict, target_branch: str):
    """Raise 403 if faculty doesn't have access to the target branch."""
    if faculty.get("is_admin"):
        return  # Admin bypasses all
    if target_branch not in faculty.get("branches", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. You are not assigned to branch '{target_branch}'."
        )


def _get_branch_filter(faculty: dict):
    """Return list of branches faculty can access."""
    if faculty.get("is_admin"):
        return None  # No filter — admin sees all
    return faculty.get("branches", [])


def _get_faculty_exams(faculty: dict, db):
    """Return list of exam names created by this faculty, OR legacy exams in their branches. None if admin."""
    if faculty.get("is_admin"):
        return None
    faculty_id = faculty.get("faculty_id")
    if not faculty_id:
        return []
    
    # 1. Exams created explicitly by this faculty
    q_res = db.table("questions").select("exam_name").eq("faculty_id", faculty_id).execute()
    exams = {q["exam_name"] for q in (q_res.data or []) if q.get("exam_name")}
    
    # 2. Legacy/Admin exams (faculty_id IS NULL) assigned to their allowed branches
    allowed_branches = faculty.get("branches", [])
    if allowed_branches:
        q_legacy = db.table("questions").select("exam_name").is_("faculty_id", "null").in_("branch", allowed_branches).execute()
        exams.update({q["exam_name"] for q in (q_legacy.data or []) if q.get("exam_name")})
        
    return list(exams)


# ── Faculty Login ─────────────────────────────────────────────
@router.post("/login", response_model=FacultyLoginResponse)
async def faculty_login(request: FacultyLoginRequest):
    """Authenticate faculty with email + password. Returns JWT with role=faculty."""
    db = get_supabase()

    # Find faculty by email
    result = db.table("faculty").select("*").eq("email", request.email.strip().lower()).limit(1).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    faculty = result.data[0]

    if not faculty.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your faculty account has been deactivated."
        )

    if not verify_password(request.password, faculty["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Fetch assigned branches
    branches_res = db.table("faculty_subjects").select("branch").eq("faculty_id", faculty["id"]).execute()
    branches = [r["branch"] for r in (branches_res.data or [])]

    # Create JWT with role=faculty
    token = create_access_token(
        data={
            "sub": faculty["id"],
            "role": "faculty",
            "name": faculty["name"],
            "email": faculty["email"],
        }
    )

    return FacultyLoginResponse(
        access_token=token,
        faculty_id=faculty["id"],
        name=faculty["name"],
        email=faculty["email"],
        branches=branches
    )


# ── Question Bank (Branch-Filtered) ──────────────────────────
@router.get("/questions")
async def get_faculty_questions(
    branch: Optional[str] = None,
    exam_name: Optional[str] = None,
    faculty: dict = Depends(get_current_faculty)
):
    """Fetch questions filtered by faculty's assigned branches."""
    db = get_supabase()
    allowed_branches = _get_branch_filter(faculty)

    query = db.table("questions").select("*").order("order_index")

    if branch:
        _check_branch_access(faculty, branch)
        query = query.eq("branch", branch)
    elif allowed_branches:
        query = query.in_("branch", allowed_branches)

    if exam_name:
        query = query.ilike("exam_name", f"%{exam_name}%")

    result = query.execute()

    # Parse spectral tags
    import json
    processed = []
    for q in (result.data or []):
        text = q.get("text", "")
        q_exam_name = q.get("exam_name", "Initial Assessment")
        if text.startswith("⟦EXAM:"):
            end_idx = text.find("⟧")
            if end_idx != -1:
                q_exam_name = text[6:end_idx]
                text = text[end_idx + 1:].strip()
        q["text"] = text
        q["exam_name"] = q_exam_name
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

        processed.append(q)

    return {"questions": processed, "total": len(processed)}


@router.post("/questions")
async def create_faculty_question(
    request: QuestionCreate,
    faculty: dict = Depends(get_current_faculty)
):
    """Create a question — branch-validated against faculty's assignments."""
    _check_branch_access(faculty, request.branch or "CS")

    db = get_supabase()
    # Dynamic schema discovery
    probe = db.table("questions").select("*").limit(1).execute()
    db_columns = list(probe.data[0].keys()) if (probe.data and len(probe.data) > 0) else [
        "text", "options", "branch", "correct_answer", "marks", "order_index", "exam_name"
    ]
    
    full_data = request.model_dump()
    if request.category == "programming":
        import json
        challenge_data = {
            "target_output": request.target_output or "",
            "test_cases": request.test_cases or "[]",
            "starter_code": request.starter_code or "",
            "starter_code_c": request.starter_code_c or "",
            "starter_code_cpp": request.starter_code_cpp or "",
            "clue": "",
            "clue_variants": "",
            "unlock_code": ""
        }
        full_data["options"] = [json.dumps(challenge_data)]
        full_data["correct_answer"] = "COMPILER"
        full_data["programming_type"] = request.programming_type or "compiler"

    data = {k: v for k, v in full_data.items() if k in db_columns}

    result = db.table("questions").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create question")

    return {"success": True, "question": result.data[0]}


@router.put("/questions/{question_id}")
async def update_faculty_question(
    question_id: str,
    request: QuestionUpdate,
    faculty: dict = Depends(get_current_faculty)
):
    """Update a question — branch-validated."""
    db = get_supabase()

    # Verify the question exists and belongs to an allowed branch
    existing = db.table("questions").select("branch").eq("id", question_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Question not found")

    _check_branch_access(faculty, existing.data[0]["branch"])

    # If changing branch, verify access to new branch too
    full_update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    if "branch" in full_update_data:
        _check_branch_access(faculty, full_update_data["branch"])

    category = full_update_data.get("category")
    if category is None:
        # Load existing category
        existing_q = db.table("questions").select("category").eq("id", question_id).execute()
        if existing_q.data:
            category = existing_q.data[0].get("category")

    if category == "programming":
        import json
        challenge_data = {
            "target_output": "",
            "test_cases": "[]",
            "starter_code": "",
            "starter_code_c": "",
            "starter_code_cpp": "",
            "clue": "",
            "clue_variants": "",
            "unlock_code": ""
        }
        
        # Load existing options to merge
        existing_q = db.table("questions").select("options").eq("id", question_id).execute()
        if existing_q.data and existing_q.data[0].get("options") and len(existing_q.data[0]["options"]) > 0:
            try:
                parsed = json.loads(existing_q.data[0]["options"][0])
                if isinstance(parsed, dict):
                    challenge_data.update(parsed)
            except Exception:
                pass
                
        # Merge request data
        if "target_output" in full_update_data:
            challenge_data["target_output"] = full_update_data["target_output"] or ""
        if "test_cases" in full_update_data:
            challenge_data["test_cases"] = full_update_data["test_cases"] or "[]"
        if "starter_code" in full_update_data:
            challenge_data["starter_code"] = full_update_data["starter_code"] or ""
        if "starter_code_c" in full_update_data:
            challenge_data["starter_code_c"] = full_update_data["starter_code_c"] or ""
        if "starter_code_cpp" in full_update_data:
            challenge_data["starter_code_cpp"] = full_update_data["starter_code_cpp"] or ""
            
        full_update_data["options"] = [json.dumps(challenge_data)]
        full_update_data["correct_answer"] = "COMPILER"
        if "programming_type" not in full_update_data:
            full_update_data["programming_type"] = "compiler"

    # Filter by db_columns
    probe = db.table("questions").select("*").limit(1).execute()
    db_columns = list(probe.data[0].keys()) if (probe.data and len(probe.data) > 0) else [
        "text", "options", "branch", "correct_answer", "marks", "order_index", "exam_name"
    ]
    data = {k: v for k, v in full_update_data.items() if k in db_columns}

    result = db.table("questions").update(data).eq("id", question_id).execute()
    return {"success": True, "question": result.data[0] if result.data else None}


@router.delete("/questions/{question_id}")
async def delete_faculty_question(
    question_id: str,
    faculty: dict = Depends(get_current_faculty)
):
    """Delete a question — branch-validated."""
    db = get_supabase()

    existing = db.table("questions").select("branch").eq("id", question_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Question not found")

    _check_branch_access(faculty, existing.data[0]["branch"])

    db.table("questions").delete().eq("id", question_id).execute()
    return {"success": True, "deleted": question_id}


# ── Live Monitor ──────────────────────────────────────────────
@router.get("/live-monitor")
async def get_live_monitor(faculty: dict = Depends(get_current_faculty)):
    """Get active student count and recent alerts for faculty's branches and exams."""
    db = get_supabase()
    allowed_branches = _get_branch_filter(faculty)
    faculty_exams = _get_faculty_exams(faculty, db)

    # If non-admin faculty hasn't created any exams, they have 0 active students
    if faculty_exams is not None and not faculty_exams:
        return {"active_count": 0, "active_students": [], "recent_alerts": []}

    # Active students count
    status_query = db.table("exam_status").select("id, student_id, exam_name, status, warnings, last_active, started_at").eq("status", "active")
    if faculty_exams:
        status_query = status_query.in_("exam_name", faculty_exams)

    status_res = status_query.execute()

    active_students = []
    for s in (status_res.data or []):
        student_res = db.table("students").select("branch, name, usn").eq("id", s["student_id"]).execute()
        if student_res.data:
            s_data = student_res.data[0]
            s["student_name"] = s_data.get("name")
            s["student_usn"] = s_data.get("usn")
            s["branch"] = s_data.get("branch")
            
            # Filter out students not in branch, ONLY IF we are not already filtering by faculty's specific exams
            if allowed_branches and not faculty_exams and s_data.get("branch") not in allowed_branches:
                continue
                
            active_students.append(s)

    # Recent alerts (last 1 hour)
    alerts_query = db.table("live_alerts").select("*").order("created_at", desc=True).limit(50)
    if allowed_branches:
        alerts_query = alerts_query.in_("branch", allowed_branches)
    if faculty_exams:
        alerts_query = alerts_query.in_("exam_name", faculty_exams)
    alerts_res = alerts_query.execute()

    # Question count
    q_count = 0
    if faculty_exams:
        q_count_res = db.table("questions").select("id", count="exact").in_("exam_name", faculty_exams).execute()
        q_count = q_count_res.count if q_count_res else 0

    return {
        "active_count": len(active_students),
        "active_students": active_students,
        "recent_alerts": alerts_res.data or [],
        "question_count": q_count
    }


# ── Results & Export ──────────────────────────────────────────
@router.get("/results")
async def get_faculty_results(
    exam_name: Optional[str] = None,
    branch: Optional[str] = None,
    faculty: dict = Depends(get_current_faculty)
):
    """Fetch exam results filtered by faculty's branches and exams."""
    db = get_supabase()
    allowed_branches = _get_branch_filter(faculty)
    faculty_exams = _get_faculty_exams(faculty, db)

    if branch:
        _check_branch_access(faculty, branch)

    if faculty_exams is not None and not faculty_exams:
        return {"results": [], "total": 0}

    # Fetch results with student info
    results_query = db.table("exam_results").select("*").order("submitted_at", desc=True)
    if exam_name:
        results_query = results_query.ilike("exam_name", f"%{exam_name}%")
    if faculty_exams:
        results_query = results_query.in_("exam_name", faculty_exams)
    results_res = results_query.execute()

    enriched = []
    for r in (results_res.data or []):
        student_res = db.table("students").select("name, usn, branch, email").eq("id", r["student_id"]).execute()
        if student_res.data:
            s = student_res.data[0]
            
            # Apply branch filter only if we are not restricting by faculty_exams
            if allowed_branches and not faculty_exams and s.get("branch") not in allowed_branches:
                continue
            if branch and s.get("branch") != branch:
                continue

            r["student_name"] = s.get("name")
            r["student_usn"] = s.get("usn")
            r["student_branch"] = s.get("branch")
            r["student_email"] = s.get("email")
            enriched.append(r)

    return {"results": enriched, "total": len(enriched)}


@router.get("/results/export")
async def export_faculty_results(
    exam_name: Optional[str] = None,
    branch: Optional[str] = None,
    faculty: dict = Depends(get_current_faculty)
):
    """Export results as XLSX for faculty's branches."""
    import io
    import xlsxwriter

    # Reuse the results endpoint logic
    results_data = await get_faculty_results(exam_name=exam_name, branch=branch, faculty=faculty)
    results = results_data["results"]

    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {"in_memory": True})
    worksheet = workbook.add_worksheet("Results")

    # Headers
    headers = ["USN", "Name", "Branch", "Email", "Score", "Total Marks", "Percentage", "Submitted At", "Exam"]
    header_format = workbook.add_format({"bold": True, "bg_color": "#1a1a2e", "font_color": "#e0e0e0"})
    for col, h in enumerate(headers):
        worksheet.write(0, col, h, header_format)

    # Data rows
    for row_idx, r in enumerate(results, 1):
        score = r.get("score", 0) or 0
        total = r.get("total_marks", 0) or 0
        pct = round((score / total * 100), 1) if total > 0 else 0

        worksheet.write(row_idx, 0, r.get("student_usn", ""))
        worksheet.write(row_idx, 1, r.get("student_name", ""))
        worksheet.write(row_idx, 2, r.get("student_branch", ""))
        worksheet.write(row_idx, 3, r.get("student_email", ""))
        worksheet.write(row_idx, 4, score)
        worksheet.write(row_idx, 5, total)
        worksheet.write(row_idx, 6, pct)
        worksheet.write(row_idx, 7, r.get("submitted_at", ""))
        worksheet.write(row_idx, 8, r.get("exam_name", ""))

    workbook.close()
    output.seek(0)

    filename = f"results_{branch or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── Profile ───────────────────────────────────────────────────
@router.get("/profile")
async def get_faculty_profile(faculty: dict = Depends(get_current_faculty)):
    """Get current faculty profile."""
    return {
        "faculty_id": faculty["faculty_id"],
        "name": faculty["name"],
        "email": faculty["email"],
        "branches": faculty["branches"],
        "is_admin": faculty.get("is_admin", False)
    }
