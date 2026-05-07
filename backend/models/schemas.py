from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr

# ── Authentication ────────────────────────────────────────────
class LoginRequest(BaseModel):
    usn: str
    password: str
    name: Optional[str] = None
    email: Optional[str] = None
    branch: Optional[str] = "CS"

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    student_id: str
    student_name: str
    usn: str
    email: Optional[str] = None
    branch: str
    exam_start_time: Optional[str] = None
    exam_duration_minutes: Optional[int] = 20
    exam_title: Optional[str] = "Initial Assessment"
    total_questions: int = 0
    avatar_url: Optional[str] = None

class TokenData(BaseModel):
    student_id: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None

# ── Exam Session ──────────────────────────────────────────────
class Option(BaseModel):
    id: str
    text: str

class Question(BaseModel):
    id: str
    text: str
    options: List[str]
    image_url: Optional[str] = None

class ExamSession(BaseModel):
    questions: List[Question]
    time_left: int
    exam_title: str

class SubmitAnswer(BaseModel):
    question_id: str
    selected_option: str  # "A", "B", "C", "D"

class SubmissionResponse(BaseModel):
    score: int
    total: int
    percentage: float
    passed: bool

# ── Monitoring & Status ──────────────────────────────────────
class StudentStatus(BaseModel):
    id: str
    usn: str
    name: str
    branch: str
    status: str  # "active", "submitted", "idle"
    score: Optional[int] = None
    violations: int = 0
    is_blocked: bool = False
    last_active: str
    avatar_url: Optional[str] = None

class ViolationReport(BaseModel):
    type: str  # "tab_switch", "fullscreen_exit", "copy_paste"
    details: Optional[str] = None

# ── Admin Dashboard ───────────────────────────────────────────
class AdminStats(BaseModel):
    total_students: int
    active_now: int
    submitted: int
    avg_score: float

class BranchStats(BaseModel):
    branch: str
    count: int
    avg_score: float

class ExamConfig(BaseModel):
    is_active: bool = True
    scheduled_start: Optional[str] = None   # ISO timestamp or None
    scheduled_end: Optional[str] = None     # ISO timestamp for auto-evaporation
    duration_minutes: int = 60
    exam_title: Optional[str] = "ExamGuard Assessment"
    
    # New configuration fields
    marks_per_question: int = 4
    negative_marks: float = -1.0
    shuffle_questions: bool = False
    shuffle_options: bool = False
    max_attempts: int = 1
    show_answers_after: bool = True
    total_questions: int = 30
    total_marks: int = 120
    exam_description: Optional[str] = None


class ExamConfigUpdate(BaseModel):
    is_active: Optional[bool] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    duration_minutes: Optional[int] = None
    exam_title: Optional[int] = None
    
    # New configuration fields
    marks_per_question: Optional[int] = None
    negative_marks: Optional[float] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    max_attempts: Optional[int] = None
    show_answers_after: Optional[bool] = None
    total_questions: Optional[int] = None
    total_marks: Optional[int] = None
    exam_description: Optional[str] = None


# ── Leaderboard ───────────────────────────────────────────────
class LeaderboardEntry(BaseModel):
    rank: int
    student_id: str
    usn: str
    name: str
    branch: str
    score: int
    total_marks: int
    percentage: float
    time_taken_seconds: Optional[int]   # None if not submitted
    submitted_at: Optional[str]


class LeaderboardResponse(BaseModel):
    entries: List[LeaderboardEntry]
    total_submitted: int
    updated_at: str


# ── File Ingestion ────────────────────────────────────────────
class ParsedQuestion(BaseModel):
    text: str
    options: List[str]          # exactly 4
    correct_answer: str         # "A" | "B" | "C" | "D"
    marks: int = 1
    branch: str = "CS"
    order_index: int = 0
    exam_name: str = "Initial Assessment"
    image_url: Optional[str] = None
    # AI Spectral Parser metadata (not persisted to DB)
    confidence: float = 1.0       # 0.0—1.0 — AI certainty about this extraction
    needs_review: bool = False    # True if AI flagged ambiguity
    review_reason: Optional[str] = None  # Human-readable reason


class IngestPreviewResponse(BaseModel):
    questions: List[ParsedQuestion]
    total: int
    source_file: str
    parse_warnings: List[str]
    ai_powered: bool = False           # True if Gemini AI was used
    ai_confidence_avg: float = 1.0     # Average confidence across all questions
    needs_review_count: int = 0        # Number of questions needing admin review
    finesse_check: Optional[str] = None  # AI self-verification message


class BulkImportRequest(BaseModel):
    questions: List[ParsedQuestion]
    replace_existing: bool = False
    exam_name: str  # Mandatory for Crystalline Isolation Node anchoring
    max_questions: Optional[int] = None


class FolderRenameRequest(BaseModel):
    new_name: str


class FolderEditBranchRequest(BaseModel):
    new_branches: List[str]

# ── Support Requests ──────────────────────────────────────────
class SupportRequestCreate(BaseModel):
    usn: str
    problem: str

class SupportRequestResponse(BaseModel):
    id: str
    usn: str
    problem: str
    status: str
    created_at: str
