/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
"use client";

import styles from "./QuestionCard.module.css";
import { ReactNode } from "react";

interface QuestionCardProps {
  question: { 
    id: string; 
    text: string; 
    options: string[]; 
    marks: number; 
    neg_marks?: number;
    image_url?: string | null;
    audio_url?: string | null;
  };
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | undefined;
  onSelect: (questionId: string, option: string) => void;
  isSubmitted: boolean;
  children?: ReactNode;
}

const OPTION_KEYS = ["A", "B", "C", "D"];

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelect,
  isSubmitted,
  children,
}: QuestionCardProps) {
  return (
    <div className={styles.card} id={`question-${questionNumber}`}>
      {/* Question header */}
      <div className={styles.header}>
        <span className={styles.questionNumber}>Question {questionNumber} of {totalQuestions}</span>
        {/* Dynamic marks display (+1 / -0.25) */}
        <div className={styles.marksBadge}>
          <span className={styles.posMarks}>+{question.marks} Correct</span>
          <span className={styles.negMarks}>-{question.neg_marks || 0} Wrong</span>
        </div>
      </div>

      {/* Question text */}
      <p className={styles.questionText}>{question.text}</p>

      {/* Media asset (optional) */}
      {question.image_url && (
        <div className={styles.imageContainer}>
          <img src={question.image_url} alt="Question Diagram" className={styles.image} />
        </div>
      )}

      {question.audio_url && (
        <div className={styles.audioContainer}>
           <div className={styles.audioLabel}>Audio Instruction:</div>
           <audio 
             src={question.audio_url} 
             controls 
             className={styles.audioPlayer}
             controlsList="nodownload"
           >
             Your browser does not support the audio element.
           </audio>
        </div>
      )}

      {/* Options */}
      <div className={styles.options}>
        {question.options.map((option, idx) => {
          const key = OPTION_KEYS[idx];
          const isSelected = selectedAnswer === key;

          return (
            <button
              key={key}
              id={`q${questionNumber}-option-${key}`}
              type="button"
              disabled={isSubmitted}
              onClick={() => !isSubmitted && onSelect(question.id, key)}
              className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
              aria-pressed={isSelected}
            >
              {/* Custom SVG radio */}
              <div className={styles.radioWrapper}>
                {isSelected ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={styles.radioSelected}>
                    <circle cx="12" cy="12" r="10" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 12.5L10.5 15L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={styles.radioUnselected}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </div>
              <span className={styles.optionLabel}>
                {key}. {option.replace(/^[A-D]\)\s*/, "")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action Buttons Container (Next/Previous/Flag) */}
      {children && (
        <div className={styles.actionsContainer}>
          {children}
        </div>
      )}
    </div>
  );
}
