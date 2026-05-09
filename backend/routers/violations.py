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
# Standard Messages
WARNING_1 = "⚠️ Warning 1: Please return to the exam and stay focused."
WARNING_2 = "🚨 Final warning! One more violation and your exam will be auto-submitted."
WARNING_3 = "⚠️ 3rd violation detected. Your exam has been auto-submitted."

# PyHunt Specific (Immersive Theme)
WARNING_1_PYHUNT = "🧬 LOGIC DESYNC: Warning 1. Maintain crystalline focus on the nodes."
WARNING_2_PYHUNT = "☣️ CRITICAL INSTABILITY: Warning 2. One more desync will terminate the mission."
WARNING_3_PYHUNT = "💀 SESSION DEAUTHORIZED: 3rd violation. Logic engine has been auto-submitted."

@router.post("/report-violation", response_model=ReportViolationResponse)
async def report_violation(
    request: ReportViolationRequest,
    current: dict = Depends(get_current_student),
):
    db = get_supabase()
    student_id = current["student_id"]
    exam_title = request.exam_name or "General Assessment"
    
    print(f"[VIOLATION] Reporting {request.type} for {student_id} on {exam_title}")

    try:
        # 1. Fetch current warnings (Direct query by student_id AND exam_name)
        # This ensures we don't pick up warnings from a previous/different exam
        status_res = db.table("exam_status").select("warnings, id")\
            .eq("student_id", student_id)\
            .eq("exam_name", exam_title)\
            .order("updated_at", desc=True)\
            .limit(1)\
            .execute()
        
        current_warnings = 0
        record_id = None
        if status_res.data:
            current_warnings = status_res.data[0].get("warnings", 0)
            record_id = status_res.data[0].get("id")
            print(f"[VIOLATION] Found record {record_id}. Current warnings: {current_warnings}")
        else:
            print(f"[VIOLATION] No record found for student {student_id} on {exam_title}")

        # Increment
        new_warnings = current_warnings + 1
        print(f"[VIOLATION] New warnings: {new_warnings}")

        # 2. Log violation in history
        try:
            db_type = request.type if request.type in VALID_VIOLATION_TYPES else "tab_switch"
            db.table("violations").insert({
                "student_id": student_id,
                "type": db_type,
                "exam_name": exam_title,
                "metadata": request.metadata
            }).execute()
        except Exception as e:
            print(f"[VIOLATION] History log failed: {e}")

        # 3. Update exam_status
        auto_submitted = new_warnings >= AUTO_SUBMIT_THRESHOLD
        update_data = {
            "warnings": new_warnings,
            "status": "submitted" if auto_submitted else "active",
            "last_active": "now()",
            "updated_at": "now()"
        }
        
        if auto_submitted:
            update_data["submitted_at"] = "now()"

        try:
            # Perform update specifically for this session
            if record_id:
                db.table("exam_status").update(update_data).eq("id", record_id).execute()
            else:
                # Fallback if record not found (shouldn't happen with proper start_exam)
                db.table("exam_status").update(update_data)\
                    .eq("student_id", student_id)\
                    .eq("exam_name", exam_title)\
                    .execute()
            print(f"[VIOLATION] DB updated for {student_id}")
        except Exception as e:
            print(f"[VIOLATION] DB update failed: {e}")

        # 4. Response
        is_pyhunt = exam_title.lower() == "pyhunt"
        if auto_submitted:
            message = WARNING_3_PYHUNT if is_pyhunt else WARNING_3
        elif new_warnings == 2:
            message = WARNING_2_PYHUNT if is_pyhunt else WARNING_2
        else:
            message = WARNING_1_PYHUNT if is_pyhunt else WARNING_1

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
