from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone

from models.schemas import ReportViolationRequest, ReportViolationResponse
from core.security import get_current_student
from db.supabase_client import get_supabase

router = APIRouter(prefix="/exam", tags=["violations"])

VALID_VIOLATION_TYPES = {
    "tab_switch",
    "window_blur",
    "fullscreen_exit",
    "right_click",
    "copy_attempt",
    "paste_attempt",
    "keyboard_shortcut",
    "auto_submitted",
    "no_face_detected",
    "face_not_front",
    "multiple_faces",
}
AUTO_SUBMIT_THRESHOLD = 3
WARNING_1 = "⚠️ Warning 1: Please return to the exam and stay focused."
WARNING_2 = "🚨 Final warning! One more violation and your exam will be auto-submitted."
WARNING_3 = "⚠️ 3rd violation detected. Your exam has been auto-submitted."

@router.post("/report-violation", response_model=ReportViolationResponse)
async def report_violation(
    request: ReportViolationRequest,
    current: dict = Depends(get_current_student),
):
    db = get_supabase()
    student_id = current["student_id"]
    exam_title = request.exam_name or "General Assessment"
    
    try:
        # 1. Fetch current status
        current_warnings = 0
        status_res = db.table("exam_status").select("*").eq("student_id", student_id).execute()
        
        existing_row = None
        if status_res.data:
            existing_row = status_res.data[0]
            # If same exam, use existing warnings. Otherwise, it's a fresh start.
            if existing_row.get("exam_name") == exam_title:
                if existing_row.get("status") == "submitted":
                     return ReportViolationResponse(
                         warning_count=existing_row.get("warnings", 3),
                         auto_submitted=True,
                         message="Exam already submitted."
                     )
                current_warnings = existing_row.get("warnings") or 0
        
        # Increment
        new_warnings = current_warnings + 1
        
        # ── SAFETY RESET ──
        # If we transitioned to a new exam title, FORCE the first violation to be 1.
        if existing_row and existing_row.get("exam_name") != exam_title:
            new_warnings = 1

        # 2. Log violation
        db_type = request.type if request.type in VALID_VIOLATION_TYPES else "tab_switch"
        try:
            db.table("violations").insert({
                "student_id": student_id,
                "type": db_type,
                "exam_name": exam_title,
                "metadata": request.metadata
            }).execute()
        except: pass

        # 3. Upsert status
        db.table("exam_status").upsert({
            "student_id": student_id,
            "exam_name": exam_title,
            "warnings": new_warnings,
            "status": "submitted" if new_warnings >= AUTO_SUBMIT_THRESHOLD else "active",
            "last_active": datetime.now(timezone.utc).isoformat(),
            "submitted_at": datetime.now(timezone.utc).isoformat() if new_warnings >= AUTO_SUBMIT_THRESHOLD else None
        }, on_conflict="student_id").execute()

        # 4. Response
        auto_submitted = new_warnings >= AUTO_SUBMIT_THRESHOLD
        if auto_submitted:
            message = WARNING_3
        elif new_warnings == 2:
            message = WARNING_2
        else:
            message = WARNING_1

        return ReportViolationResponse(
            warning_count=new_warnings,
            auto_submitted=auto_submitted,
            message=message,
        )

    except Exception as e:
        print(f"[VIOLATIONS] Critical Error: {e}")
        return ReportViolationResponse(
            warning_count=1,
            auto_submitted=False,
            message="⚠️ Stay focused on the exam."
        )
