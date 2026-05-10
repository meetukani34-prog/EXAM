"use client";

import { useState, useCallback } from "react";

export type Answers = Record<string, string>; // { questionId: "A"|"B"|"C"|"D" }

const STORAGE_KEY = "examguard_answers";

/**
 * Get a student-scoped storage key to prevent answer leaking between students.
 * Falls back to global key if no student is logged in.
 */
function getStorageKey(): string {
  if (typeof window === "undefined") return STORAGE_KEY;
  try {
    const raw = localStorage.getItem("exam_student");
    if (raw) {
      const parsed = JSON.parse(raw);
      const studentId = parsed.id || parsed.usn;
      if (studentId) return `${STORAGE_KEY}_${studentId}`;
    }
  } catch {}
  return STORAGE_KEY;
}

function loadFromStorage(): Answers {
  if (typeof window === "undefined") return {};
  try {
    const key = getStorageKey();
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(answers: Answers) {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(answers));
  } catch {}
}

export function clearExamStorage() {
  if (typeof window === "undefined") return;

  // 1. Clear global keys
  localStorage.removeItem("examguard_answers");
  localStorage.removeItem("exam_selected_title");
  localStorage.removeItem("exam_selected_duration");
  localStorage.removeItem("pyhunt_config_local");
  localStorage.removeItem("pyhunt_global_auth");

  // 2. Clear ALL student-scoped answer keys to prevent leakage
  // We iterate through all keys and remove ones starting with "examguard_answers_"
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith("examguard_answers_") || 
      key.startsWith("pyhunt_answers_") ||
      key.startsWith("pyhunt_code_draft_") ||
      key.startsWith("pyhunt_mcq_") ||
      key.startsWith("pyhunt_progress_")
    )) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  console.log("[Storage] Cleared all exam and student-scoped answer keys.");
}

export function useExamState() {
  const [answers, setAnswers] = useState<Answers>(() => loadFromStorage());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  const selectAnswer = useCallback((questionId: string, option: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: option };
      saveToStorage(next);
      return next;
    });
    setDirtyIds((prev) => new Set(prev).add(questionId));
  }, []);

  const clearDirty = useCallback(() => {
    setDirtyIds(new Set());
  }, []);

  const getAnsweredCount = useCallback(
    (total: number) => {
      return Object.keys(answers).filter((id) => answers[id]).length;
    },
    [answers]
  );

  return { answers, dirtyIds, selectAnswer, clearDirty, getAnsweredCount };
}
