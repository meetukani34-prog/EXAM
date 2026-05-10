from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone

from models.schemas import ReportViolationRequest, ReportViolationResponse
from core.security import get_current_student
from db.supabase_client import get_supabase

router = APIRouter(prefix="/exam", tags=["violations"])

# These are the ONLY types the DB CHECK constraint allows
DB_VALID_TYPES = {
    "tab_switch",
    "window_blur",
    "fullscreen_exit",
    "right_click",
    "copy_attempt",
    "paste_attempt",
    "keyboard_shortcut",
    "auto_submitted",
}
# Extra types from FaceMonitor that we accept but map to a DB-safe type
FACE_TYPES = {"no_face_detected", "face_not_front", "multiple_faces"}

AUTO_SUBMIT_THRESHOLD = 3

# Standard Messages
WARNING_1 = "⚠️ Warning 1: Please return to the exam and stay focused."
WARNING_2 = "🚨 Final warning! One more violation and your exam will be auto-submitted."
WARNING_3 = "⚠️ 3rd violation detected. Your exam has been auto-submitted."

# PyHunt Specific (Immersive Theme)
WARNING_1_PYHUNT = "🧬 LOGIC DESYNC: Warning 1. Maintain crystalline focus on the nodes."
WARNING_2_PYHUNT = "☣️ CRITICAL INSTABILITY: Warning 2. One more desync will terminate the mission."
WARNING_3_PYHUNT = "💀 SESSION DEAUTHORIZED: 3rd violation. Logic engine has been auto-submitted."


def _safe_db_type(raw_type: str) -> str:
    """Map any violation type to a DB-safe value that passes the CHECK constraint."""
    if raw_type in DB_VALID_TYPES:
        return raw_type
    # Face-related violations → store as 'tab_switch' to pass CHECK, real type in metadata
    return "tab_switch"


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
        # ─── Step 1: Read current warning count for THIS SPECIFIC exam ───
        # We query by both student_id and exam_name to ensure we don't 'steal' records from other exams
        status_res = (
            db.table("exam_status")
            .select("warnings, id, status")
            .eq("student_id", student_id)
            .eq("exam_name", exam_title)
            .execute()
        )

        current_warnings = 0
        record_id = None
        is_already_submitted = False

        if status_res.data:
            row = status_res.data[0]
            current_warnings = row.get("warnings") or 0
            record_id = row.get("id")
            if row.get("status") == "submitted":
                is_already_submitted = True
            
            print(f"[VIOLATION] Found record {record_id} for '{exam_title}', current_warnings={current_warnings}")
        else:
            print(f"[VIOLATION] No record found for student in '{exam_title}'. Starting at 0.")

        # If already submitted, don't increment further
        if is_already_submitted:
            return ReportViolationResponse(
                warning_count=current_warnings,
                auto_submitted=True,
                message=WARNING_3_PYHUNT if is_pyhunt else WARNING_3,
            )

        # ─── Step 2: Calculate new warning count ───
        new_warnings = current_warnings + 1
        auto_submitted = new_warnings >= AUTO_SUBMIT_THRESHOLD
        print(f"[VIOLATION] {current_warnings} → {new_warnings} (auto_submit={auto_submitted})")

        # ─── Step 3: Log violation in history table ───
        try:
            safe_type = _safe_db_type(request.type)
            # Build metadata — include original type if it was mapped
            meta = request.metadata or {}
            if request.type != safe_type:
                meta["original_type"] = request.type

            insert_data = {
                "student_id": student_id,
                "exam_name": exam_title,
                "type": safe_type,
                "metadata": meta,
            }
            db.table("violations").insert(insert_data).execute()
        except Exception as log_err:
            print(f"[VIOLATION] History log failed (non-fatal): {log_err}")

        # ─── Step 4: Update/Upsert exam_status ───
        now_ts = datetime.now(timezone.utc).isoformat()
        upsert_data = {
            "student_id": student_id,
            "exam_name": exam_title,
            "warnings": new_warnings,
            "updated_at": now_ts,
            "last_active": now_ts,
            "status": "submitted" if auto_submitted else "active",
        }
        if auto_submitted:
            upsert_data["submitted_at"] = now_ts

        try:
            # Atomic upsert using the composite key (student_id, exam_name)
            db.table("exam_status").upsert(upsert_data, on_conflict="student_id, exam_name").execute()
            print(f"[VIOLATION] DB updated successfully.")
        except Exception as db_err:
            print(f"[VIOLATION] DB update failed: {db_err}")
            # Fallback to ID-based update if upsert fails for some reason
            if record_id:
                db.table("exam_status").update(upsert_data).eq("id", record_id).execute()

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
        return ReportViolationResponse(
            warning_count=new_warnings,
            auto_submitted=auto_submitted,
            message="⚠️ Stay focused on the exam.",
        )
