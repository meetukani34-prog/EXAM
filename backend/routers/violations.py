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
# Final message overrides for clarity
WARNING_1 = "⚠️ Warning 1: Please return to the exam and stay focused."
WARNING_2 = "🚨 Final warning! One more violation and your exam will be auto-submitted."
WARNING_3 = "⚠️ 3rd violation detected. Your exam has been auto-submitted."


@router.post("/report-violation", response_model=ReportViolationResponse)
async def report_violation(
    request: ReportViolationRequest,
    current: dict = Depends(get_current_student),
):
    """
    Log a cheating violation event.
    Increments warning count.
    At threshold (3), triggers auto-submit signal.
    """
    db = get_supabase()
    student_id = current["student_id"]
    new_warnings = 1
    
    try:
        # Validate type
        if request.type not in VALID_VIOLATION_TYPES:
             return ReportViolationResponse(warning_count=1, auto_submitted=False, message="⚠️ Stay focused on the exam.")

        # 1. Fetch current status safely (per-student, then check exam_name)
        exam_title = request.exam_name or "General Assessment"
        current_warnings = 0
        try:
            # We fetch by student_id since it's UNIQUE in the schema
            status_res = db.table("exam_status").select("*").eq("student_id", student_id).execute()
            if status_res.data:
                row = status_res.data[0]
                
                # If the record is for a DIFFERENT exam, we treat it as a fresh start for the new exam
                if row.get("exam_name") != exam_title:
                    current_warnings = 0
                else:
                    if row["status"] == "submitted":
                        return ReportViolationResponse(warning_count=row.get("warnings", 0), auto_submitted=False, message="Exam already submitted.")
                    current_warnings = row.get("warnings") or 0
        except Exception as e:
            print(f"[VIOLATIONS] Status fetch failed: {e}")

        new_warnings = current_warnings + 1

        # 2. Log violation safely
        db_type = request.type
        if db_type not in ["tab_switch", "window_blur", "fullscreen_exit", "no_face_detected", "face_not_front", "multiple_faces"]:
             db_type = "tab_switch"
             
        try:
            db.table("violations").insert({
                "student_id": student_id,
                "type": db_type,
                "exam_name": exam_title,
                "metadata": request.metadata
            }).execute()
        except Exception as e:
            print(f"[VIOLATIONS] DB Insert failed: {e}")

        # 3. Update warning count on exam_status (MANDATORY UPSERT)
        try:
            # Use student_id as the ONLY conflict target since it's the unique key in schema
            db.table("exam_status").upsert({
                "student_id": student_id,
                "exam_name": exam_title,
                "warnings": new_warnings,
                "status": "active",
                "last_active": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="student_id").execute()
        except Exception as e:
            print(f"[VIOLATIONS] Status upsert failed: {e}")

        # 4. Determine response
        auto_submitted = False
        if new_warnings >= AUTO_SUBMIT_THRESHOLD:
            auto_submitted = True
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
        print(f"[VIOLATIONS] Critical failure: {e}")
        # ABSOLUTE FALLBACK: Never auto-submit on a system error!
        return ReportViolationResponse(
            warning_count=1,
            auto_submitted=False,
            message="⚠️ Connection unstable. Please stay on the exam screen."
        )
