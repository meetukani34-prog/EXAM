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
        # 1. Fetch current warnings
        # We search for an EXACT match for this exam first.
        # If no record exists for this specific exam, we are starting fresh (0 warnings).
        status_res = db.table("exam_status").select("warnings, id, status")\
            .eq("student_id", student_id)\
            .eq("exam_name", exam_title)\
            .order("updated_at", desc=True)\
            .limit(1)\
            .execute()
        
        current_warnings = 0
        record_id = None
        
        if status_res.data:
            row = status_res.data[0]
            # If the exam was already submitted, we don't increment further (though UI should prevent this)
            if row.get("status") == "submitted":
                return ReportViolationResponse(
                    warning_count=row.get("warnings", 3),
                    auto_submitted=True,
                    message=WARNING_3_PYHUNT if exam_title.lower() == "pyhunt" else WARNING_3
                )
            
            current_warnings = row.get("warnings", 0)
            record_id = row.get("id")
            print(f"[VIOLATION] Found record {record_id} for {exam_title}. Current warnings: {current_warnings}")
        else:
            # Fallback: Check if there's ANY active session for this student
            # to prevent them from "escaping" warnings by changing exam names (unlikely but possible)
            active_res = db.table("exam_status").select("warnings, id, exam_name")\
                .eq("student_id", student_id)\
                .eq("status", "active")\
                .order("updated_at", desc=True)\
                .limit(1)\
                .execute()
            
            if active_res.data:
                row = active_res.data[0]
                current_warnings = row.get("warnings", 0)
                record_id = row.get("id")
                print(f"[VIOLATION] Found active record {record_id} ({row.get('exam_name')}). Current: {current_warnings}")
            else:
                print(f"[VIOLATION] No record found. Starting fresh for {student_id}")

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

        # 3. Update exam_status with ATOMIC increment
        # We use a raw RPC call or a clever update if supported. 
        # Since we're using postgrest-py, we'll use the 'id' if we have it, or filters.
        # To make it atomic in Postgrest without RPC, we use a single query that increments.
        try:
            # Atomic increment: update warnings = warnings + 1
            # Note: postgrest-py doesn't have a direct .inc(), so we use a RPC if available
            # or a single UPDATE with a filter.
            # However, for simplicity and reliability, we'll use an RPC 'increment_warnings'
            rpc_res = db.rpc("increment_warnings", {
                "t_student_id": student_id,
                "t_exam_name": exam_title,
                "t_threshold": AUTO_SUBMIT_THRESHOLD
            }).execute()
            
            if rpc_res.data:
                res_data = rpc_res.data
                new_warnings = res_data.get("new_warnings", current_warnings + 1)
                auto_submitted = res_data.get("auto_submitted", False)
            else:
                # Fallback to manual if RPC fails (e.g. not created)
                new_warnings = current_warnings + 1
                auto_submitted = new_warnings >= AUTO_SUBMIT_THRESHOLD
                update_data = {
                    "warnings": new_warnings,
                    "status": "submitted" if auto_submitted else "active",
                    "updated_at": "now()"
                }
                if auto_submitted: update_data["submitted_at"] = "now()"
                
                if record_id:
                    db.table("exam_status").update(update_data).eq("id", record_id).execute()
                else:
                    db.table("exam_status").update(update_data).eq("student_id", student_id).eq("exam_name", exam_title).execute()
            
            print(f"[VIOLATION] DB updated. Warnings: {new_warnings}")
        except Exception as e:
            print(f"[VIOLATION] DB update failed, falling back to manual: {e}")
            new_warnings = current_warnings + 1
            auto_submitted = new_warnings >= AUTO_SUBMIT_THRESHOLD

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
