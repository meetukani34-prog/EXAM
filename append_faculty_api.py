import os

api_ts_path = r"c:\EXAM_new\EXAM\lib\api.ts"

endpoints_code = """
// ── Faculty Student Management ─────────────────────────────────────
export async function getFacultyStudents(examName?: string): Promise<AdminStudent[]> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const query = examName ? `?exam=${encodeURIComponent(examName)}` : "";
  const res = await fetch(`${API}/faculty/students${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load students");
  return res.json();
}

export async function updateFacultyStudent(id: string, data: any): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API}/faculty/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update student");
}

export async function blockFacultyStudent(id: string): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API}/faculty/students/${id}/block`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to block student");
}

export async function unblockFacultyStudent(id: string): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API}/faculty/students/${id}/unblock`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to unblock student");
}

export async function deleteFacultyStudent(id: string): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API}/faculty/students/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete student");
}

export async function resetFacultyStudentExam(id: string, examName: string): Promise<void> {
  const token = localStorage.getItem("faculty_token");
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`${API}/faculty/students/${id}/reset-exam`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ exam_name: examName }),
  });
  if (!res.ok) throw new Error("Failed to reset student exam");
}
"""

with open(api_ts_path, "a", encoding="utf-8") as f:
    f.write("\n" + endpoints_code + "\n")

print("Endpoints appended to api.ts")
