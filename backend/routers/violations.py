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
        status_res = db.table("exam_status").select("warnings, id, status")\
            .eq("student_id", student_id)\
            .eq("exam_name", exam_title)\
            .execute()
        
        current_warnings = 0
        record_id = None
        current_status = "active"

        if status_res.data and len(status_res.data) > 0:
            # Pick the most relevant record
            record = status_res.data[0]
            current_warnings = record.get("warnings", 0)
            record_id = record.get("id")
            current_status = record.get("status", "active")
            print(f"[VIOLATION] Found record {record_id} for {exam_title}. Current warnings: {current_warnings}")
        else:
            # ── Session Auto-Init ──
            # If no record exists for this specific exam, create it now to prevent jump/stale state
            print(f"[VIOLATION] No record for {exam_title}. Initializing fresh session.")
            try:
                new_record = db.table("exam_status").insert({
                    "student_id": student_id,
                    "exam_name": exam_title,
                    "status": "active",
                    "warnings": 0,
                    "started_at": datetime.now(timezone.utc).isoformat()
                }).execute()
                if new_record.data:
                    record_id = new_record.data[0]["id"]
            except Exception as init_err:
                print(f"[VIOLATION] Session init failed: {init_err}")

        # Safety Guard: If student is already submitted, don't increment further (idempotency)
        if current_status == "submitted":
            return ReportViolationResponse(
                warning_count=current_warnings,
                auto_submitted=True,
                message=WARNING_3_PYHUNT if exam_title.lower() == "pyhunt" else WARNING_3
            )

        # Increment
        new_warnings = current_warnings + 1
        print(f"[VIOLATION] {student_id} -> {exam_title}: {current_warnings} -> {new_warnings}")

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
            "last_active": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if auto_submitted:
            update_data["submitted_at"] = datetime.now(timezone.utc).isoformat()

        try:
            if record_id:
                db.table("exam_status").update(update_data).eq("id", record_id).execute()
            else:
                db.table("exam_status").update(update_data)\
                    .eq("student_id", student_id)\
                    .eq("exam_name", exam_title)\
                    .execute()
        except Exception as e:
            print(f"[VIOLATION] DB update failed: {e}")

        # 4. Response Message Selection
        is_pyhunt = exam_title.lower() == "pyhunt"
        if auto_submitted:
            message = WARNING_3_PYHUNT if is_pyhunt else WARNING_3
        elif new_warnings == 2:
            message = WARNING_2_PYHUNT if is_pyhunt else WARNING_2
        else:
            # Fallback to Warning 1 for anything else (handles 1 or recovery from weird states)
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
            message="⚠️ Logic Engine Status: Monitoring active. Please stay focused."
        )
