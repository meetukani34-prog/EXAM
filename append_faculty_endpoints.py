import os

faculty_py_path = r"c:\EXAM_new\EXAM\backend\routers\faculty.py"

endpoints_code = """
# ── Student Management (Faculty Scoped) ───────────────────────────────────

def _check_student_access(student_id: str, faculty: dict, db) -> dict:
    \"\"\"
    Check if the faculty has access to the student.
    Returns the student dict if access is granted.
    \"\"\"
    if faculty.get("is_admin"):
        student_res = db.table("students").select("*").eq("id", student_id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found")
        return student_res.data[0]

    student_res = db.table("students").select("*").eq("id", student_id).execute()
    if not student_res.data:
        raise HTTPException(status_code=404, detail="Student not found")
    student = student_res.data[0]

    # Faculty allowed branches
    allowed_branches = faculty.get("branches", [])
    if student.get("branch") in allowed_branches:
        return student
    
    # Or if student took an exam belonging to this faculty
    faculty_exams = _get_faculty_exams(faculty, db)
    if faculty_exams:
        status_res = db.table("exam_status").select("exam_name").eq("student_id", student_id).execute()
        taken_exams = {s["exam_name"] for s in (status_res.data or []) if s.get("exam_name")}
        if any(e in faculty_exams for e in taken_exams):
            return student
            
    raise HTTPException(status_code=403, detail="Access denied. Student not in your branches or exams.")


@router.get("/students", response_model=list[StudentStatus])
async def get_faculty_students(exam: Optional[str] = Query(None), current_faculty: dict = Depends(get_current_faculty)):
    try:
        db = get_supabase()
        
        # Build query for students based on faculty scope
        if current_faculty.get("is_admin"):
            result = db.table("students").select("*, exam_status(id, student_id, exam_name, status, warnings, last_active, submitted_at, started_at), odyssey_progress(current_round, round_1_state), exam_results(score, total_marks, exam_name)").execute()
        else:
            allowed_branches = current_faculty.get("branches", [])
            faculty_exams = _get_faculty_exams(current_faculty, db)
            
            # Since postgrest 'or' syntax with nested tables is complex, fetch all and filter in memory, 
            # or fetch students matching branches first
            # But the most robust way is to fetch all students, then filter.
            all_students_res = db.table("students").select("*, exam_status(id, student_id, exam_name, status, warnings, last_active, submitted_at, started_at), odyssey_progress(current_round, round_1_state), exam_results(score, total_marks, exam_name)").execute()
            
            filtered_data = []
            for s in (all_students_res.data or []):
                if s.get("branch") in allowed_branches:
                    filtered_data.append(s)
                    continue
                # check if student took any faculty exams
                e_statuses = s.get("exam_status") or []
                taken_exams = {st["exam_name"] for st in e_statuses if st.get("exam_name")}
                if faculty_exams and any(e in faculty_exams for e in taken_exams):
                    filtered_data.append(s)
                    
            # Wrap in a dummy object to match result structure
            class ResultWrapper:
                def __init__(self, data):
                    self.data = data
            result = ResultWrapper(filtered_data)

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

                score = 0.0
                total_marks = 100
                if e_results:
                    if exam:
                        matching_results = [r for r in e_results if (r.get("exam_name") or "").lower() == exam.lower()]
                        if matching_results:
                            res = matching_results[0]
                            score = res.get("score", 0.0)
                            total_marks = res.get("total_marks", 100)
                    else:
                        res = e_results[0]
                        score = res.get("score", 0.0)
                        total_marks = res.get("total_marks", 100)

                if score == 0 and round_1_state:
                    score = round_1_state.get("mcq_score", 0.0)
                    total_marks = round_1_state.get("mcq_total", 100)

                latest = None
                if exam:
                    specific = [e for e in e_statuses if (e.get("exam_name") or "").lower() == exam.lower()]
                    if specific:
                        def session_priority(st):
                            priority = {"active": 2, "submitted": 1, "not_started": 0}
                            return (priority.get(st.get("status"), -1), st.get("last_active") or "")
                        sorted_specific = sorted(specific, key=session_priority, reverse=True)
                        latest = sorted_specific[0]
                else:
                    if e_statuses:
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/students/{student_id}")
async def update_faculty_student(student_id: str, student: StudentUpdate, current_faculty: dict = Depends(get_current_faculty)):
    try:
        db = get_supabase()
        # Verify access
        _check_student_access(student_id, current_faculty, db)

        update_data = {k: v for k, v in student.dict(exclude_unset=True).items() if v is not None}
        if "password" in update_data:
            from core.security import get_password_hash
            update_data["password_hash"] = get_password_hash(update_data.pop("password"))

        if not update_data:
            return {"message": "No fields to update"}

        res = db.table("students").update(update_data).eq("id", student_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Student not found")
        return {"message": "Student updated successfully", "student": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/students/{student_id}/block")
async def block_faculty_student(student_id: str, current_faculty: dict = Depends(get_current_faculty)):
    try:
        db = get_supabase()
        _check_student_access(student_id, current_faculty, db)
        
        res = db.table("students").update({"is_blocked": True}).eq("id", student_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Student not found")
        return {"message": "Student blocked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/students/{student_id}/unblock")
async def unblock_faculty_student(student_id: str, current_faculty: dict = Depends(get_current_faculty)):
    try:
        db = get_supabase()
        _check_student_access(student_id, current_faculty, db)
        
        res = db.table("students").update({"is_blocked": False}).eq("id", student_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Student not found")
        return {"message": "Student unblocked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/students/{student_id}")
async def delete_faculty_student(student_id: str, current_faculty: dict = Depends(get_current_faculty)):
    try:
        db = get_supabase()
        _check_student_access(student_id, current_faculty, db)
        
        # Foreign keys will cascade, or we manually delete records if necessary.
        res = db.table("students").delete().eq("id", student_id).execute()
        return {"message": "Student deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/students/{student_id}/reset-exam")
async def reset_faculty_student_exam(student_id: str, payload: FacultyExamResetRequest, current_faculty: dict = Depends(get_current_faculty)):
    try:
        db = get_supabase()
        _check_student_access(student_id, current_faculty, db)
        
        exam_name = payload.exam_name
        
        # Verify faculty has access to this exam
        faculty_exams = _get_faculty_exams(current_faculty, db)
        if not current_faculty.get("is_admin") and exam_name not in faculty_exams:
            raise HTTPException(status_code=403, detail="Access denied to this exam.")
            
        # Delete exam_status for this student and exam
        db.table("exam_status").delete().eq("student_id", student_id).eq("exam_name", exam_name).execute()
        
        # Delete exam_results for this student and exam
        db.table("exam_results").delete().eq("student_id", student_id).eq("exam_name", exam_name).execute()
        
        # Delete student_responses for this student and exam
        db.table("student_responses").delete().eq("student_id", student_id).eq("exam_name", exam_name).execute()
        
        # Also clean up telemetry logs related to this student
        # Since live_alerts and coding_events don't cleanly cascade on exam_name all the time, we do our best
        db.table("live_alerts").delete().eq("student_id", student_id).eq("exam_name", exam_name).execute()
        
        return {"message": f"Exam '{exam_name}' reset successfully for the student."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""

with open(faculty_py_path, "a", encoding="utf-8") as f:
    f.write("\n" + endpoints_code + "\n")

print("Endpoints appended to faculty.py")
