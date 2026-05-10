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
    is_pyhunt = exam_title.lower() == "pyhunt"

    print(f"[VIOLATION] Reporting {request.type} for {student_id} on {exam_title}")

    # ── Initialize defaults so they are ALWAYS defined ──
    new_warnings = 1
    auto_submitted = False

    try:
        # ─── Step 1: Read current warning count for THIS exam ───
        status_res = (
            db.table("exam_status")
            .select("warnings, id, status")
            .eq("student_id", student_id)
            .eq("exam_name", exam_title)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )

        current_warnings = 0
        record_id = None

        if status_res.data:
            row = status_res.data[0]

            # Already submitted? Don't increment, just return.
            if row.get("status") == "submitted":
                return ReportViolationResponse(
                    warning_count=row.get("warnings", 3),
                    auto_submitted=True,
                    message=WARNING_3_PYHUNT if is_pyhunt else WARNING_3,
                )

            current_warnings = row.get("warnings") or 0
            record_id = row.get("id")
            print(f"[VIOLATION] Record {record_id} for '{exam_title}'. Current warnings: {current_warnings}")
        else:
            print(f"[VIOLATION] No record for '{exam_title}'. Starting fresh at 0.")

        # ─── Step 2: Calculate new warning count ───
        new_warnings = current_warnings + 1
        auto_submitted = new_warnings >= AUTO_SUBMIT_THRESHOLD
        print(f"[VIOLATION] {current_warnings} → {new_warnings} (auto_submit={auto_submitted})")

        # ─── Step 3: Log violation in history table ───
        try:
            db_type = request.type if request.type in VALID_VIOLATION_TYPES else "tab_switch"
            db.table("violations").insert({
                "student_id": student_id,
                "type": db_type,
                "exam_name": exam_title,
                "metadata": request.metadata,
            }).execute()
        except Exception as log_err:
            print(f"[VIOLATION] History log failed (non-fatal): {log_err}")

        # ─── Step 4: Update exam_status with new warning count ───
        now_ts = datetime.now(timezone.utc).isoformat()
        update_data = {
            "warnings": new_warnings,
            "updated_at": now_ts,
        }
        if auto_submitted:
            update_data["status"] = "submitted"
            update_data["submitted_at"] = now_ts
        
        try:
            if record_id:
                # We have an exact record — update by ID
                db.table("exam_status").update(update_data).eq("id", record_id).execute()
            else:
                # No record found — try update by student+exam, then insert if nothing matched
                res = (
                    db.table("exam_status")
                    .update(update_data)
                    .eq("student_id", student_id)
                    .eq("exam_name", exam_title)
                    .execute()
                )
                # If update matched nothing, insert a new row
                if not res.data:
                    db.table("exam_status").insert({
                        "student_id": student_id,
                        "exam_name": exam_title,
                        "warnings": new_warnings,
                        "status": "submitted" if auto_submitted else "active",
                        "updated_at": now_ts,
                        **({"submitted_at": now_ts} if auto_submitted else {}),
                    }).execute()
            print(f"[VIOLATION] DB updated. Warnings: {new_warnings}")
        except Exception as db_err:
            print(f"[VIOLATION] DB update failed (non-fatal): {db_err}")

        # ─── Step 5: Build response message ───
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
        # Even on crash, return a safe response — never let the API 500
        return ReportViolationResponse(
            warning_count=new_warnings,
            auto_submitted=auto_submitted,
            message="⚠️ Stay focused on the exam.",
        )
