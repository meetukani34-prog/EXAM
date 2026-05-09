from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr

# ── Authentication ────────────────────────────────────────────
class LoginRequest(BaseModel):
    usn: str
    password: str
    name: Optional[str] = None
    email: Optional[str] = None
    branch: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    student_id: str
    student_name: str
    usn: Optional[str] = None
    email: Optional[str] = None
    branch: str = "CS"
    exam_start_time: Optional[str] = None
    exam_duration_minutes: int = 20
    exam_title: Optional[str] = "Initial Assessment"
    total_questions: int = 0
    avatar_url: Optional[str] = None

class TokenData(BaseModel):
    student_id: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None

# ── Questions ─────────────────────────────────────────────────
class QuestionOut(BaseModel):
    id: str
    text: str
    options: List[str]
    branch: str = "CS"
    order_index: int
    marks: int
    exam_name: str = "Initial Assessment"
    image_url: Optional[str] = None
    audio_url: Optional[str] = None

class QuestionsResponse(BaseModel):
    questions: List[QuestionOut]
    total: int

# ── Answers ───────────────────────────────────────────────────
class SaveAnswerRequest(BaseModel):
    question_id: str
    selected_option: str   # "A", "B", "C", or "D"

class SaveAnswerResponse(BaseModel):
    saved: bool
    question_id: str

# ── Submit ────────────────────────────────────────────────────
class SubmitExamRequest(BaseModel):
    answers: Dict[str, str]   # { "question_id": "A", ... }

class SubmitExamResponse(BaseModel):
    submitted: bool
    score: float
    total_marks: int
    correct_count: int
    wrong_count: int
    percentage: float
    submitted_at: str

class StartExamResponse(BaseModel):
    started_at: str

# ── Violations ────────────────────────────────────────────────
class ReportViolationRequest(BaseModel):
    type: str    # tab_switch | window_blur | fullscreen_exit | etc.
    exam_name: Optional[str] = "General Assessment"
    metadata: Optional[Dict[str, Any]] = {}

class ReportViolationResponse(BaseModel):
    warning_count: int
    auto_submitted: bool
    message: str

# ── Admin Management ──────────────────────────────────────────
class AdminQuestionOut(BaseModel):
    id: str
    text: str
    options: List[str]
    branch: str = "CS"
    correct_answer: str
    marks: int
    order_index: int
    exam_name: str = "Initial Assessment"
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    category: Optional[str] = None

class AdminQuestionsResponse(BaseModel):
    questions: List[AdminQuestionOut]
    total: int

class QuestionCreate(BaseModel):
    text: str
    options: List[str]
    branch: str
    correct_answer: str
    marks: int = 1
    order_index: int
    exam_name: str = "Initial Assessment"
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    category: Optional[str] = "other"

class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    options: Optional[List[str]] = None
    branch: Optional[str] = None
    correct_answer: Optional[str] = None
    marks: Optional[int] = None
    order_index: Optional[int] = None
    exam_name: Optional[str] = None
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    category: Optional[str] = None

class StudentCreate(BaseModel):
    usn: str
    name: str
    email: Optional[str] = None
    branch: str
    password: str

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    branch: Optional[str] = None
    password: Optional[str] = None
    is_active_session: Optional[bool] = None

class StudentStatus(BaseModel):
    student_id: str
    usn: str
    name: str
    email: Optional[str] = None
    branch: str = "CS"
    status: str
    warnings: int
    last_active: Optional[str]
    submitted_at: Optional[str]
    started_at: Optional[str] = None
    is_blocked: bool = False
    avatar_url: Optional[str] = None

# ── Exam Config ───────────────────────────────────────────────
class ExamConfig(BaseModel):
    is_active: bool = True
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    duration_minutes: int = 60
    exam_title: Optional[str] = "ExamGuard Assessment"
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
    exam_title: Optional[str] = None
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
    score: float
    total_marks: int
    percentage: float
    time_taken_seconds: Optional[int]
    submitted_at: Optional[str]

class LeaderboardResponse(BaseModel):
    entries: List[LeaderboardEntry]
    total_submitted: int
    updated_at: str

# ── File Ingestion ────────────────────────────────────────────
class ParsedQuestion(BaseModel):
    text: str
    options: List[str]
    correct_answer: str
    marks: int = 1
    branch: str = "CS"
    order_index: int = 0
    exam_name: str = "Initial Assessment"
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    category: Optional[str] = "other"
    confidence: float = 1.0
    needs_review: bool = False
    review_reason: Optional[str] = None

class IngestPreviewResponse(BaseModel):
    questions: List[ParsedQuestion]
    total: int
    source_file: str
    parse_warnings: List[str]
    ai_powered: bool = False
    ai_confidence_avg: float = 1.0
    needs_review_count: int = 0
    finesse_check: Optional[str] = None

class BulkImportRequest(BaseModel):
    questions: List[ParsedQuestion]
    replace_existing: bool = False
    exam_name: str
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

class ViolationHistoryOut(BaseModel):
    id: str
    student_id: str
    student_name: str
    usn: str
    type: str
    exam_name: str
    created_at: str
    metadata: Optional[Dict[str, Any]] = None
