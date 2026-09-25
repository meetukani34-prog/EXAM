from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta

from models.schemas import (
    LoginRequest, LoginResponse, SupportRequestCreate,
    SendSignupOtpRequest, VerifySignupOtpRequest,
    SendLoginOtpRequest, VerifyLoginOtpRequest,
    GoogleLoginRequest
)
from core.security import verify_password, hash_password, create_access_token, get_current_student
from core.config import get_settings
from db.supabase_client import get_supabase
from services.email_service import send_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def mask_email(email: str) -> str:
    """Mask email address for privacy (e.g. j***e@domain.com)."""
    if not email or "@" not in email:
        return email
    parts = email.split("@", 1)
    user, domain = parts[0], parts[1]
    if len(user) <= 2:
        masked_user = user[0] + "*" if user else "*"
    else:
        masked_user = user[0] + "*" * (len(user) - 2) + user[-1]
    return f"{masked_user}@{domain}"


async def _build_login_response_for_student(
    student: dict,
    req_name: Optional[str] = None,
    req_email: Optional[str] = None,
    req_branch: Optional[str] = None,
    req_year: Optional[str] = None
) -> LoginResponse:
    """Helper to generate JWT, update session, fetch exam config, and return LoginResponse."""
    db = get_supabase()

    # Clear stale active session if present
    try:
        db.table("students").update(
            {"is_active_session": False, "current_token": None}
        ).eq("id", student["id"]).execute()
    except Exception:
        pass

    # Create JWT token
    student_id_val = student.get("usn") or student.get("roll_number") or ""
    current_branch = req_branch or student.get("branch", "CS")
    current_name = req_name or student.get("name", "Student")
    token = create_access_token(
        data={
            "sub": student["id"],
            "usn": student_id_val,
            "name": current_name,
            "branch": current_branch
        }
    )

    # Mark session active + record token
    try:
        update_student_data: Dict[str, Any] = {"is_active_session": True, "current_token": token}
        if req_name: update_student_data["name"] = req_name
        if req_email: update_student_data["email"] = req_email
        if req_branch: update_student_data["branch"] = req_branch
        if req_year: update_student_data["year"] = req_year

        db.table("students").update(update_student_data).eq("id", student["id"]).execute()
    except Exception as e:
        print(f"[AUTH] Optional student update note: {e}")

    # Ensure exam_status row exists
    started_at = None
    try:
        exam_status_res = (
            db.table("exam_status")
            .select("status, started_at, submitted_at")
            .eq("student_id", student["id"])
            .limit(1)
            .execute()
        )
        if exam_status_res.data and len(exam_status_res.data) > 0:
            row = exam_status_res.data[0]
            if row.get("status") == "active":
                started_at = row.get("started_at")
        else:
            db.table("exam_status").insert(
                {"student_id": student["id"], "status": "not_started", "warnings": 0}
            ).execute()
    except Exception as e:
        print(f"[AUTH] exam_status note: {e}")

    # Fetch active exam config
    exam_conf = (
        db.table("exam_config")
        .select("exam_title, duration_minutes, total_questions")
        .eq("is_active", True)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )

    current_exam_title = "Initial Assessment"
    current_duration = 20
    current_total_questions = 30

    if exam_conf.data and len(exam_conf.data) > 0:
        current_exam_title = exam_conf.data[0].get("exam_title", current_exam_title)
        current_duration = exam_conf.data[0].get("duration_minutes") or 20
        current_total_questions = exam_conf.data[0].get("total_questions", current_total_questions)

    try:
        q_count = db.table("questions").select("id", count="exact").eq("branch", current_branch).eq("exam_name", current_exam_title).execute()
        if not q_count.count:
            q_count = db.table("questions").select("id", count="exact").eq("exam_name", current_exam_title).execute()
        if not q_count.count:
            q_count = db.table("questions").select("id", count="exact").eq("branch", current_branch).ilike("exam_name", f"%{current_exam_title}%").execute()
        if not q_count.count:
            q_count = db.table("questions").select("id", count="exact").ilike("exam_name", f"%{current_exam_title}%").execute()
        if q_count.count and q_count.count > 0:
            current_total_questions = q_count.count
    except Exception as e:
        print(f"[AUTH] Error counting questions: {e}")

    return LoginResponse(
        access_token=token,
        student_id=student["id"],
        student_name=req_name or student.get("name"),
        email=req_email or student.get("email"),
        branch=current_branch,
        year=req_year or student.get("year", "1st Year"),
        exam_start_time=started_at,
        exam_duration_minutes=current_duration,
        exam_title=current_exam_title,
        total_questions=current_total_questions,
        avatar_url=student.get("avatar_url")
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate student with USN + password.
    Enforces single-session: rejects login if another device is already active.
    Returns JWT + exam timing info.
    """
    db = get_supabase()

    # 1. Find student by USN (with fallback for roll_number)
    try:
        # Try new 'usn' column first
        result = (
            db.table("students")
            .select("id, usn, email, name, branch, password_hash, is_active_session, current_token, is_blocked, avatar_url")
            .eq("usn", request.usn.strip().upper())
            .limit(1)
            .execute()
        )
    except Exception as e:
        # Fallback to old 'roll_number' column if 'usn' doesn't exist yet
        try:
            result = (
                db.table("students")
                .select("*") 
                .eq("roll_number", request.usn.strip().upper())
                .limit(1)
                .execute()
            )
        except Exception:
            raise e

    if not result.data or len(result.data) == 0:
        # ── AUTO-REGISTRATION LOGIC ──
        # Since student not found, create them. Make sure Name and Email are provided!
        if not request.name or not request.name.strip():
            raise HTTPException(status_code=400, detail="Full Name is required for registration.")
        if not request.email or not request.email.strip():
            raise HTTPException(status_code=400, detail="Email Address is required for registration.")

        try:
            # ── Dynamic Schema Discovery for Registration ──
            probe = db.table("students").select("*").limit(1).execute()
            db_columns = list(probe.data[0].keys()) if (probe.data and len(probe.data) > 0) else [
                "id", "roll_number", "email", "name", "branch", "password_hash"
            ]

            # Create the student record
            new_student_data = {
                "usn": request.usn.strip().upper(),
                "roll_number": request.usn.strip().upper(), # Sync legacy column
                "name": request.name.strip(),
                "email": request.email.strip(),
                "branch": request.branch or "CS",
                "year": request.year or "1st Year",
                "password_hash": hash_password(request.password)
            }
            # Only keep fields that exist in the DB
            safe_data = {k: v for k, v in new_student_data.items() if k in db_columns}
            
            insert_res = db.table("students").insert(safe_data).execute()
            if not insert_res.data:
                raise HTTPException(status_code=500, detail="Failed to register student")
            
            student = insert_res.data[0]
            # Initialize exam_status for the new student
            try:
                db.table("exam_status").insert({"student_id": student["id"]}).execute()
            except Exception:
                pass  # Row may already exist
            
        except Exception as e:
            print(f"[AUTH] Auto-registration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")
    else:
        student = result.data[0]

    if not verify_password(request.password, student["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid roll number or password",
        )

    # 2.5 Check if student is blocked
    if student.get("is_blocked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been blocked by the administrator. You cannot attend the exam.",
        )

    # 3. Single-session enforcement — auto-clear stale sessions
    # Previous logic rejected with 409, but crashed pages leave stale sessions
    # that permanently lock students out. Now we just overwrite.
    is_active = student.get("is_active_session", False)
    if is_active:
        print(f"[AUTH] Clearing stale session for {student.get('usn', 'unknown')}")
        try:
            db.table("students").update(
                {"is_active_session": False, "current_token": None}
            ).eq("id", student["id"]).execute()
        except Exception:
            pass

    return await _build_login_response_for_student(
        student,
        req_name=request.name,
        req_email=request.email,
        req_branch=request.branch,
        req_year=request.year
    )


# ══════════════════════════════════════════════════════════════════
#  EMAIL OTP AUTHENTICATION (SIGNUP & LOGIN)
# ══════════════════════════════════════════════════════════════════

@router.post("/send-signup-otp")
async def send_signup_otp(request: SendSignupOtpRequest, background_tasks: BackgroundTasks):
    """
    Step 1 for Sign-Up:
    Validates USN and Email uniqueness, generates 6-digit OTP, dispatches email.
    """
    db = get_supabase()
    usn = request.usn.strip().upper()
    email = request.email.strip().lower()
    name = request.name.strip()

    if not usn:
        raise HTTPException(status_code=400, detail="USN is required")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required")
    if not name:
        raise HTTPException(status_code=400, detail="Full Name is required")
    if len(request.password) < 6 or len(request.password) > 16:
        raise HTTPException(status_code=400, detail="Password must be between 6 and 16 characters")

    # Check if USN already exists
    try:
        existing = db.table("students").select("id").eq("usn", usn).limit(1).execute()
        if existing.data and len(existing.data) > 0:
            raise HTTPException(status_code=400, detail=f"USN {usn} is already registered. Please sign in.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] USN existence check note: {e}")

    # Check if email is already used by another student
    try:
        existing_email = db.table("students").select("id, usn").eq("email", email).limit(1).execute()
        if existing_email.data and len(existing_email.data) > 0:
            raise HTTPException(status_code=400, detail=f"Email {email} is already associated with an account. Please sign in.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] Email existence check note: {e}")

    # Send OTP via background task
    background_tasks.add_task(send_otp, to_email=email, purpose="signup", name=name)

    return {
        "success": True,
        "message": f"Verification code sent to {email}",
        "email": email,
        "expires_in_seconds": settings.otp_expire_minutes * 60,
    }


@router.post("/verify-signup-otp", response_model=LoginResponse)
async def verify_signup_otp(request: VerifySignupOtpRequest):
    """
    Step 2 for Sign-Up:
    Verifies 6-digit OTP, creates the student record, initializes exam status, and logs them in.
    """
    db = get_supabase()
    usn = request.usn.strip().upper()
    email = request.email.strip().lower()

    valid = await verify_otp(email=email, otp=request.otp, purpose="signup")
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code. Please request a new one.")

    # Check if student was created in the meantime
    try:
        existing = db.table("students").select("*").eq("usn", usn).limit(1).execute()
        if existing.data and len(existing.data) > 0:
            student = existing.data[0]
        else:
            # Dynamic schema discovery
            probe = db.table("students").select("*").limit(1).execute()
            db_columns = list(probe.data[0].keys()) if (probe.data and len(probe.data) > 0) else [
                "id", "usn", "roll_number", "email", "name", "branch", "password_hash"
            ]

            new_student_data = {
                "usn": usn,
                "roll_number": usn,
                "name": request.name.strip(),
                "email": email,
                "branch": request.branch or "DS",
                "year": request.year or "1st Year",
                "password_hash": hash_password(request.password)
            }
            safe_data = {k: v for k, v in new_student_data.items() if k in db_columns}
            insert_res = db.table("students").insert(safe_data).execute()
            if not insert_res.data:
                raise HTTPException(status_code=500, detail="Failed to register student record")
            student = insert_res.data[0]

            try:
                db.table("exam_status").insert({"student_id": student["id"]}).execute()
            except Exception:
                pass
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")

    return await _build_login_response_for_student(
        student,
        req_name=request.name,
        req_email=email,
        req_branch=request.branch,
        req_year=request.year
    )


@router.post("/send-login-otp")
async def send_login_otp(request: SendLoginOtpRequest, background_tasks: BackgroundTasks):
    """
    Step 1 for Login (Option A):
    Verifies USN + Password first. If valid, sends 6-digit OTP to student's registered email.
    """
    db = get_supabase()
    usn = request.usn.strip().upper()

    try:
        result = db.table("students").select("*").eq("usn", usn).limit(1).execute()
    except Exception:
        result = None

    if not result or not result.data or len(result.data) == 0:
        # Fallback to roll_number
        try:
            result = db.table("students").select("*").eq("roll_number", usn).limit(1).execute()
        except Exception:
            result = None

    if not result or not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Student account not found. Please register first.")

    student = result.data[0]

    # Verify password
    if not verify_password(request.password, student.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid USN or password.")

    # Check blocked
    if student.get("is_blocked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been blocked by the administrator."
        )

    student_email = student.get("email")
    if not student_email or "@" not in student_email:
        # Student registered before email was required
        return {
            "success": False,
            "email_required": True,
            "message": "No email address linked to your account. Please update profile or use direct login."
        }

    # Dispatch OTP via background task
    background_tasks.add_task(send_otp, to_email=student_email, purpose="login", name=student.get("name", "Student"))
    masked = mask_email(student_email)

    return {
        "success": True,
        "email_required": False,
        "masked_email": masked,
        "message": f"Verification code sent to {masked}",
        "expires_in_seconds": settings.otp_expire_minutes * 60
    }


@router.post("/verify-login-otp", response_model=LoginResponse)
async def verify_login_otp(request: VerifyLoginOtpRequest):
    """
    Step 2 for Login (Option A):
    Verifies 6-digit OTP sent to student's email, logs them in, and returns token + exam details.
    """
    db = get_supabase()
    usn = request.usn.strip().upper()

    try:
        result = db.table("students").select("*").eq("usn", usn).limit(1).execute()
    except Exception:
        result = None

    if not result or not result.data or len(result.data) == 0:
        try:
            result = db.table("students").select("*").eq("roll_number", usn).limit(1).execute()
        except Exception:
            result = None

    if not result or not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Student not found.")

    student = result.data[0]
    student_email = student.get("email")
    if not student_email:
        raise HTTPException(status_code=400, detail="No email address associated with this student.")

    valid = await verify_otp(email=student_email, otp=request.otp, purpose="login")
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    return await _build_login_response_for_student(student)


@router.post("/profile/update")
async def update_profile(
    update_data: Dict[str, Any], 
    current: dict = Depends(get_current_student)
):
    """Allow students to update their own profile info (name, email, avatar_url)."""
    db = get_supabase()
    
    # ── Dynamic Schema Discovery ──
    try:
        probe = db.table("students").select("*").limit(1).execute()
        db_columns = list(probe.data[0].keys()) if (probe.data and len(probe.data) > 0) else [
            "id", "usn", "email", "name", "branch"
        ]
    except Exception:
        db_columns = ["id", "usn", "email", "name", "branch"]

    # Filter allowed fields + ensure they exist in DB
    allowed = ["name", "email", "avatar_url"]
    to_update = {k: v for k, v in update_data.items() if k in allowed and k in db_columns}
    
    if not to_update:
        return {"message": "No valid fields to update or columns missing in DB"}
        
    try:
        db.table("students").update(to_update).eq("id", current["student_id"]).execute()
        return {"success": True, "updated_fields": list(to_update.keys())}
    except Exception as e:
        print(f"[AUTH] profile update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logout")
async def logout(current: dict = Depends(get_current_student)):
    """Clear session flag so student can log in from another device if needed."""
    db = get_supabase()
    db.table("students").update(
        {"is_active_session": False, "current_token": None}
    ).eq("id", current["student_id"]).execute()
    return {"logged_out": True}

@router.post("/session/reset", tags=["auth"])
async def reset_session(request: LoginRequest):
    """Allow a student to force-clear their own session if they get stuck 'logged in'."""
    db = get_supabase()
    
    # 1. Verify credentials first!
    result = db.table("students").select("*").eq("usn", request.usn.strip().upper()).execute()
    if not result.data:
        # Fallback for legacy USN/roll_number
        result = db.table("students").select("*").eq("roll_number", request.usn.strip().upper()).execute()
        
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid USN")
        
    student = result.data[0]
    if not verify_password(request.password, student["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid Password")
        
    # 2. Clear the session
    db.table("students").update(
        {"is_active_session": False, "current_token": None}
    ).eq("id", student["id"]).execute()
    
    return {"success": True, "message": "Session reset successfully. You can now login."}

@router.post("/google", response_model=LoginResponse, tags=["auth"])
async def google_login(request: GoogleLoginRequest):
    """Direct login or automatic signup for students using Google OAuth."""
    email = request.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address from Google")
    
    db = get_supabase()
    
    # 1. Look up student by email (case-insensitive)
    result = db.table("students").select("*").ilike("email", email).execute()
    student = None
    if result.data and len(result.data) > 0:
        student = result.data[0]
    else:
        # Check if USN matches the email prefix
        email_prefix = email.split("@")[0].upper()
        usn_result = db.table("students").select("*").ilike("usn", email_prefix).execute()
        if usn_result.data and len(usn_result.data) > 0:
            student = usn_result.data[0]
            try:
                db.table("students").update({"email": email}).eq("id", student["id"]).execute()
            except Exception:
                pass
        else:
            # Create a new student record
            student_name = request.name or email.split("@")[0].capitalize()
            import uuid
            new_student = {
                "usn": email_prefix[:30],
                "name": student_name,
                "email": email,
                "branch": "CS",
                "year": "1st Year",
                "password_hash": hash_password(str(uuid.uuid4())),
                "is_active_session": False,
            }
            if request.avatar_url:
                new_student["avatar_url"] = request.avatar_url
            ins_res = db.table("students").insert(new_student).execute()
            if not ins_res.data:
                raise HTTPException(status_code=500, detail="Failed to initialize student profile for Google account")
            student = ins_res.data[0]
            
    # Update avatar_url if provided and not present
    if request.avatar_url and not student.get("avatar_url"):
        try:
            db.table("students").update({"avatar_url": request.avatar_url}).eq("id", student["id"]).execute()
            student["avatar_url"] = request.avatar_url
        except Exception:
            pass

    return await _build_login_response_for_student(
        student,
        req_name=request.name or student.get("name"),
        req_email=email,
        req_branch=student.get("branch", "CS"),
        req_year=student.get("year", "1st Year")
    )
    
@router.post("/support", tags=["public"])
async def submit_support_request(request: SupportRequestCreate):
    """Public endpoint for students to submit help requests."""
    db = get_supabase()
    try:
        data = {
            "usn": request.usn.strip().upper(),
            "problem": request.problem.strip()
        }
        res = db.table("support_requests").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to save request")
        return {"success": True, "message": "Support request submitted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
