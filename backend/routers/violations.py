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

        # 1. Fetch current status safely for this specific exam
        exam_title = request.exam_name or "General Assessment"
        try:
            status_res = db.table("exam_status").select("status, warnings").eq("student_id", student_id).eq("exam_name", exam_title).execute()
            if status_res.data:
                row = status_res.data[0]
                if row["status"] == "submitted":
                    return ReportViolationResponse(warning_count=row.get("warnings", 0), auto_submitted=False, message="Exam already submitted.")
                new_warnings = (row.get("warnings") or 0) + 1
        except Exception as e:
            print(f"[VIOLATIONS] Status fetch failed for {exam_title}: {e}")
            new_warnings = 1

        # 2. Log violation safely (Mapping types to valid DB constraints)
        db_type = request.type
        if db_type not in ["tab_switch", "window_blur", "fullscreen_exit", "no_face_detected", "face_not_front", "multiple_faces"]:
             db_type = "tab_switch" # Fallback for DB constraint
             
        try:
            db.table("violations").insert({
                "student_id": student_id,
                "type": db_type,
                "exam_name": exam_title,
                "metadata": request.metadata
            }).execute()
        except Exception as e:
            print(f"[VIOLATIONS] DB Insert failed (check constraint?): {e}")
            pass

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
