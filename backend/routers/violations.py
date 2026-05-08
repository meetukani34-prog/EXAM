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

        # 1. Fetch current status safely
        try:
            exam_status = db.table("exam_status").select("status, warnings").eq("student_id", student_id).single().execute()
            if exam_status.data:
                if exam_status.data["status"] == "submitted":
                    return ReportViolationResponse(warning_count=exam_status.data.get("warnings", 0), auto_submitted=False, message="Exam already submitted.")
                new_warnings = (exam_status.data.get("warnings") or 0) + 1
        except Exception:
            # Fallback if table/row missing
            new_warnings = 1

        # 2. Log violation safely
        try:
            # Map face violations to a type allowed by the DB check constraint if necessary
            db_type = request.type
            if db_type not in ["tab_switch", "window_blur", "fullscreen_exit", "right_click", "copy_attempt", "paste_attempt", "keyboard_shortcut", "auto_submitted"]:
                db_type = "keyboard_shortcut" # Use as a generic bucket for newer types

            db.table("violations").insert({
                "student_id": student_id,
                "type": db_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {** (request.metadata or {}), "original_type": request.type},
            }).execute()
        except Exception as e:
            print(f"[VIOLATIONS] DB Insert failed (check constraint?): {e}")
            pass

        # 3. Update warnings safely
        try:
            db.table("exam_status").update({
                "warnings": new_warnings,
                "last_active": datetime.now(timezone.utc).isoformat(),
            }).eq("student_id", student_id).execute()
        except Exception: pass

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
