"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchAdminFaculty,
  createAdminFaculty,
  updateAdminFaculty,
  deleteAdminFaculty,
  FacultyMember,
} from "@/lib/api";
import { BRANCHES as ALL_BRANCH_DATA } from "@/lib/constants";
import adminStyles from "../../app/admin/admin-management.module.css";
import styles from "../../app/admin/admin.module.css";
import Skeleton from "@/components/Skeleton";
import FacultyQuestionsTab from "./FacultyQuestionsTab";

export default function FacultyTab() {
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FacultyMember | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<FacultyMember | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    branches: [] as string[],
    categories: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminFaculty();
      setFaculty(data.faculty || []);
    } catch (err) {
      console.error("Failed to fetch faculty:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!formData.name) return alert("Name is required");
    if (!formData.email) return alert("Email is required");
    if (formData.branches.length === 0) return alert("At least one branch is required");
    if (!editing && !formData.password) return alert("Password is required for new faculty");

    try {
      if (editing) {
        const updateData: any = {};
        if (formData.name) updateData.name = formData.name;
        if (formData.email) updateData.email = formData.email;
        if (formData.password) updateData.password = formData.password;
        if (formData.branches.length > 0) updateData.branches = formData.branches;
        updateData.categories = formData.categories;
        
        await updateAdminFaculty(editing.id, updateData);
      } else {
        await createAdminFaculty(formData);
      }
      setShowModal(false);
      setEditing(null);
      setFormData({ name: "", email: "", password: "", branches: [], categories: [] });
      load();
    } catch (e: any) {
      alert(e.message || "Failed to save faculty");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this faculty account?")) return;
    try {
      await deleteAdminFaculty(id);
      load();
    } catch (e: any) {
      alert("Failed to delete faculty: " + e.message);
    }
  };

  const handleBranchToggle = (branchId: string) => {
    setFormData(prev => {
      const isSelected = prev.branches.includes(branchId);
      if (isSelected) {
        return { ...prev, branches: prev.branches.filter(b => b !== branchId) };
      } else {
        return { ...prev, branches: [...prev.branches, branchId] };
      }
    });
  };

  const handleCategoryToggle = (cat: string) => {
    setFormData(prev => {
      const isSelected = prev.categories.includes(cat);
      if (isSelected) {
        return { ...prev, categories: prev.categories.filter(c => c !== cat) };
      } else {
        return { ...prev, categories: [...prev.categories, cat] };
      }
    });
  };

  if (selectedDashboard) {
    return (
      <div style={{ padding: "24px" }}>
        <button
          className="btn btn-outline"
          onClick={() => setSelectedDashboard(null)}
          style={{ marginBottom: 20, padding: "8px 16px", borderRadius: 8 }}
        >
          ← Back to Faculty List
        </button>
        <div style={{ padding: 24, background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid var(--border)", marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{selectedDashboard.name}'s Dashboard</h2>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Managing questions and folders assigned to {selectedDashboard.name}
          </div>
        </div>
        
        {/* Render the Faculty's Question Dashboard */}
        <FacultyQuestionsTab
          branches={selectedDashboard.branches}
          profile={{
            faculty_id: selectedDashboard.id,
            name: selectedDashboard.name,
            email: selectedDashboard.email,
            branches: selectedDashboard.branches
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 600 }}>Faculty Management</h2>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Control decentralized zone access and administrative authority
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setFormData({ name: "", email: "", password: "", branches: [], categories: [] });
            setShowModal(true);
          }}
          style={{ padding: "10px 16px", borderRadius: 12, fontWeight: 600 }}
        >
          + Add Faculty
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Assigned Branches</th>
                <th>Categories</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {faculty.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    No faculty members found.
                  </td>
                </tr>
              ) : (
                faculty.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.name}</td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{f.email}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {f.branches.map(b => (
                          <span key={b} className="badge badge-neutral" style={{ fontSize: 11, padding: "2px 6px" }}>
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(f.categories || []).map(c => (
                          <span key={c} className="badge badge-neutral" style={{ fontSize: 11, padding: "2px 6px" }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${f.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {f.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 12, padding: "4px 8px", background: "var(--accent)", color: "#000", border: "none" }}
                          onClick={() => setSelectedDashboard(f)}
                        >
                          Dashboard
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: 12, padding: "4px 8px" }}
                          onClick={() => {
                            setEditing(f);
                            setFormData({
                              name: f.name,
                              email: f.email,
                              password: "",
                              branches: f.branches,
                              categories: f.categories || [],
                            });
                            setShowModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: 12, padding: "4px 8px", borderColor: "rgba(239, 68, 68, 0.3)", color: "var(--danger)" }}
                          onClick={() => handleDelete(f.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={adminStyles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={adminStyles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 20 }}>{editing ? "Edit Faculty" : "Add Faculty"}</h3>
            
            <div className={adminStyles.formGroup}>
              <label>Full Name</label>
              <input
                className={adminStyles.input}
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Dr. Example"
              />
            </div>
            
            <div className={adminStyles.formGroup}>
              <label>Email Address</label>
              <input
                className={adminStyles.input}
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="faculty@college.edu"
              />
            </div>

            <div className={adminStyles.formGroup}>
              <label>{editing ? "New Password (leave blank to keep)" : "Password"}</label>
              <input
                type="password"
                className={adminStyles.input}
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>

            <div className={adminStyles.formGroup}>
              <label>Branch Assignment</label>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: 10,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
                padding: 16,
                borderRadius: 12,
                maxHeight: 200,
                overflowY: "auto"
              }}>
                {ALL_BRANCH_DATA.map(branch => (
                  <label key={branch.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input 
                      type="checkbox" 
                      checked={formData.branches.includes(branch.id)}
                      onChange={() => handleBranchToggle(branch.id)}
                      style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                    />
                    {branch.name} ({branch.id})
                  </label>
                ))}
              </div>
            </div>

            <div className={adminStyles.formGroup}>
              <label>Question Categories</label>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: 10,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
                padding: 16,
                borderRadius: 12,
              }}>
                {["aptitude", "programming", "other"].map(cat => (
                  <label key={cat} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, textTransform: "capitalize" }}>
                    <input 
                      type="checkbox" 
                      checked={formData.categories.includes(cat)}
                      onChange={() => handleCategoryToggle(cat)}
                      style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>

            <div className={adminStyles.modalActions} style={{ marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleSave}
                disabled={!formData.name || !formData.email || (!editing && !formData.password) || formData.branches.length === 0}
              >
                Save Identity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
