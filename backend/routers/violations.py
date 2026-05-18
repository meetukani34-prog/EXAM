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
    return "tab_switch"


@router.post("/report-violation", response_model=ReportViolationResponse)
async def report_violation(request: ReportViolationRequest, current: dict = Depends(get_current_student)):
    """
    Record a cheating violation and increment warning count.
    Uses atomic Postgres function (RPC) for thread-safety and robustness.
    """
    db = get_supabase()
    student_id = current["student_id"]
    exam_title = request.exam_name or "General Assessment"
    is_pyhunt = exam_title.lower() == "pyhunt"
    
    print(f"[VIOLATION] Reporting {request.type} for {student_id} on {exam_title} (Atomic)")

    try:
        # 1. Try the atomic RPC (Gold Standard)
        rpc_res = db.rpc("report_student_violation", {
            "p_student_id": student_id,
            "p_exam_name": exam_title,
            "p_violation_type": _safe_db_type(request.type),
            "p_violation_metadata": request.metadata or {}
        }).execute()

        if rpc_res.data and len(rpc_res.data) > 0:
            result = rpc_res.data[0]
            return ReportViolationResponse(
                warning_count=result["new_warning_count"],
                message=result["response_message"],
                auto_submitted=result["is_auto_submitted"]
            )
    except Exception as e:
        print(f"[VIOLATION] RPC failed: {e}")

    # 2. Fallback: Robust Manual Logic
    try:
        # 1. Fetch all matching statuses for student and exam
        status_res = db.table("exam_status").select("*").eq("student_id", student_id).execute()
        matches = []
        for r in (status_res.data or []):
            if (r.get("exam_name") or "").strip().lower() == exam_title.lower():
                matches.append(r)
        
        now_ts = datetime.now(timezone.utc).isoformat()
        
        if matches:
            matches.sort(key=lambda x: (x.get("warnings", 0) or 0, x.get("last_active") or ""), reverse=True)
            row = matches[0]
            
            record_id = row.get("id")
            new_warnings = (row.get("warnings", 0) or 0) + 1
            auto_submitted = new_warnings >= AUTO_SUBMIT_THRESHOLD
            
            db.table("exam_status").update({
                "warnings": new_warnings,
                "last_active": now_ts,
                "updated_at": now_ts,
                "status": "submitted" if auto_submitted else row.get("status", "active"),
                "submitted_at": now_ts if auto_submitted else row.get("submitted_at")
            }).eq("id", record_id).execute()
        else:
            new_warnings = 1
            auto_submitted = False
            db.table("exam_status").insert({
                "student_id": student_id,
                "exam_name": exam_title,
                "warnings": 1,
                "status": "active",
                "started_at": now_ts,
                "last_active": now_ts,
                "updated_at": now_ts
            }).execute()

        # Log violation history (Auxiliary - Don't let it crash the response)
        try:
            meta = request.metadata or {}
            meta["exam_name"] = exam_title
            log_payload = {
                "student_id": student_id,
                "type": _safe_db_type(request.type),
                "metadata": meta
            }
            # Only add exam_name if we suspect it exists, or just try it
            try:
                log_payload["exam_name"] = exam_title
                db.table("violations").insert(log_payload).execute()
            except Exception:
                # Fallback if exam_name column is missing
                del log_payload["exam_name"]
                db.table("violations").insert(log_payload).execute()
        except Exception: pass

        # ── Live Alert Injection (Faculty Real-Time Telemetry) ──
        try:
            student_info = db.table("students").select("name, usn, branch").eq("id", student_id).limit(1).execute()
            s_data = student_info.data[0] if student_info.data else {}
            alert_msg = f"{s_data.get('usn', 'Unknown')} — {request.type.replace('_', ' ').title()}"
            if auto_submitted:
                alert_msg += " [AUTO-SUBMITTED]"
            db.table("live_alerts").insert({
                "student_id": student_id,
                "student_usn": s_data.get("usn"),
                "student_name": s_data.get("name"),
                "exam_name": exam_title,
                "branch": s_data.get("branch"),
                "alert_type": _safe_db_type(request.type),
                "message": alert_msg,
                "metadata": request.metadata or {}
            }).execute()
        except Exception as alert_e:
            print(f"[ALERT] Live alert injection failed (non-fatal): {alert_e}")

        # Prepare messages
        if auto_submitted:
            msg = WARNING_3_PYHUNT if is_pyhunt else WARNING_3
        elif new_warnings == 2:
            msg = WARNING_2_PYHUNT if is_pyhunt else WARNING_2
        else:
            msg = WARNING_1_PYHUNT if is_pyhunt else WARNING_1

        return ReportViolationResponse(
            warning_count=new_warnings,
            message=msg,
            auto_submitted=auto_submitted
        )

    except Exception as fatal_e:
        print(f"[VIOLATION] Fatal error in fallback: {fatal_e}")
        return ReportViolationResponse(
            warning_count=1,
            message="⚠️ Focus desync detected. Please stay on the exam screen.",
            auto_submitted=False
        )
