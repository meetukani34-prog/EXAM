/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
import { withRetry } from "./apiUtils";

export class ApiError extends Error {
  constructor(public detail: string, public status: number) {
    super(detail);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("exam_token");
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const isPreview = typeof window !== "undefined" && localStorage.getItem("exam_preview") === "true";
  const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || "admin@examguard2024";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isPreview ? { "X-Admin-Secret": ADMIN_SECRET } : {}),
    ...options.headers,
  };

  const url = `${API_BASE}${path}`;
  if (!token && !path.includes("/auth/login")) {
    console.warn(`[API] Warning: Fetching ${url} without token.`);
  }


  try {
    const res = await fetch(url, { cache: "no-store", ...options, headers });

    if (res.status === 401) {
      console.error(`[API] 401 Unauthorized for ${url}.`);
      // DON'T violently kick the student to /login if they are on /dashboard or /exam
      const isExamPage = typeof window !== "undefined" && window.location.pathname.startsWith("/exam");
      const isDashboardPage = typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard");
      if (!isExamPage && !isDashboardPage && typeof window !== "undefined") {
        sessionStorage.removeItem("exam_token");
        sessionStorage.removeItem("exam_student");
        localStorage.removeItem("exam_token");
        localStorage.removeItem("exam_student");
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const text = await res.text();
        try {
          const err = JSON.parse(text);
          detail = err.detail || err.message || detail;
        } catch {
          if (text.includes("Cloudflare") || text.includes("Vercel")) {
            detail = `Server Gateway Error (HTTP ${res.status})`;
          } else if (text.length > 0) {
            detail = text.substring(0, 150);
          }
        }
      } catch {}
      console.error(`[API] Error response for ${url}: ${detail}`);
      throw new ApiError(detail, res.status);
    }

    return res.json();
  } catch (err) {
    console.error(`[API] Network error for ${url}:`, err);
    throw err;
  }
}

// ── Auth ──────────────────────────────────────────────────────
export interface LoginResponse {
  access_token: string;
  student_id: string;
  student_name: string;
  email?: string;
  branch: string;
  year?: string;
  exam_start_time: string | null;
  exam_duration_minutes: number;
  exam_title: string;
  total_questions: number;
  avatar_url?: string;
}

export async function resetSession(usn: string, password: string): Promise<void> {
  await apiFetch("/auth/session/reset", {
    method: "POST",
    body: JSON.stringify({ usn, password }),
  });
}

export interface SendOtpResult {
  success: boolean;
  message: string;
  email?: string;
  email_required?: boolean;
  masked_email?: string;
  expires_in_seconds?: number;
}

export async function sendSignupOtp(data: {
  usn: string;
  email: string;
  name: string;
  password: string;
  branch?: string;
  year?: string;
}): Promise<SendOtpResult> {
  return apiFetch<SendOtpResult>("/auth/send-signup-otp", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function verifySignupOtp(data: {
  usn: string;
  email: string;
  otp: string;
  name: string;
  password: string;
  branch?: string;
  year?: string;
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/verify-signup-otp", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function sendLoginOtp(usn: string, password: string): Promise<SendOtpResult> {
  return apiFetch<SendOtpResult>("/auth/send-login-otp", {
    method: "POST",
    body: JSON.stringify({ usn, password }),
  });
}

export async function verifyLoginOtp(usn: string, otp: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/verify-login-otp", {
    method: "POST",
    body: JSON.stringify({ usn, otp }),
  });
}

export async function googleLoginStudent(data: {
  email: string;
  name?: string;
  avatar_url?: string;
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function loginStudent(
  usn: string,
  password: string,
  metadata?: { name?: string; email?: string; branch?: string; year?: string }
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ usn, password, ...metadata }),
  });
}

export async function logoutStudent(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" }).catch(() => { });
  localStorage.removeItem("exam_token");
  localStorage.removeItem("exam_student");
  localStorage.removeItem("exam_preview");
}

export async function updateProfile(data: { name?: string; email?: string; avatar_url?: string }): Promise<void> {
  await apiFetch("/auth/profile/update", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function submitSupportRequest(usn: string, problem: string): Promise<void> {
  await apiFetch("/auth/support", {
    method: "POST",
    body: JSON.stringify({ usn, problem }),
  });
}

// ── Questions ─────────────────────────────────────────────────
export interface Question {
  id: string;
  text: string;
  options: string[];
  branch: string;
  year?: string;
  order_index: number;
  marks: number;
  neg_marks: number;
  image_url: string | null;
  audio_url: string | null;
  category?: string;
  programming_type?: string;
  starter_code?: string;
  starter_code_c?: string;
  starter_code_cpp?: string;
  test_cases?: string;
  target_output?: string;
}

export interface QuestionsResponse {
  questions: Question[];
  total: number;
  pos_marks_global: number;
  neg_marks_global: number;
}

export async function fetchQuestions(title: string): Promise<QuestionsResponse> {
  return await apiFetch<QuestionsResponse>(
    `/exam/questions?title=${encodeURIComponent(title)}`
  );
}

// ── Save Answer ───────────────────────────────────────────────
export async function saveAnswer(
  question_id: string,
  selected_option: string,
  examName: string = "General Assessment"
): Promise<void> {
  await apiFetch("/exam/save-answer", {
    method: "POST",
    body: JSON.stringify({ question_id, selected_option, exam_name: examName }),
  });
}

// ── Submit ────────────────────────────────────────────────────
export interface SubmitResponse {
  submitted: boolean;
  score: number;
  total_marks: number;
  correct_count: number;
  wrong_count: number;
  percentage: number;
  submitted_at: string;
}

export async function submitExam(answers: Record<string, string>, examTitle: string): Promise<any> {
  const payload = { ...answers, __exam_title: examTitle };
  return withRetry(() => apiFetch("/exam/submit-exam", {
    method: "POST",
    body: JSON.stringify({ answers: payload }),
  }), 3, 2000);
}

export async function getExamStatus(): Promise<any[]> {
  return apiFetch<any[]>("/exam/status");
}

export async function startExam(title: string): Promise<{ started_at: string }> {
  return apiFetch<{ started_at: string }>(`/exam/start-exam?title=${encodeURIComponent(title)}`, {
    method: "POST",
  });
}

export async function heartbeat(examName?: string): Promise<{status: string}> {
  return await apiFetch<{status: string}>("/exam/heartbeat", { 
    method: "POST",
    body: examName ? JSON.stringify({ exam_name: examName }) : undefined
  });
}


// ── Violations ────────────────────────────────────────────────
export interface ViolationResponse {
  warning_count: number;
  auto_submitted: boolean;
  message: string;
}

export async function reportViolation(type: string, examName: string, metadata: any = {}): Promise<any> {
  return apiFetch<any>("/exam/report-violation", {
    method: "POST",
    body: JSON.stringify({ type, exam_name: examName, metadata }),
  });
}

// ── Admin Management ───────────────────────────────────────
export interface AdminQuestion {
  id: string;
  text: string;
  options: string[];
  branch: string;
  year?: string;
  correct_answer: string;
  order_index: number;
  marks: number;
  exam_name: string;
  image_url: string | null;
  audio_url?: string | null;
  category?: "aptitude" | "programming" | "other";
  programming_type?: "jumble" | "compiler" | "mcq";
  starter_code?: string | null;
  starter_code_c?: string | null;
  starter_code_cpp?: string | null;
  test_cases?: string | null;
  target_output?: string | null;
  faculty_id?: string;
}

export interface AdminStudent {
  student_id: string;
  usn: string;
  name: string;
  email: string | null;
  branch: string;
  status: "not_started" | "active" | "submitted";
  warnings: number;
  score: number;
  total_marks: number;
  last_active: string | null;
  submitted_at: string | null;
  started_at: string | null;
  is_blocked: boolean;
  year?: string;
  exam_name?: string | null;
  current_round?: number | null;
  round_1_state?: any;
  is_active?: boolean;
}

export interface FacultyProfile {
  faculty_id: string;
  name: string;
  email: string;
  branches: string[];
}

export interface ViolationHistory {
  id: string;
  student_id: string;
  student_name: string;
  usn: string;
  type: string;
  exam_name: string;
  created_at: string;
  metadata?: any;
}

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin@examguard2024";


function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;

  return fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": ADMIN_SECRET,
      ...options.headers,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Admin request failed" }));
      console.error(`[ADMIN API] Error for ${url}:`, err);
      throw new Error(err.detail || `Admin API error: ${res.status}`);
    }
    return res.json();
  }).catch(err => {
    console.error(`[ADMIN API] Network error for ${url}:`, err);
    throw err;
  });
}

export async function fetchAdminQuestions(): Promise<AdminQuestion[]> {
  return adminFetch<{ questions: AdminQuestion[]; total: number }>(`/admin/questions?_t=${Date.now()}`).then(
    (r) => r.questions
  );
}

export async function createAdminQuestion(data: {
  text: string;
  options: string[];
  branch: string;
  year?: string;
  correct_answer: string;
  order_index: number;
  marks: number;
  exam_name: string;
}): Promise<AdminQuestion> {
  return adminFetch<AdminQuestion>("/admin/questions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminQuestion(
  id: string,
  data: Partial<{
    text: string;
    options: string[];
    branch: string;
    year: string;
    correct_answer: string;
    order_index: number;
    marks: number;
    exam_name: string;
  }>
): Promise<AdminQuestion> {
  return adminFetch<AdminQuestion>(`/admin/questions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminQuestion(id: string): Promise<void> {
  await adminFetch(`/admin/questions/${id}`, { method: "DELETE" });
}

export async function fetchAdminStudents(examName?: string): Promise<AdminStudent[]> {
  const query = examName ? `?exam=${encodeURIComponent(examName)}` : "";
  return adminFetch<AdminStudent[]>(`/admin/students${query}`);
}

export async function fetchStudentFidelity(studentId: string): Promise<any> {
  return adminFetch<any>(`/admin/students/${studentId}/fidelity`);
}

export async function createAdminStudent(data: {
  usn: string;
  name: string;
  email?: string;
  branch: string;
  year?: string;
  password: string;
}): Promise<{ id: string }> {
  return adminFetch<{ id: string }>("/admin/students", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminStudent(
  id: string,
  data: { usn?: string; name?: string; email?: string; branch?: string; year?: string; password?: string; is_active_session?: boolean; is_blocked?: boolean }
): Promise<{ updated: boolean }> {
  return adminFetch<{ updated: boolean }>(`/admin/students/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function blockAdminStudent(id: string): Promise<void> {
  await adminFetch(`/admin/students/${id}/block`, { method: "POST" });
}

export async function unblockAdminStudent(id: string): Promise<void> {
  await adminFetch(`/admin/students/${id}/unblock`, { method: "POST" });
}

export async function deleteAdminStudent(id: string): Promise<void> {
  await adminFetch(`/admin/students/${id}`, { method: "DELETE" });
}

export async function deleteAllAdminStudents(): Promise<void> {
  await adminFetch(`/admin/students-all`, { method: "DELETE" });
}

export async function resetAdminStudent(id: string, examName?: string): Promise<void> {
  await adminFetch(`/admin/students/${id}/reset`, {
    method: "POST",
    body: examName ? JSON.stringify({ exam_name: examName }) : undefined,
  });
}

export async function forceSubmitAdminStudent(id: string, examName?: string): Promise<{ score: number }> {
  return adminFetch<{ score: number }>(`/admin/students/${id}/force-submit`, {
    method: "POST",
    body: examName ? JSON.stringify({ exam_name: examName }) : undefined,
  });
}

export async function cleanupStaleSessions(): Promise<{ count: number }> {
  return adminFetch<{ count: number }>("/admin/students/cleanup-stale", { method: "POST" });
}

// ── Orbital Node Management (Folder CRUD) ─────────────────────

export async function deleteAdminFolder(folderName: string, branch?: string): Promise<void> {
  const url = branch ? `/admin/folders/${encodeURIComponent(folderName)}?branch=${encodeURIComponent(branch)}` : `/admin/folders/${encodeURIComponent(folderName)}`;
  await adminFetch(url, {
    method: "DELETE",
  });
}

export async function renameAdminFolder(oldName: string, newName: string, branch?: string): Promise<void> {
  await adminFetch(`/admin/folders/${encodeURIComponent(oldName)}`, {
    method: "PATCH",
    body: JSON.stringify({ new_name: newName, branch: branch }),
  });
}

export async function editAdminFolderBranch(folderName: string, newBranches: string[]): Promise<void> {
  await adminFetch(`/admin/folders/${encodeURIComponent(folderName)}/branch`, {
    method: "PATCH",
    body: JSON.stringify({ new_branches: newBranches }),
  });
}

export async function editAdminFolderMarks(folderName: string, marks: number): Promise<void> {
  await adminFetch(`/admin/folders/${encodeURIComponent(folderName)}/marks`, {
    method: "PATCH",
    body: JSON.stringify({ marks: marks }),
  });
}

export async function uploadQuestionImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/admin/questions/upload`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Image upload failed');
  }

  const data = await res.json();
  return data.image_url;
}

// ── Exam Config (Orbital Control) ─────────────────────────────
export interface ExamConfig {
  is_active: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number;
  exam_title: string;
  marks_per_question: number;
  negative_marks: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  show_answers_after: boolean;
  total_questions: number;
  total_marks: number;
  exam_description: string | null;
  branch: string;
  year?: string;
  category?: string;
}

export async function fetchExamConfig(title?: string): Promise<ExamConfig> {
  const path = title ? `/admin/exam/config?title=${encodeURIComponent(title)}` : "/admin/exam/config";
  return adminFetch<ExamConfig>(path);
}

export async function fetchAllExamConfigs(): Promise<ExamConfig[]> {
  return adminFetch<ExamConfig[]>("/admin/exam/config/all");
}

export async function updateExamConfig(data: Partial<ExamConfig>): Promise<ExamConfig> {
  return adminFetch<ExamConfig>("/admin/exam/config", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// LOAD-TEST FIX: Client-side cache to prevent 200 identical API calls
// when all students load the dashboard simultaneously.
let _examConfigCache: { data: ExamConfig[]; timestamp: number; branch?: string } | null = null;
const EXAM_CONFIG_CACHE_TTL = 30_000; // 30 seconds

/** Public endpoint — no admin secret needed. Returns active configurations filtered by branch. */
export async function fetchPublicExamConfig(branch?: string): Promise<ExamConfig[]> {
  // Return cached data if still fresh (within 30s)
  if (
    _examConfigCache &&
    _examConfigCache.branch === branch &&
    Date.now() - _examConfigCache.timestamp < EXAM_CONFIG_CACHE_TTL
  ) {
    return _examConfigCache.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const query = branch ? `?branch=${encodeURIComponent(branch)}` : "";
    const url = `${API_BASE}/exam/config/public${query}`;
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'max-age=30' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[API] Public config fetch failed with status ${res.status}.`);
      return [];
    }
    const data = await res.json();
    // Cache the result
    _examConfigCache = { data, timestamp: Date.now(), branch };
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("fetchPublicExamConfig error:", err);
    return [];
  }
}

/**
 * Fetch question counts grouped by branch for the student dashboard.
 * Returns a summary of available exam nodes.
 */
export interface BranchExamSummary {
  branch: string;
  exam_name: string;
  question_count: number;
}

export async function fetchBranchExamSummary(): Promise<BranchExamSummary[]> {
  try {
    // Use the public questions endpoint — reading branch distribution
    const res = await fetch(`${API_BASE}/exam/questions`, {
      headers: {
        Authorization: `Bearer ${typeof window !== "undefined" ? sessionStorage.getItem("exam_token") || "" : ""}`,
      },
    });
    if (!res.ok) return [];
    const data: { questions: Array<{ branch: string; exam_name?: string }> } = await res.json();
    const branchMap: Record<string, { count: number; exam_name: string }> = {};
    for (const q of data.questions) {
      const br = q.branch || "CS";
      if (!branchMap[br]) branchMap[br] = { count: 0, exam_name: q.exam_name || "ExamGuard Assessment" };
      branchMap[br].count++;
    }
    return Object.entries(branchMap).map(([branch, info]) => ({
      branch,
      exam_name: info.exam_name,
      question_count: info.count,
    }));
  } catch {
    return [];
  }
}


// ── Leaderboard ───────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  usn: string;
  name: string;
  branch: string;
  score: number;
  total_marks: number;
  percentage: number;
  time_taken_seconds: number | null;
  submitted_at: string | null;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const data = await adminFetch<{ entries: LeaderboardEntry[]; total_submitted: number; updated_at: string }>(
    "/leaderboard/admin"
  );
  return data.entries;
}

// ── Export (Crystalline Data) ─────────────────────────────────
/** Returns a Blob of the Excel file */
export async function exportResults(quizName?: string): Promise<Blob> {
  // Construct URL correctly even if API_BASE is relative
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const url = new URL(`${API_BASE}/admin/export`.replace("//", "/"), base);
  if (quizName) url.searchParams.append("quiz_name", quizName);

  const res = await fetch(url.toString(), {
    headers: { "X-Admin-Secret": ADMIN_SECRET },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(err.detail || "Export failed");
  }
  return res.blob();
}

// ── Support Requests ──────────────────────────────────────────
export interface SupportRequest {
  id: string;
  usn: string;
  problem: string;
  status: "open" | "resolved" | "closed";
  created_at: string;
}

export async function fetchSupportRequests(): Promise<SupportRequest[]> {
  return adminFetch<SupportRequest[]>("/admin/support-requests");
}

export async function updateSupportRequestStatus(id: string, status: string): Promise<void> {
  await adminFetch(`/admin/support-requests/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function fetchViolationHistory(studentId?: string): Promise<ViolationHistory[]> {
  const url = studentId ? `/admin/violations?student_id=${studentId}` : "/admin/violations";
  return adminFetch<ViolationHistory[]>(url);
}

// ── PyHunt Global Configuration ────────────────────────────────

export interface GlobalConfigEntry {
  config_key: string;
  config_value: any;
  updated_at?: string;
}

export async function fetchPyHuntConfig(): Promise<GlobalConfigEntry[]> {
  return adminFetch<GlobalConfigEntry[]>("/admin/pyhunt/config");
}

export async function updatePyHuntConfig(key: string, value: any): Promise<void> {
  await adminFetch("/admin/pyhunt/config", {
    method: "POST",
    body: JSON.stringify({ config_key: key, config_value: value }),
  });
}

export async function resetOdysseyProgress(studentId: string): Promise<void> {
  await adminFetch(`/admin/students/${studentId}/reset-odyssey`, {
    method: "POST",
  });
}

/** Public endpoint for students — no admin secret needed. */
export async function fetchPublicPyHuntConfig(): Promise<GlobalConfigEntry[]> {
  const res = await fetch(`${API_BASE}/exam/pyhunt/config`);
  if (!res.ok) return [];
  return res.json();
}

// ── Faculty Admin Management ─────────────────────────────────

export interface FacultyMember {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  branches: string[];
  categories?: string[];
  created_at?: string;
}

export async function fetchAdminFaculty(): Promise<{ faculty: FacultyMember[]; total: number }> {
  return adminFetch("/admin/faculty");
}

export async function createAdminFaculty(data: { name: string; email: string; password: string; branches: string[]; categories?: string[] }): Promise<{ success: boolean; faculty: FacultyMember }> {
  return adminFetch("/admin/faculty", { method: "POST", body: JSON.stringify(data) });
}

export async function updateAdminFaculty(id: string, data: Record<string, unknown>): Promise<{ success: boolean }> {
  return adminFetch(`/admin/faculty/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteAdminFaculty(id: string): Promise<{ success: boolean }> {
  return adminFetch(`/admin/faculty/${id}`, { method: "DELETE" });
}

export async function assignFacultyBranches(id: string, branches: string[]): Promise<{ success: boolean }> {
  return adminFetch(`/admin/faculty/${id}/branches`, { method: "PUT", body: JSON.stringify({ branches }) });
}


// ── Faculty Student Management ─────────────────────────────────────
export async function getFacultyStudents(examName?: string): Promise<AdminStudent[]> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const query = examName ? `?exam=${encodeURIComponent(examName)}` : "";
  const res = await fetch(`${API_BASE}/faculty/students${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load students");
  return res.json();
}

export async function updateFacultyStudent(id: string, data: any): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/faculty/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update student");
}

export async function blockFacultyStudent(id: string): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/faculty/students/${id}/block`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to block student");
}

export async function unblockFacultyStudent(id: string): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/faculty/students/${id}/unblock`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to unblock student");
}

export async function deleteFacultyStudent(id: string): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/faculty/students/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete student");
}

export async function resetFacultyStudentExam(id: string, examName: string): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API_BASE}/faculty/students/${id}/reset-exam`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ exam_name: examName }),
  });
  if (!res.ok) throw new Error("Failed to reset student exam");
}

// ── Tech Relay API ──────────────────────────────────────────────

export interface TechRelayRound {
  id: string;
  relay_name: string;
  is_active: boolean;
  round_number: number;
  round_title: string;
  round_type: "gadget" | "puzzle" | "debug" | "mcq" | "password";
  content: Record<string, unknown>;
  correct_answer?: string;
  time_limit_seconds: number;
}

export interface TechRelayProgress {
  current_round: number;
  current_question_index: number;
  rounds_completed: Array<{ round: number; completed_at: string; attempts: number; forced?: boolean; questions_solved?: number; user_answer?: string; solved_indices?: number[] }>;
  is_completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  r1_answer?: string;
  r3_solved?: number[];
  stopped_by_admin?: boolean;
  disqualified?: boolean;
  disqualification_reason?: string;
  r3_score?: number;
  r4_score?: number;
  final_score?: number;
  total_mcq?: number;
}

export interface TechRelaySubmitResult {
  success: boolean;
  message: string;
  round_cleared?: boolean;
  next_round?: number | null;
  next_question_index?: number;
  total_questions?: number;
  is_completed?: boolean;
  disqualified?: boolean;
  r1_answer?: string;
  r3_solved?: number[];
  solved_count?: number;
  score?: number;
  total?: number;
  r3_score?: number;
  r4_score?: number;
  final_score?: number;
}

export async function fetchTechRelayConfig(): Promise<TechRelayRound[]> {
  const data = await apiFetch<{ rounds: TechRelayRound[] }>("/tech-relay/config");
  return data.rounds;
}

export async function fetchTechRelayProgress(): Promise<TechRelayProgress> {
  return apiFetch<TechRelayProgress>(`/tech-relay/progress?_t=${Date.now()}`);
}

export async function startTechRelay(
  startCode: string,
  relayName: string = "Tech Relay"
): Promise<{ success: boolean; message: string; current_round: number; is_completed: boolean; started_at: string }> {
  return apiFetch("/tech-relay/start", {
    method: "POST",
    body: JSON.stringify({ start_code: startCode, relay_name: relayName }),
  });
}

export async function submitTechRelayRound(
  roundNumber: number,
  answer: string,
  questionIndex: number = 0,
  relayName: string = "Tech Relay"
): Promise<TechRelaySubmitResult> {
  return apiFetch<TechRelaySubmitResult>("/tech-relay/submit-round", {
    method: "POST",
    body: JSON.stringify({
      round_number: roundNumber,
      answer,
      question_index: questionIndex,
      relay_name: relayName,
    }),
  });
}

// Admin Tech Relay
export async function fetchTechRelayAdminConfig(): Promise<TechRelayRound[]> {
  const data = await adminFetch<{ rounds: TechRelayRound[] }>(`/tech-relay/admin/config?_t=${Date.now()}`);
  return data.rounds;
}

export async function saveTechRelayRound(round: Omit<TechRelayRound, "id"> & { id?: string }): Promise<TechRelayRound> {
  return adminFetch<TechRelayRound>("/tech-relay/admin/config", {
    method: "POST",
    body: JSON.stringify(round),
  });
}

export async function deleteTechRelayRound(configId: string): Promise<void> {
  await adminFetch(`/tech-relay/admin/config/${configId}`, { method: "DELETE" });
}

export async function toggleTechRelay(relayName: string, isActive: boolean): Promise<void> {
  await adminFetch("/tech-relay/admin/toggle", {
    method: "PUT",
    body: JSON.stringify({ relay_name: relayName, is_active: isActive }),
  });
}

export interface TechRelayParticipant {
  student_id: string;
  usn: string;
  name: string;
  branch: string;
  is_blocked: boolean;
  has_started: boolean;
  current_round: number;
  current_question_index: number;
  rounds_completed: Array<{ round: number; completed_at: string; attempts: number; forced?: boolean }>;
  is_completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  warnings: number;
  score?: number;
  r3_score?: number;
  r4_score?: number;
  total_mcq?: number;
  stopped_by_admin?: boolean;
  disqualified?: boolean;
  disqualification_reason?: string;
  cleared_rounds?: number;
}

export async function fetchTechRelayAdminStudents(
  relayName: string = "Tech Relay",
  includeAll: boolean = true
): Promise<TechRelayParticipant[]> {
  const data = await adminFetch<{ students: TechRelayParticipant[] }>(
    `/tech-relay/admin/students?relay_name=${encodeURIComponent(relayName)}&include_all=${includeAll}&_t=${Date.now()}`
  );
  return data.students || [];
}

export async function forceUnlockTechRelay(
  studentId: string,
  nextRound: number,
  relayName: string = "Tech Relay"
): Promise<{ success: boolean; message: string }> {
  return adminFetch<{ success: boolean; message: string }>("/tech-relay/admin/force-unlock", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, next_round: nextRound, relay_name: relayName }),
  });
}

export async function clearTechRelayStrikes(
  studentId: string,
  relayName: string = "Tech Relay"
): Promise<{ success: boolean; message: string }> {
  return adminFetch<{ success: boolean; message: string }>("/tech-relay/admin/clear-strikes", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, relay_name: relayName }),
  });
}

export async function resetTechRelayStudent(
  studentId: string,
  relayName: string = "Tech Relay"
): Promise<{ success: boolean; message: string }> {
  return adminFetch<{ success: boolean; message: string }>("/tech-relay/admin/reset-student", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, relay_name: relayName }),
  });
}

export async function resetAllTechRelay(
  relayName: string = "Tech Relay"
): Promise<{ success: boolean; message: string }> {
  return adminFetch<{ success: boolean; message: string }>("/tech-relay/admin/reset-all", {
    method: "POST",
    body: JSON.stringify({ relay_name: relayName }),
  });
}

export async function removeTechRelayStudent(
  studentId: string,
  relayName: string = "Tech Relay"
): Promise<{ success: boolean; message: string }> {
  return adminFetch<{ success: boolean; message: string }>(`/tech-relay/admin/student/${studentId}`, {
    method: "DELETE",
  });
}

export async function forceStopTechRelay(
  relayName: string = "Tech Relay"
): Promise<{ success: boolean; message: string; affected_count: number }> {
  return adminFetch<{ success: boolean; message: string; affected_count: number }>(
    "/tech-relay/admin/force-stop",
    {
      method: "POST",
      body: JSON.stringify({ relay_name: relayName }),
    }
  );
}

export interface TechRelayLeaderboardEntry {
  student_id: string;
  usn: string;
  name: string;
  branch: string;
  current_round: number;
  rounds_completed: number;
  total_attempts: number;
  is_completed: boolean;
  started_at: string;
  completed_at: string | null;
  score?: number;
  r3_score?: number;
  r4_score?: number;
  total_mcq?: number;
  stopped_by_admin?: boolean;
}

export async function fetchTechRelayLeaderboard(
  relayName: string = "Tech Relay"
): Promise<TechRelayLeaderboardEntry[]> {
  const data = await adminFetch<{ leaderboard: TechRelayLeaderboardEntry[] }>(
    `/tech-relay/admin/leaderboard?relay_name=${encodeURIComponent(relayName)}&_t=${Date.now()}`
  );
  return data.leaderboard || [];
}


