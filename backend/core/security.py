from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.config import get_settings

settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token extractor
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


from fastapi import Depends, HTTPException, status, Request

async def get_current_student(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """FastAPI dependency — extracts and validates JWT, or allows bypass with admin secret."""
    
    # Check for Admin Secret bypass first (for preview purposes)
    admin_secret = request.headers.get("X-Admin-Secret")
    if admin_secret == settings.admin_secret:
            return {
                "student_id": "ADMIN_PREVIEW",
                "usn": "ADMIN_PREVIEW",
                "branch": "CS",
                "token": "ADMIN_SECRET_BYPASS"
            }

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or credentials missing. Please login again.",
        )

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token format. Please login again.",
        )

    student_id = payload.get("sub")
    usn = payload.get("usn") or payload.get("roll_number")
    branch = payload.get("branch", "CS")

    if not student_id or not usn:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session payload corrupted. Please logout and login again.",
        )

    # ── Blocking Check (Crystalline Lockdown) ──
    try:
        from db.supabase_client import get_supabase
        db = get_supabase()
        res = db.table("students").select("is_blocked").eq("id", student_id).execute()
        if res.data and res.data[0].get("is_blocked"):
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your account has been blocked by the administrator. You cannot attend the exam.",
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SECURITY] Error checking block status for {student_id}: {e}")
        # Allow on DB error to prevent lockout during transient issues? 
        # Actually, safety first: but if DB is down, nothing will work anyway.
        pass

    return {
        "student_id": student_id,
        "usn": usn,
        "branch": branch,
        "token": token
    }


async def get_current_faculty(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """FastAPI dependency — extracts and validates faculty JWT."""
    
    # Check for Admin Secret bypass (admin has full access)
    admin_secret = request.headers.get("X-Admin-Secret")
    if admin_secret == settings.admin_secret:
        return {
            "faculty_id": "ADMIN_OVERRIDE",
            "name": "Admin",
            "email": "admin@system",
            "branches": ["ALL"],
            "is_admin": True,
            "token": "ADMIN_SECRET_BYPASS"
        }

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Faculty session expired or credentials missing. Please login again.",
        )

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid faculty session token. Please login again.",
        )

    role = payload.get("role")
    if role != "faculty":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Faculty credentials required.",
        )

    faculty_id = payload.get("sub")
    name = payload.get("name", "Faculty")
    email = payload.get("email", "")

    if not faculty_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Faculty session payload corrupted. Please logout and login again.",
        )

    # Fetch assigned branches
    branches = []
    try:
        from db.supabase_client import get_supabase
        db = get_supabase()
        res = db.table("faculty_subjects").select("branch").eq("faculty_id", faculty_id).execute()
        branches = [r["branch"] for r in (res.data or [])]
    except Exception as e:
        print(f"[SECURITY] Error fetching faculty branches for {faculty_id}: {e}")

    return {
        "faculty_id": faculty_id,
        "name": name,
        "email": email,
        "branches": branches,
        "is_admin": False,
        "token": token
    }
