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
  if (typeof window !== "undefined") {
    // Clear both the global key and any student-scoped keys
    localStorage.removeItem(STORAGE_KEY);
    // Also clear the student-specific key
    const key = getStorageKey();
    if (key !== STORAGE_KEY) {
      localStorage.removeItem(key);
    }
  }
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
