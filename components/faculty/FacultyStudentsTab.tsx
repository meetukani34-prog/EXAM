"use client";

import { useState, useEffect } from "react";
import {
  AdminStudent,
  getFacultyStudents,
  updateFacultyStudent,
  blockFacultyStudent,
  unblockFacultyStudent,
  deleteFacultyStudent,
  resetFacultyStudentExam,
} from "@/lib/api";
import { BRANCHES } from "@/lib/constants";
import styles from "@/app/admin/admin.module.css"; // Reuse admin styles

interface Props {
  branches: string[];
}

export default function FacultyStudentsTab({ branches }: Props) {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [examFilter, setExamFilter] = useState("");

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [editForm, setEditForm] = useState({ name: "", usn: "", email: "", branch: "CS", password: "" });

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStudent, setResetStudent] = useState<AdminStudent | null>(null);
  const [resetExamName, setResetExamName] = useState("");

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await getFacultyStudents(examFilter || undefined);
      setStudents(data);
    } catch (e) {
      console.error(e);
      alert("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [examFilter]);

  const handleEdit = (s: AdminStudent) => {
    setEditingStudent(s);
    setEditForm({ name: s.name, usn: s.usn, email: s.email || "", branch: s.branch || "CS", password: "" });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    try {
      await updateFacultyStudent(editingStudent.student_id, {
        name: editForm.name,
        usn: editForm.usn,
        email: editForm.email,
        branch: editForm.branch,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      setShowEditModal(false);
      loadStudents();
    } catch (e) {
      alert("Failed to update student");
    }
  };

  const handleResetPassword = async (s: AdminStudent) => {
    const p = prompt(`Enter new password for ${s.name}:`);
    if (!p) return;
    try {
      await updateFacultyStudent(s.student_id, { password: p });
      alert("Password reset successfully");
    } catch (e) {
      alert("Failed to reset password");
    }
  };

  const handleToggleBlock = async (s: AdminStudent) => {
    const action = s.is_blocked ? "unblock" : "block";
    if (!confirm(`Are you sure you want to ${action} ${s.name}?`)) return;
    try {
      if (s.is_blocked) await unblockFacultyStudent(s.student_id);
      else await blockFacultyStudent(s.student_id);
      loadStudents();
    } catch (e) {
      alert(`Failed to ${action} student`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to completely delete this student? This cannot be undone.")) return;
    try {
      await deleteFacultyStudent(id);
      loadStudents();
    } catch (e) {
      alert("Failed to delete student");
    }
  };

  const handleResetExamAction = async () => {
    if (!resetStudent || !resetExamName.trim()) return;
    if (!confirm(`Allow ${resetStudent.name} to retake "${resetExamName}"? This will clear their answers for this exam.`)) return;
    
    try {
      await resetFacultyStudentExam(resetStudent.student_id, resetExamName);
      setShowResetModal(false);
      loadStudents();
      alert(`Exam "${resetExamName}" reset successfully for ${resetStudent.name}.`);
    } catch (e) {
      alert("Failed to reset exam state");
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.usn.toLowerCase().includes(search.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Student Management</h2>
        
        <div style={{ display: "flex", gap: 12 }}>
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ width: 250 }}
          />
          <input
            type="text"
            placeholder="Filter by Exam Name"
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            className="input-field"
            style={{ width: 200 }}
          />
          <button className="btn btn-outline" onClick={loadStudents}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Loading students...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>USN</th>
                <th>Name</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.student_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.usn}</div>
                    {s.email && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.email}</div>}
                  </td>
                  <td>{s.name}</td>
                  <td>
                    <span className={styles.badge}>{s.branch}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={`${styles.statusDot} ${s.status === "active" ? styles.pulse : ""} ${styles[s.status] || ""}`} />
                      <span style={{ textTransform: "capitalize", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                        {s.status.replace("_", " ")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {s.score} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>/ {s.total_marks}</span>
                    </div>
                    {s.exam_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.exam_name}</div>}
                  </td>
                  <td>
                    <div className={styles.actionButtons} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-outline" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleEdit(s)}>Edit</button>
                      <button className="btn btn-outline" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleResetPassword(s)}>Reset PW</button>
                      <button className="btn btn-outline" style={{ padding: "4px 8px", fontSize: 12, color: "var(--accent)", borderColor: "var(--accent)" }} onClick={() => { setResetStudent(s); setResetExamName(s.exam_name || ""); setShowResetModal(true); }}>Re-Exam</button>
                      <button
                        className="btn btn-outline"
                        style={{
                          padding: "4px 8px", fontSize: 12,
                          color: s.is_blocked ? "var(--success)" : "var(--danger)",
                          borderColor: s.is_blocked ? "var(--success)" : "var(--danger)",
                        }}
                        onClick={() => handleToggleBlock(s)}
                      >
                        {s.is_blocked ? "Unblock" : "Block"}
                      </button>
                      <button className="btn btn-outline text-danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleDelete(s.student_id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingStudent && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 20 }}>Edit Student</h3>
            <div className={styles.formGroup}>
              <label>Name</label>
              <input type="text" className="input-field" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label>USN</label>
              <input type="text" className="input-field" value={editForm.usn} onChange={e => setEditForm({ ...editForm, usn: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label>Email</label>
              <input type="email" className="input-field" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label>Branch</label>
              <select className="input-field" value={editForm.branch} onChange={e => setEditForm({ ...editForm, branch: e.target.value })}>
                {BRANCHES.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>New Password (leave blank to keep current)</label>
              <input type="text" className="input-field" placeholder="Enter new password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
            </div>
            <div className={styles.modalActions} style={{ marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Exam Modal */}
      {showResetModal && resetStudent && (
        <div className={styles.modalOverlay} onClick={() => setShowResetModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 20 }}>Reset Exam for {resetStudent.name}</h3>
            <p style={{ marginBottom: 16, color: "var(--text-muted)", fontSize: 14 }}>
              Enter the exact name of the exam you want to reset. All progress and answers for this exam will be deleted for this student.
            </p>
            <div className={styles.formGroup}>
              <label>Exam Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={resetExamName} 
                onChange={e => setResetExamName(e.target.value)} 
                placeholder="e.g. Midterm 1"
              />
            </div>
            <div className={styles.modalActions} style={{ marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setShowResetModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "var(--danger)" }} onClick={handleResetExamAction} disabled={!resetExamName.trim()}>Reset Exam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
