/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import AntiCheat from "@/components/AntiCheat";
import { useFullscreen } from "@/hooks/useFullscreen";
import {
  fetchTechRelayConfig,
  fetchTechRelayProgress,
  startTechRelay,
  submitTechRelayRound,
  type TechRelayRound,
  type TechRelayProgress,
} from "@/lib/api";
import CrackPasswordRound from "@/components/CrackPasswordRound";
import styles from "./tech-relay.module.css";

// ── Round Icons ──────────────────────────────────────────────────
const ROUND_ICONS: Record<string, string> = {
  gadget: "🔍",
  puzzle: "🧩",
  debug: "🐛",
  mcq: "📝",
  password: "🔐",
};

const ROUND_CSS: Record<string, string> = {
  gadget: styles.roundIconGadget,
  puzzle: styles.roundIconPuzzle,
  debug: styles.roundIconDebug,
  mcq: styles.roundIconMcq,
  password: styles.roundIconPassword,
};

// ── Confetti Effect ──────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      color: string; size: number; rotation: number; rotSpeed: number;
    }> = [];

    const colors = ["#6366f1", "#a5b4fc", "#fbbf24", "#34d399", "#f87171", "#818cf8", "#06b6d4"];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }

    let frame = 0;
    const maxFrames = 180;
    let frameId = 0;

    function animate() {
      if (frame >= maxFrames || !ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      frame++;
      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className={styles.confettiCanvas} />;
}

// ── Content Parser Helper ─────────────────────────────────────────
function parseContent<T = Record<string, unknown>>(raw: unknown): T {
  if (!raw) return {} as T;
  if (typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return (typeof parsed === "string" ? JSON.parse(parsed) : parsed) as T;
    } catch {
      return {} as T;
    }
  }
  return {} as T;
}

// ── Round Renderers ──────────────────────────────────────────────

interface SubQuestionProps {
  round: TechRelayRound;
  subIndex: number;
  answer: string;
  setAnswer: (v: string) => void;
}

function GadgetRound({ round, subIndex, answer, setAnswer }: SubQuestionProps) {
  const content = parseContent<{
    questions?: Array<{ gadget_name?: string; clues?: Array<{ letter: string; clue: string }> }>;
    clues?: Array<{ letter: string; clue: string }>;
  }>(round.content);

  const subQ = content?.questions && content.questions[subIndex] ? content.questions[subIndex] : content;
  const clues = subQ?.clues || [];

  return (
    <>
      <div className={styles.cluesGrid}>
        {clues.map((c, i) => (
          <div key={`clue-${round.round_number}-${subIndex}-${i}`} className={styles.clueCard}>
            <div className={styles.clueLetter}>{c.letter || `#${i + 1}`}</div>
            <div className={styles.clueHint}>{c.clue}</div>
          </div>
        ))}
      </div>
      <div className={styles.inputGroup}>
        <input
          className={styles.answerInput}
          type="text"
          placeholder="Enter the gadget name..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          autoComplete="off"
        />
      </div>
    </>
  );
}

function PasswordGateRound({
  r1Answer,
  answer,
  setAnswer,
  onSubmit,
  submitting,
}: {
  r1Answer: string;
  answer: string;
  setAnswer: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const displayCodename = r1Answer ? r1Answer.trim().toUpperCase() : "CAMERA";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Display Round 1 Answer on Screen */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)",
          border: "1px solid rgba(165, 180, 252, 0.35)",
          borderRadius: 16,
          padding: "24px 20px",
          textAlign: "center",
          boxShadow: "0 8px 30px rgba(99, 102, 241, 0.18)",
          position: "relative",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(99, 102, 241, 0.25)",
            border: "1px solid rgba(165, 180, 252, 0.4)",
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            color: "#a5b4fc",
            letterSpacing: "0.5px",
            marginBottom: 10,
          }}
        >
          <span>🏷️</span> ROUND 1 SOLVED GADGET
        </div>

        <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.65)", marginBottom: 8 }}>
          Your Solved Round 1 Gadget Codename:
        </div>

        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: "4px",
            fontFamily: "monospace",
            background: "linear-gradient(135deg, #34d399, #38bdf8, #818cf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 16px rgba(52, 211, 153, 0.45))",
            padding: "4px 0",
          }}
        >
          {displayCodename}
        </div>

        <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.45)", marginTop: 6 }}>
          ✓ Verified and securely locked into your tournament session state
        </div>
      </div>

      {/* Password Input Dialog Box */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.09)",
          borderRadius: 16,
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#ffffff",
              margin: "0 0 6px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>🔐</span> Enter the Password
          </h3>
          <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", margin: 0, lineHeight: 1.5 }}>
            <strong style={{ color: "#38bdf8" }}>Predefined Security Gate:</strong> Enter the security password corresponding to your Round 1 Gadget (<strong style={{ color: "#34d399" }}>{displayCodename}</strong>) to verify authorization. Only exact matches unlock Round 3.
          </p>
        </div>

        <div className={styles.inputGroup} style={{ marginTop: 4 }}>
          <input
            className={styles.answerInput}
            type="text"
            placeholder="Enter the Password..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
            autoFocus
            autoComplete="off"
            style={{
              letterSpacing: "1.5px",
              fontFamily: "monospace",
              fontSize: 16,
              textAlign: "center",
            }}
          />
        </div>

        <button
          className={styles.submitBtn}
          onClick={onSubmit}
          disabled={submitting || !answer.trim()}
          style={{ width: "100%", marginTop: 4 }}
        >
          {submitting ? "Verifying Security Gate..." : "🔓 Verify & Unlock Round 3 →"}
        </button>
      </div>
    </div>
  );
}

interface HtmlQuestionItem {
  question: string;
  options: string[];
  correct?: number;
  explanation?: string;
}

const DEFAULT_R3_HTML_QUESTIONS: HtmlQuestionItem[] = [
  {
    question: "What does HTML stand for?",
    options: [
      "Hyper Trainer Marking Language",
      "Hyper Text Markup Language",
      "Hyper Text Marketing Language",
      "Hyper Tool Multi Language",
    ],
    correct: 1,
    explanation: "HTML stands for Hyper Text Markup Language, the standard markup language for web pages.",
  },
  {
    question: "Which HTML tag is used to create the largest heading?",
    options: ["<head>", "<h6>", "<heading>", "<h1>"],
    correct: 3,
    explanation: "<h1> defines the most important and largest heading, down to <h6> which is the smallest.",
  },
  {
    question: "What is the correct HTML tag for inserting a line break?",
    options: ["<lb>", "<break>", "<br>", "<ln>"],
    correct: 2,
    explanation: "<br> inserts a single line break in the text.",
  },
  {
    question: "Which HTML tag is used to create a hyperlink?",
    options: ["<link>", "<a>", "<href>", "<url>"],
    correct: 1,
    explanation: "The anchor tag <a> is used to create hyperlinks connecting one page to another.",
  },
  {
    question: "Which attribute is used to specify the URL of an image in the <img> tag?",
    options: ["src", "href", "link", "url"],
    correct: 0,
    explanation: "The src (source) attribute specifies the path/URL to the image file.",
  },
  {
    question: "Which HTML element is used to define an unordered list (bulleted list)?",
    options: ["<ol>", "<list>", "<ul>", "<bl>"],
    correct: 2,
    explanation: "<ul> creates an unordered bulleted list, whereas <ol> creates an ordered numbered list.",
  },
  {
    question: "How can you make a text bold in HTML?",
    options: ["<bold>", "<b>", "<bb>", "<emp>"],
    correct: 1,
    explanation: "The <b> tag (or <strong>) is used to render text in bold format.",
  },
  {
    question: "Which character is used to indicate an end tag in HTML?",
    options: ["^", "*", "/", "\\"],
    correct: 2,
    explanation: "A forward slash (< / >) is used inside the closing tag to denote the end of an element.",
  },
  {
    question: "What is the correct HTML element for inserting an image?",
    options: ["<image>", "<img>", "<pic>", "<src>"],
    correct: 1,
    explanation: "<img> is the standard tag used to embed images in an HTML document.",
  },
  {
    question: "Which HTML element is used to create a table row?",
    options: ["<tb>", "<tr>", "<td>", "<table-row>"],
    correct: 1,
    explanation: "<tr> stands for table row, which contains table cells (<td> or <th>).",
  },
];

function HtmlAssessmentRound({
  round,
  answers,
  setAnswers,
}: {
  round: TechRelayRound;
  answers: number[];
  setAnswers: (v: number[]) => void;
}) {
  const content = parseContent<{
    target_required?: number;
    quiz_title?: string;
    subject?: string;
    questions?: HtmlQuestionItem[];
  }>(round.content);

  const rawQuestions = content?.questions || [];
  const questions: HtmlQuestionItem[] =
    rawQuestions.length >= 10 ? rawQuestions : DEFAULT_R3_HTML_QUESTIONS;
  const answeredCount = answers.filter((a) => a !== -1).length;
  const optionLetters = ["A", "B", "C", "D"];

  function handleSelect(qIndex: number, optionIndex: number) {
    const updated = [...answers];
    updated[qIndex] = optionIndex;
    setAnswers(updated);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Round 3 Assessment Banner */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f97316", letterSpacing: "0.5px" }}>
            ROUND 3: HTML BASIC PRACTICE ASSESSMENT (10 MCQs)
          </div>
          <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginTop: 2 }}>
            Subject: Web Technologies / Programming for Problem Solving
          </div>
          <div style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, marginTop: 4 }}>
            Must answer at least <span style={{ color: "#34d399", fontWeight: 800 }}>3 questions correctly</span> to unlock Round 4
          </div>
          <div style={{ fontSize: 12, color: "#f87171", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚠️</span> <span>Scoring less than 3 correct will trigger <strong>immediate disqualification & game over</strong>.</span>
          </div>
        </div>
        <div
          style={{
            padding: "6px 16px",
            borderRadius: 20,
            background:
              answeredCount === questions.length ? "rgba(52, 211, 153, 0.2)" : "rgba(249, 115, 22, 0.15)",
            border:
              answeredCount === questions.length
                ? "1px solid rgba(52, 211, 153, 0.5)"
                : "1px solid rgba(249, 115, 22, 0.4)",
            fontSize: 12,
            fontWeight: 800,
            color: answeredCount === questions.length ? "#34d399" : "#fb923c",
          }}
        >
          {answeredCount} / {questions.length} Answered
        </div>
      </div>

      {/* 10 Questions List */}
      <div className={styles.mcqList}>
        {questions.map((q, qi) => (
          <div key={`html-mcq-${round.round_number}-${qi}`} className={styles.mcqQuestion}>
            <p className={styles.mcqQuestionText}>
              <span style={{ color: "#f97316", fontWeight: 800, marginRight: 6 }}>{qi + 1}.</span>
              {q.question}
            </p>
            <div className={styles.mcqOptions}>
              {q.options.map((opt, oi) => {
                const isSelected = answers[qi] === oi;
                return (
                  <div
                    key={`opt-r3-${qi}-${oi}`}
                    className={`${styles.mcqOption} ${isSelected ? styles.mcqOptionSelected : ""}`}
                    onClick={() => handleSelect(qi, oi)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleSelect(qi, oi);
                    }}
                  >
                    <div className={`${styles.mcqRadio} ${isSelected ? styles.mcqRadioSelected : ""}`}>
                      {isSelected && <div className={styles.mcqRadioDot} />}
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        color: isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.4)",
                        marginRight: 4,
                      }}
                    >
                      {optionLetters[oi]})
                    </span>
                    <span>{opt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_R4_TECH_QUIZ_QUESTIONS = [
  {
    question: "Who is the co-founder and famous former CEO of Apple?",
    options: ["Bill Gates", "Steve Jobs", "Elon Musk", "Mark Zuckerberg"],
    correct: 1,
  },
  {
    question:
      "Which popular social media platform was founded by Mark Zuckerberg and his college roommates in 2004?",
    options: ["Twitter", "Instagram", "Facebook", "LinkedIn"],
    correct: 2,
  },
  {
    question: "Who is the billionaire entrepreneur behind companies like SpaceX and Tesla?",
    options: ["Jeff Bezos", "Elon Musk", "Sundar Pichai", "Satya Nadella"],
    correct: 1,
  },
  {
    question: 'What does the "USB" acronym stand for in computer hardware?',
    options: [
      "Universal Serial Bus",
      "Useful System Board",
      "Ultra Speed Byte",
      "Unified Software Bridge",
    ],
    correct: 0,
  },
  {
    question: "Which company created the popular Android mobile operating system?",
    options: ["Apple", "Microsoft", "Google", "IBM"],
    correct: 2,
  },
  {
    question: 'What does "Wi-Fi" stand for in wireless networking?',
    options: [
      "Wireless Fidelity",
      "Wide Field",
      "Wired Filter",
      "It doesn't stand for anything (it's just a catchphrase)",
    ],
    correct: 3,
  },
  {
    question: "Who founded the e-commerce giant Amazon in 1994?",
    options: ["Jeff Bezos", "Bill Gates", "Steve Jobs", "Larry Page"],
    correct: 0,
  },
  {
    question: "What is the main function of a computer's RAM (Random Access Memory)?",
    options: [
      "Permanent storage for photos and videos",
      "Temporary working memory for active tasks",
      "Cooling down the processor",
      "Supplying battery power",
    ],
    correct: 1,
  },
  {
    question:
      "Which search engine was created by Larry Page and Sergey Brin while they were students at Stanford University?",
    options: ["Yahoo", "Bing", "Google", "Ask Jeeves"],
    correct: 2,
  },
  {
    question: 'What does the "PDF" file format stand for?',
    options: [
      "Portable Document Format",
      "Printable Data File",
      "Program Document Folder",
      "Public Digital File",
    ],
    correct: 0,
  },
];

function TechQuizRound({
  round,
  mcqAnswers,
  setMcqAnswers,
}: {
  round: TechRelayRound;
  mcqAnswers: number[];
  setMcqAnswers: (v: number[]) => void;
}) {
  const content = parseContent<{
    target_required?: number;
    questions?: Array<{ question: string; options: string[] }>;
  }>(round.content);

  const rawQuestions = content?.questions || [];
  const questions =
    rawQuestions.length >= 10 &&
    rawQuestions.some((q) => q.question && q.question.toLowerCase().includes("apple"))
      ? rawQuestions
      : DEFAULT_R4_TECH_QUIZ_QUESTIONS;

  const answeredCount = mcqAnswers.filter((a) => a !== -1).length;
  const optionLetters = ["A", "B", "C", "D"];

  function handleSelect(qIndex: number, optionIndex: number) {
    const updated = [...mcqAnswers];
    updated[qIndex] = optionIndex;
    setMcqAnswers(updated);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Round 4 Requirement Notice */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", letterSpacing: "0.5px" }}>
            ROUND 4: INTRODUCTORY ENGINEERING ASSESSMENT (10 MCQs)
          </div>
          <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginTop: 2 }}>
            Introductory Engineering MCQ Assessment
          </div>
          <div style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, marginTop: 4 }}>
            Must answer at least <span style={{ color: "#34d399", fontWeight: 800 }}>4 questions correctly</span> to unlock the Final Round
          </div>
          <div style={{ fontSize: 12, color: "#f87171", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚠️</span> <span>Scoring less than 4 correct will trigger <strong>immediate disqualification & game over</strong>.</span>
          </div>
        </div>
        <div
          style={{
            padding: "6px 16px",
            borderRadius: 20,
            background:
              answeredCount === questions.length ? "rgba(52, 211, 153, 0.2)" : "rgba(56, 189, 248, 0.15)",
            border:
              answeredCount === questions.length
                ? "1px solid rgba(52, 211, 153, 0.5)"
                : "1px solid rgba(56, 189, 248, 0.4)",
            fontSize: 12,
            fontWeight: 800,
            color: answeredCount === questions.length ? "#34d399" : "#38bdf8",
          }}
        >
          {answeredCount} / {questions.length} Answered
        </div>
      </div>

      {/* 10 Questions List */}
      <div className={styles.mcqList}>
        {questions.map((q, qi) => (
          <div key={`mcq-${round.round_number}-${qi}`} className={styles.mcqQuestion}>
            <p className={styles.mcqQuestionText}>
              <span style={{ color: "#38bdf8", fontWeight: 800, marginRight: 6 }}>{qi + 1}.</span>
              {q.question}
            </p>
            <div className={styles.mcqOptions}>
              {q.options.map((opt, oi) => {
                const isSelected = mcqAnswers[qi] === oi;
                return (
                  <div
                    key={`opt-${round.round_number}-${qi}-${oi}`}
                    className={`${styles.mcqOption} ${isSelected ? styles.mcqOptionSelected : ""}`}
                    onClick={() => handleSelect(qi, oi)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleSelect(qi, oi);
                    }}
                  >
                    <div className={`${styles.mcqRadio} ${isSelected ? styles.mcqRadioSelected : ""}`}>
                      {isSelected && <div className={styles.mcqRadioDot} />}
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        color: isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.4)",
                        marginRight: 4,
                      }}
                    >
                      {optionLetters[oi]})
                    </span>
                    <span>{opt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StudentInfo {
  usn: string;
  name: string;
}

function getStoredStudent(): StudentInfo {
  let usn = "";
  let name = "";
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("exam_student") || sessionStorage.getItem("exam_student");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.usn) usn = String(parsed.usn);
        if (parsed?.name) name = String(parsed.name);
      }
    } catch {
      // ignore
    }

    if (!usn || !name) {
      try {
        const token = localStorage.getItem("exam_token");
        if (token && token.includes(".")) {
          const parts = token.split(".");
          if (parts[1]) {
            const payload = JSON.parse(atob(parts[1]));
            if (!usn && payload?.usn) usn = String(payload.usn);
            if (!name && payload?.name) name = String(payload.name);
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return { usn: usn.trim(), name: name.trim() };
}

// ══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function TechRelayPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  const [studentInfo, setStudentInfo] = useState<StudentInfo>(() => getStoredStudent());
  const [rounds, setRounds] = useState<TechRelayRound[]>([]);
  const [progress, setProgress] = useState<TechRelayProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRound, setActiveRound] = useState(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Round 1 and Round 3 state
  const [r1Answer, setR1Answer] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tech_relay_r1_answer") || "";
    }
    return "";
  });
  const [r3Solved, setR3Solved] = useState<number[]>([]);

  // Input states
  const [textAnswer, setTextAnswer] = useState("");
  const [r3Answers, setR3Answers] = useState<number[]>(() => new Array(10).fill(-1));
  const [mcqAnswers, setMcqAnswers] = useState<number[]>([]);

  // AntiCheat state
  const [warningCount, setWarningCount] = useState(0);
  const [isTerminated, setIsTerminated] = useState(false);
  const { isFullscreen, enter: enterFullscreen } = useFullscreen();

  // Start Gate state (code: "Meet")
  const [startCode, setStartCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // Feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Repeating Name / USN Security Watermark Style in Background
  const watermarkStyle = useMemo(() => {
    if (!isMounted) return {};
    const studentUsn = (studentInfo.usn || "CANDIDATE").toUpperCase();
    const studentName = (studentInfo.name || "STUDENT").toUpperCase();
    const watermarkText = `USN: ${studentUsn} • ${studentName}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="290" viewBox="0 0 480 290">
      <text x="240" y="145" fill="rgba(255,255,255,0.085)" font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="900" text-anchor="middle" transform="rotate(-23 240 145)">${watermarkText}</text>
    </svg>`;
    return {
      backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: "none" as const,
      userSelect: "none" as const,
      zIndex: 1,
    };
  }, [studentInfo]);

  const handleAutoSubmit = useCallback(() => {
    setIsTerminated(true);
    setFeedback({
      type: "error",
      message: "⚠️ Challenge Terminated: Auto-submitted due to repeated security violations (tab switch, window blur, or unauthorized shortcuts)."
    });
  }, []);

  const handleStartRelay = async () => {
    if (!startCode.trim() || starting) return;
    setStartError("");
    setStarting(true);
    try {
      const res = await startTechRelay(startCode.trim());
      if (res.success) {
        setIsTerminated(false);
        setWarningCount(0);
        setProgress((prev) => ({
          current_round: res.current_round || 1,
          current_question_index: 0,
          rounds_completed: prev?.rounds_completed || [],
          is_completed: res.is_completed || false,
          started_at: res.started_at,
          completed_at: prev?.completed_at || null,
        }));
        setActiveRound(res.current_round || 1);
        setCurrentQuestionIndex(0);
        try {
          enterFullscreen();
        } catch {
          // ignore
        }
      } else {
        setStartError(res.message || "Failed to start challenge");
      }
    } catch (err: any) {
      const msg = err?.detail || err?.message || "Invalid start code. Please enter 'Meet' to start.";
      setStartError(msg);
    } finally {
      setStarting(false);
    }
  };

  // ── Load Data ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const s = getStoredStudent();
      if (s.usn || s.name) {
        setStudentInfo(s);
      }
      const [roundsData, progressData] = await Promise.all([
        fetchTechRelayConfig(),
        fetchTechRelayProgress(),
      ]);
      setRounds(roundsData);
      setProgress(progressData);

      // Hydrate Round 1 answer and Round 3 solved from progress or localStorage
      if (progressData?.r1_answer) {
        setR1Answer(progressData.r1_answer);
        if (typeof window !== "undefined") {
          localStorage.setItem("tech_relay_r1_answer", progressData.r1_answer);
        }
      } else if (typeof window !== "undefined") {
        const cached = localStorage.getItem("tech_relay_r1_answer");
        if (cached) setR1Answer(cached);
      }

      if (progressData?.r3_solved && Array.isArray(progressData.r3_solved)) {
        setR3Solved(progressData.r3_solved);
      }

      // Check if student has not started or was reset
      const hasStartedProg = Boolean(
        progressData?.started_at ||
        (progressData?.rounds_completed && progressData.rounds_completed.length > 0) ||
        (progressData?.current_round && progressData.current_round > 1)
      );
      if (!hasStartedProg) {
        setIsTerminated(false);
        setWarningCount(0);
      }

      // Set active round and sub-question index to current progress
      const currentRound = progressData.current_round || 1;
      setActiveRound(Math.min(currentRound, 5));
      setCurrentQuestionIndex(progressData.current_question_index || 0);
    } catch (e) {
      console.error("Failed to load Tech Relay:", e);
      setError("Failed to load Tech Relay. Make sure you are logged in.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sync MCQ Answer slots whenever active round is MCQ (Round 4) ─────────
  useEffect(() => {
    const currentCfg = rounds.find((r) => r.round_number === activeRound);
    if (currentCfg && currentCfg.round_type === "mcq") {
      const content = parseContent<{ questions?: unknown[] }>(currentCfg.content);
      const qCount = content?.questions?.length || 10;
      setMcqAnswers((prev) => (prev.length === qCount ? prev : new Array(qCount).fill(-1)));
    } else {
      setMcqAnswers([]);
    }
  }, [activeRound, rounds]);

  useEffect(() => {
    const token = localStorage.getItem("exam_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    loadData();
  }, [loadData, router]);

  // ── Polling for Admin Force Stop or Remote Completion ──────
  useEffect(() => {
    if (!progress || progress.is_completed || isTerminated) return;

    const interval = setInterval(async () => {
      try {
        const latest = await fetchTechRelayProgress();
        if (latest && latest.is_completed) {
          setProgress(latest);
        }
      } catch {
        // Silently ignore background polling errors
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [progress, isTerminated]);

  // ── Submit Handler ───────────────────────────────────────────
  async function handleSubmit(overrideAnswer?: string, overrideQIdx?: number) {
    if (submitting || isTerminated) return;
    setFeedback(null);
    setSubmitting(true);

    const currentRoundConfig = rounds.find(r => r.round_number === activeRound);
    if (!currentRoundConfig) {
      setFeedback({ type: "error", message: "Round not configured" });
      setSubmitting(false);
      return;
    }

    let answer = typeof overrideAnswer === "string" ? overrideAnswer : textAnswer;
    const targetQIdx = typeof overrideQIdx === "number" ? overrideQIdx : currentQuestionIndex;

    if (activeRound === 3) {
      if (r3Answers.length < 10 || r3Answers.some((a) => a === -1)) {
        setFeedback({ type: "error", message: "Please select an answer for all 10 HTML questions before submitting!" });
        setSubmitting(false);
        return;
      }
      answer = JSON.stringify({ answers: r3Answers });
    } else if (activeRound === 4 || currentRoundConfig.round_type === "mcq") {
      const content = parseContent<{ questions?: unknown[] }>(currentRoundConfig.content);
      const qCount = content?.questions?.length || 10;
      if (mcqAnswers.length < qCount || mcqAnswers.some((a) => a === -1)) {
        setFeedback({ type: "error", message: `Please select an answer for all ${qCount} questions before submitting!` });
        setSubmitting(false);
        return;
      }
      answer = JSON.stringify({ answers: mcqAnswers });
    }

    if (!answer.trim()) {
      setFeedback({ type: "error", message: "Please enter your answer" });
      setSubmitting(false);
      return;
    }

    try {
      const result = await submitTechRelayRound(activeRound, answer, targetQIdx);

      // ── Handle Immediate Disqualification / Game Over ──────────
      if (result.disqualified || (result.is_completed && !result.success)) {
        const updatedProgress = await fetchTechRelayProgress();
        setProgress(
          updatedProgress || {
            ...progress,
            is_completed: true,
            disqualified: true,
            disqualification_reason: result.message,
            r3_score: result.r3_score ?? progress?.r3_score ?? 0,
            r4_score: result.r4_score ?? 0,
            final_score: result.final_score ?? ((result.r3_score ?? 0) + (result.r4_score ?? 0)),
          }
        );
        setFeedback({ type: "error", message: result.message });
        return;
      }

      if (result.success) {
        setFeedback({ type: "success", message: result.message });
        setTextAnswer("");

        if (result.r1_answer) {
          setR1Answer(result.r1_answer);
          if (typeof window !== "undefined") {
            localStorage.setItem("tech_relay_r1_answer", result.r1_answer);
          }
        }
        if (result.r3_solved) {
          setR3Solved(result.r3_solved);
        }

        if (result.round_cleared === false) {
          // Solved sub-question in this round
          const nextQ = result.next_question_index ?? (targetQIdx + 1);
          setCurrentQuestionIndex(nextQ);
          setTimeout(() => setFeedback(null), 2500);
        } else {
          // Entire round cleared!
          setCurrentQuestionIndex(0);

          if (result.is_completed) {
            setShowConfetti(true);
            const updatedProgress = await fetchTechRelayProgress();
            setProgress(updatedProgress);
          } else if (result.next_round) {
            setTimeout(async () => {
              setActiveRound(result.next_round as number);
              setFeedback(null);
              setTextAnswer("");
              setMcqAnswers(prev => prev.map(() => -1));
              const updatedProgress = await fetchTechRelayProgress();
              setProgress(updatedProgress);
              if (updatedProgress?.r1_answer) {
                setR1Answer(updatedProgress.r1_answer);
                if (typeof window !== "undefined") {
                  localStorage.setItem("tech_relay_r1_answer", updatedProgress.r1_answer);
                }
              }
              if (updatedProgress?.r3_solved) {
                setR3Solved(updatedProgress.r3_solved);
              }
            }, 1200);
          }
        }
      } else {
        setFeedback({ type: "error", message: result.message });
      }
    } catch {
      setFeedback({ type: "error", message: "Submission failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render States ────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.container}>
        <div style={watermarkStyle} aria-hidden="true" />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Loading Tech Relay...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div style={watermarkStyle} aria-hidden="true" />
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push("/dashboard")}>
            ← Back
          </button>
        </div>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚡</div>
          <h2 className={styles.errorTitle}>Connection Error</h2>
          <p className={styles.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className={styles.container}>
        <div style={watermarkStyle} aria-hidden="true" />
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push("/dashboard")}>
            ← Back
          </button>
          <h1 className={styles.title}>Tech Relay</h1>
        </div>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>🚧</div>
          <h2 className={styles.errorTitle}>Coming Soon</h2>
          <p className={styles.errorText}>The Tech Relay challenge hasn&#39;t been configured yet. Check back later!</p>
        </div>
      </div>
    );
  }

  const currentRound = progress?.current_round || 1;
  const isCompleted = progress?.is_completed || false;
  const roundsCompleted = progress?.rounds_completed || [];

  // ── Completion / Results Screen ───────────────────────────────
  if (isCompleted) {
    const cleanCompleted = roundsCompleted.filter((r: any) => !(typeof r === "object" && r?._meta));
    const totalAttempts = cleanCompleted.reduce((sum: number, r: any) => sum + (r.attempts || 1), 0);
    const clearedRoundsSet = new Set(cleanCompleted.map((r: any) => r.round));
    const clearedCount = clearedRoundsSet.size;
    const isDisqualified = Boolean(progress?.disqualified);
    const isStoppedByAdmin = !isDisqualified && Boolean(progress?.stopped_by_admin || clearedCount < 5);

    // Score strictly from Round 3 (HTML) & Round 4 (Tech Quiz)
    let r3Score = progress?.r3_score ?? 0;
    let r4Score = progress?.r4_score ?? 0;

    for (const r of (cleanCompleted as any[])) {
      if (r.round === 3) {
        r3Score = Math.max(r3Score, Number(r.score ?? r.questions_solved ?? 0));
      }
      if (r.round === 4) {
        r4Score = Math.max(r4Score, Number(r.score ?? r.questions_solved ?? 0));
      }
    }

    const finalScore = r3Score + r4Score; // strictly out of 20
    const totalPercentage = Math.round((finalScore / 20) * 100);

    return (
      <div className={styles.container}>
        <div style={watermarkStyle} aria-hidden="true" />
        <Confetti active={showConfetti && !isStoppedByAdmin && !isDisqualified} />
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push("/dashboard")}>
            ← Dashboard
          </button>
        </div>
        <div
          className={styles.completionContainer}
          style={{
            maxWidth: 700,
            ...(isDisqualified
              ? {
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  boxShadow: "0 0 50px rgba(239, 68, 68, 0.15)",
                }
              : {}),
          }}
        >
          <div
            className={styles.trophyIcon}
            style={{ fontSize: isDisqualified ? 76 : isStoppedByAdmin ? 64 : 72 }}
          >
            {isDisqualified ? "🚫" : isStoppedByAdmin ? "🛑" : "🏆"}
          </div>
          <h1
            className={styles.completionTitle}
            style={
              isDisqualified
                ? {
                    background: "linear-gradient(135deg, #f87171, #ef4444, #dc2626)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }
                : isStoppedByAdmin
                ? {
                    background: "linear-gradient(135deg, #f87171, #ef4444, #dc2626)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }
                : undefined
            }
          >
            {isDisqualified
              ? "Game Over — Disqualified"
              : isStoppedByAdmin
              ? "Exam Concluded by Administrator"
              : "Tech Relay Completed!"}
          </h1>
          <p
            className={styles.completionSubtitle}
            style={isDisqualified ? { color: "#fca5a5", fontSize: 15, fontWeight: 500 } : undefined}
          >
            {isDisqualified
              ? progress?.disqualification_reason ||
                "You scored below the required passing threshold. You have been disqualified and your session has ended."
              : isStoppedByAdmin
              ? "The administrator has officially stopped the exam session. Your result has been evaluated based on your Round 3 & Round 4 MCQ performance up to this point."
              : "Outstanding work! You have finished all rounds of the Tech Relay challenge."}
          </p>

          {/* Candidate Identity Chip in Results */}
          {(studentInfo.name || studentInfo.usn) && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                margin: "0 auto 18px",
              }}
            >
              <span>👤 Candidate: <strong>{studentInfo.name || "Student"}</strong></span>
              <span style={{ opacity: 0.35 }}>|</span>
              <span style={{ color: "#38bdf8", fontWeight: 800 }}>USN: {studentInfo.usn || "N/A"}</span>
            </div>
          )}

          {/* Key Metrics: Separate Round 3 & Round 4 + Total */}
          <div className={styles.statsGrid} style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <div
              className={styles.statItem}
              style={{
                background: isDisqualified ? "rgba(239, 68, 68, 0.1)" : "rgba(56, 189, 248, 0.1)",
                borderColor: isDisqualified ? "rgba(239, 68, 68, 0.35)" : "rgba(56, 189, 248, 0.3)",
              }}
            >
              <p className={styles.statValue} style={{ color: isDisqualified ? "#f87171" : "#38bdf8" }}>
                {finalScore} <span style={{ fontSize: 15, opacity: 0.6 }}>/ 20</span>
              </p>
              <p className={styles.statLabel}>
                {isDisqualified ? "Official Final Score" : `Total MCQs Correct (${totalPercentage}%)`}
              </p>
            </div>

            <div
              className={styles.statItem}
              style={{
                background:
                  r3Score < 3 && isDisqualified ? "rgba(239, 68, 68, 0.12)" : "rgba(168, 85, 247, 0.1)",
                borderColor:
                  r3Score < 3 && isDisqualified ? "rgba(239, 68, 68, 0.45)" : "rgba(168, 85, 247, 0.3)",
              }}
            >
              <p
                className={styles.statValue}
                style={{ color: r3Score < 3 && isDisqualified ? "#f87171" : "#c084fc" }}
              >
                {r3Score} <span style={{ fontSize: 15, opacity: 0.6 }}>/ 10</span>
              </p>
              <p className={styles.statLabel}>
                Round 3 {r3Score < 3 && isDisqualified ? "(Failed < 3)" : "(HTML) Correct"}
              </p>
            </div>

            <div
              className={styles.statItem}
              style={{
                background:
                  r4Score < 4 && isDisqualified && r3Score >= 3
                    ? "rgba(239, 68, 68, 0.12)"
                    : isDisqualified && r3Score < 3
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(52, 211, 153, 0.1)",
                borderColor:
                  r4Score < 4 && isDisqualified && r3Score >= 3
                    ? "rgba(239, 68, 68, 0.45)"
                    : isDisqualified && r3Score < 3
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(52, 211, 153, 0.3)",
              }}
            >
              <p
                className={styles.statValue}
                style={{
                  color:
                    r4Score < 4 && isDisqualified && r3Score >= 3
                      ? "#f87171"
                      : isDisqualified && r3Score < 3
                      ? "rgba(255, 255, 255, 0.3)"
                      : "#34d399",
                }}
              >
                {isDisqualified && r3Score < 3 ? "—" : r4Score}{" "}
                <span style={{ fontSize: 15, opacity: 0.6 }}>/ 10</span>
              </p>
              <p className={styles.statLabel}>
                Round 4{" "}
                {isDisqualified && r3Score < 3
                  ? "(Locked)"
                  : r4Score < 4 && isDisqualified
                  ? "(Failed < 4)"
                  : "(Quiz) Correct"}
              </p>
            </div>
          </div>

          {/* Separate MCQ Breakdown Section */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 16,
              padding: "20px 24px",
              marginBottom: 20,
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(255, 255, 255, 0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>MCQ Assessments Breakdown</span>
              <span>Correct / Total</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Round 3 Card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: 12,
                  background:
                    r3Score >= 3
                      ? "rgba(168, 85, 247, 0.1)"
                      : isDisqualified
                      ? "rgba(239, 68, 68, 0.12)"
                      : "rgba(255, 255, 255, 0.03)",
                  border:
                    r3Score >= 3
                      ? "1px solid rgba(168, 85, 247, 0.35)"
                      : isDisqualified
                      ? "1px solid rgba(239, 68, 68, 0.45)"
                      : "1px solid rgba(255, 255, 255, 0.07)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 800,
                      background:
                        r3Score >= 3
                          ? "#c084fc"
                          : isDisqualified
                          ? "#ef4444"
                          : "rgba(255, 255, 255, 0.1)",
                      color: r3Score >= 3 || isDisqualified ? "#0f172a" : "rgba(255, 255, 255, 0.4)",
                    }}
                  >
                    R3
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      Round 3: HTML Basic Assessment
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color:
                          r3Score >= 3
                            ? "#c084fc"
                            : isDisqualified
                            ? "#f87171"
                            : "rgba(255, 255, 255, 0.4)",
                      }}
                    >
                      {r3Score >= 3
                        ? "✅ Passed (3+ required)"
                        : isDisqualified
                        ? "❌ Disqualified (< 3 correct required)"
                        : isStoppedByAdmin
                        ? "Incomplete at stoppage"
                        : "Needs 3+ correct"}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: r3Score >= 3 ? "#c084fc" : isDisqualified ? "#f87171" : "#fff",
                    }}
                  >
                    {r3Score} <span style={{ fontSize: 13, opacity: 0.6 }}>/ 10</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)" }}>
                    {r3Score * 10}% Accuracy
                  </div>
                </div>
              </div>

              {/* Round 4 Card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: 12,
                  background:
                    r4Score >= 4
                      ? "rgba(52, 211, 153, 0.1)"
                      : isDisqualified && r3Score < 3
                      ? "rgba(255, 255, 255, 0.02)"
                      : isDisqualified && r4Score < 4
                      ? "rgba(239, 68, 68, 0.12)"
                      : "rgba(255, 255, 255, 0.03)",
                  border:
                    r4Score >= 4
                      ? "1px solid rgba(52, 211, 153, 0.35)"
                      : isDisqualified && r3Score < 3
                      ? "1px solid rgba(255, 255, 255, 0.05)"
                      : isDisqualified && r4Score < 4
                      ? "1px solid rgba(239, 68, 68, 0.45)"
                      : "1px solid rgba(255, 255, 255, 0.07)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 800,
                      background:
                        r4Score >= 4
                          ? "#34d399"
                          : isDisqualified && r3Score >= 3 && r4Score < 4
                          ? "#ef4444"
                          : "rgba(255, 255, 255, 0.1)",
                      color:
                        r4Score >= 4 || (isDisqualified && r3Score >= 3 && r4Score < 4)
                          ? "#0f172a"
                          : "rgba(255, 255, 255, 0.4)",
                    }}
                  >
                    R4
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      Round 4: Tech Knowledge Quiz
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color:
                          r4Score >= 4
                            ? "#34d399"
                            : isDisqualified && r3Score < 3
                            ? "rgba(255, 255, 255, 0.3)"
                            : isDisqualified && r4Score < 4
                            ? "#f87171"
                            : "rgba(255, 255, 255, 0.4)",
                      }}
                    >
                      {r4Score >= 4
                        ? "✅ Passed (4+ required)"
                        : isDisqualified && r3Score < 3
                        ? "🔒 Locked (Did not qualify from Round 3)"
                        : isDisqualified && r4Score < 4
                        ? "❌ Disqualified (< 4 correct required)"
                        : isStoppedByAdmin
                        ? "Incomplete at stoppage"
                        : "Needs 4+ correct"}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color:
                        r4Score >= 4
                          ? "#34d399"
                          : isDisqualified && r3Score < 3
                          ? "rgba(255, 255, 255, 0.3)"
                          : isDisqualified && r4Score < 4
                          ? "#f87171"
                          : "#fff",
                    }}
                  >
                    {isDisqualified && r3Score < 3 ? "—" : r4Score}{" "}
                    <span style={{ fontSize: 13, opacity: 0.6 }}>/ 10</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.4)" }}>
                    {isDisqualified && r3Score < 3 ? "Not Attempted" : `${r4Score * 10}% Accuracy`}
                  </div>
                </div>
              </div>
            </div>

            {/* Note clarifying that score is strictly R3 + R4 */}
            <div
              style={{
                marginTop: 14,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.03)",
                fontSize: 11,
                color: isDisqualified ? "#fca5a5" : "rgba(255, 255, 255, 0.45)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{isDisqualified ? "⚠️" : "ℹ️"}</span>
              <span>
                {isDisqualified
                  ? "Session terminated: Minimum passing criteria was not met. Your final score of " +
                    finalScore +
                    "/20 has been officially recorded."
                  : "Assessment score is determined strictly by Round 3 (HTML) & Round 4 (Tech Quiz) MCQs (Total 20). Rounds 1, 2, and 5 are qualification stages."}
              </span>
            </div>
          </div>

          {/* Tournament Stage Completion Progress */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 18px",
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              marginBottom: 24,
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.6)",
            }}
          >
            <div>
              Tournament Status:{" "}
              <strong style={{ color: isDisqualified ? "#f87171" : "#fff" }}>
                {isDisqualified
                  ? `Disqualified at Round ${r3Score < 3 ? 3 : 4}`
                  : `${clearedCount}/5 Stages Cleared`}
              </strong>
            </div>
            <div>
              Total Attempts: <strong style={{ color: "#fff" }}>{totalAttempts}</strong>
            </div>
          </div>

          <button
            className={styles.submitBtn}
            onClick={() => router.push("/dashboard")}
            style={{
              width: "100%",
              maxWidth: 320,
              margin: "0 auto",
              ...(isDisqualified
                ? {
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
                  }
                : {}),
            }}
          >
            ← Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Start Code Gate ──────────────────────────────────────────
  const hasStarted = Boolean(
    progress?.started_at ||
    (progress?.rounds_completed && progress.rounds_completed.length > 0) ||
    (progress?.current_round && progress.current_round > 1)
  );

  if (!hasStarted) {
    return (
      <div className={styles.container}>
        <div style={watermarkStyle} aria-hidden="true" />
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push("/dashboard")}>
            ← Dashboard
          </button>
        </div>

        <div className={styles.startGateCard}>
          <div className={styles.startGateIcon}>🏁</div>
          <h1 className={styles.startGateTitle}>Tech Relay Challenge Gate</h1>
          <p className={styles.startGateSubtitle}>
            Enter the tournament access code to unlock Round 1 and begin the challenge.
          </p>

          {/* Candidate Identity Chip in Start Gate */}
          {(studentInfo.name || studentInfo.usn) && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                background: "rgba(56, 189, 248, 0.1)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                color: "#e0f2fe",
                marginBottom: 16,
              }}
            >
              <span>👤</span>
              <span>{studentInfo.name || "Student"}</span>
              <span style={{ opacity: 0.35 }}>|</span>
              <span style={{ color: "#38bdf8", fontWeight: 800 }}>USN: {studentInfo.usn}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStartRelay();
            }}
            style={{ width: "100%", maxWidth: 360, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}
          >
            <input
              type="text"
              placeholder="Enter Start Code..."
              value={startCode}
              onChange={(e) => {
                setStartCode(e.target.value);
                if (startError) setStartError("");
              }}
              className={styles.startGateInput}
              autoFocus
              autoComplete="off"
              disabled={starting}
            />

            {startError && (
              <div className={`${styles.feedback} ${styles.feedbackError}`} style={{ margin: "0 auto", width: "100%" }}>
                <span>❌</span>
                <span>{startError}</span>
              </div>
            )}

            <button
              type="submit"
              className={styles.startGateBtn}
              disabled={starting || !startCode.trim()}
            >
              {starting ? "Verifying..." : "🚀 Unlock & Start Challenge"}
            </button>
          </form>

          <div style={{ marginTop: 24, padding: "12px 18px", borderRadius: 10, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.07)", fontSize: 12, color: "rgba(255, 255, 255, 0.4)" }}>
            ℹ️ Entering the start code will record your official entry on the tournament live monitor and begin your challenge (No time limit).
          </div>
        </div>
      </div>
    );
  }

  // ── Active Round ─────────────────────────────────────────────
  const activeRoundConfig = rounds.find(r => r.round_number === activeRound);
  const isRoundAccessible = activeRound <= currentRound;

  return (
    <div className={styles.container}>
      <div style={watermarkStyle} aria-hidden="true" />
      <AntiCheat
        isSubmitted={isCompleted || isTerminated}
        examName="Tech Relay"
        onAutoSubmit={handleAutoSubmit}
        onWarningUpdate={(count) => {
          setWarningCount(count);
          if (count < 3) {
            setIsTerminated(false);
          }
        }}
      />
      <Confetti active={showConfetti} />

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Tech Relay</h1>
        <p className={styles.subtitle}>Complete all 5 rounds to conquer the challenge</p>

        {/* Anti-Cheat Telemetry Badge & Student Badge */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {/* Candidate Info Badge */}
          {(studentInfo.name || studentInfo.usn) && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
                letterSpacing: "0.3px",
              }}
            >
              <span>👤</span>
              <span>{studentInfo.name || "Student"}</span>
              <span style={{ opacity: 0.35 }}>|</span>
              <span style={{ color: "#38bdf8", fontWeight: 800 }}>USN: {studentInfo.usn || "N/A"}</span>
            </div>
          )}

          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: warningCount > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(52, 211, 153, 0.1)",
            border: warningCount > 0 ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(52, 211, 153, 0.3)",
            color: warningCount > 0 ? "#f87171" : "#34d399",
            letterSpacing: "0.3px"
          }}>
            <span>{warningCount > 0 ? "🚨" : "🛡️"}</span>
            <span>{warningCount > 0 ? `STRIKE ${warningCount} OF 3` : "ANTI-CHEAT SHIELD ACTIVE"}</span>
          </div>

          {!isFullscreen && (
            <button
              onClick={() => enterFullscreen()}
              style={{
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                color: "#a5b4fc",
                padding: "5px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.2s"
              }}
            >
              <span>⛶</span> Enter Fullscreen
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className={styles.progressSection}>
        <div className={styles.progressTrack}>
          <div className={styles.progressLine}>
            <div
              className={styles.progressLineFill}
              style={{ width: `${((currentRound - 1) / 4) * 100}%` }}
            />
          </div>
          {[1, 2, 3, 4, 5].map(num => {
            const isComplete = num < currentRound;
            const isCurrent = num === currentRound;
            const roundConfig = rounds.find(r => r.round_number === num);
            const dotClass = isComplete ? styles.dotCompleted
              : isCurrent ? styles.dotActive
              : styles.dotLocked;
            const labelClass = isComplete ? styles.labelCompleted
              : isCurrent ? styles.labelActive
              : styles.labelLocked;

            return (
              <div
                key={`progress-${num}`}
                className={styles.progressNode}
                onClick={() => {
                  if (num <= currentRound) {
                    setActiveRound(num);
                    setFeedback(null);
                    setTextAnswer("");
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && num <= currentRound) {
                    setActiveRound(num);
                    setFeedback(null);
                    setTextAnswer("");
                  }
                }}
              >
                <div className={`${styles.progressDot} ${dotClass}`}>
                  {isComplete ? "✓" : num}
                </div>
                <span className={`${styles.progressLabel} ${labelClass}`}>
                  {roundConfig?.round_title || `Round ${num}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Round Content */}
      {isTerminated ? (
        <div className={styles.roundContainer}>
          <div className={styles.roundCard} style={{ textAlign: "center", borderColor: "rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.05)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>
              Challenge Terminated
            </h2>
            <p style={{ color: "rgba(255, 255, 255, 0.7)", maxWidth: 500, margin: "0 auto 20px", lineHeight: 1.6 }}>
              The Tech Relay challenge has been automatically terminated due to repeated anti-cheat violations (tab switching, window blur, or prohibited shortcuts).
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", margin: "0 auto", maxWidth: 460 }}>
              <button
                className={styles.submitBtn}
                style={{
                  background: "linear-gradient(135deg, #06b6d4, #6366f1)",
                  padding: "12px 24px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  borderRadius: 10,
                  border: "none",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  flex: "1 1 200px"
                }}
                onClick={() => {
                  loadData();
                  window.location.reload();
                }}
              >
                <span>🔄</span> Refresh / Check Status
              </button>
              <button
                className={styles.submitBtn}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  padding: "12px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  borderRadius: 10,
                  color: "#fff",
                  flex: "1 1 180px"
                }}
                onClick={() => router.push("/dashboard")}
              >
                ← Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : !isRoundAccessible || !activeRoundConfig ? (
        <div className={styles.lockedOverlay}>
          <div className={styles.lockIcon}>🔒</div>
          <h2 className={styles.lockedTitle}>Round Locked</h2>
          <p className={styles.lockedText}>Complete Round {currentRound} to unlock this stage</p>
        </div>
      ) : (
        <div className={styles.roundContainer}>
          <div className={styles.roundCard}>
            {/* Round Header */}
            <div className={styles.roundHeader}>
              <div className={`${styles.roundIcon} ${ROUND_CSS[activeRoundConfig.round_type] || ""}`}>
                {ROUND_ICONS[activeRoundConfig.round_type] || "❓"}
              </div>
              <div className={styles.roundTitleGroup}>
                <p className={styles.roundNumber}>Round {activeRound} of 5</p>
                <h2 className={styles.roundTitle}>{activeRoundConfig.round_title}</h2>
              </div>
            </div>

            {/* Sub-Question Navigation / Tracker */}
            {(() => {
              if (activeRound >= 2) return null;
              const activeContent = parseContent<{ questions?: unknown[] }>(activeRoundConfig?.content);
              const subQuestionsCount = activeContent?.questions && Array.isArray(activeContent.questions)
                ? activeContent.questions.length
                : 1;

              if (subQuestionsCount <= 1) return null;

              return (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255, 255, 255, 0.04)",
                  padding: "10px 16px",
                  borderRadius: 12,
                  marginBottom: 20,
                  border: "1px solid rgba(255, 255, 255, 0.08)"
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>
                    Question {currentQuestionIndex + 1} of {subQuestionsCount}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {Array.from({ length: subQuestionsCount }).map((_, idx) => (
                      <div
                        key={`subdot-${idx}`}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          background: idx < currentQuestionIndex ? "rgba(52, 211, 153, 0.2)" : idx === currentQuestionIndex ? "var(--accent, #6366f1)" : "rgba(255,255,255,0.06)",
                          color: idx < currentQuestionIndex ? "#34d399" : idx === currentQuestionIndex ? "#fff" : "rgba(255,255,255,0.4)",
                          border: idx === currentQuestionIndex ? "1px solid #818cf8" : "none"
                        }}
                      >
                        {idx < currentQuestionIndex ? "✓" : idx + 1}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Round-Specific Content */}
            {activeRound === 1 && (
              <GadgetRound
                round={activeRoundConfig}
                subIndex={currentQuestionIndex}
                answer={textAnswer}
                setAnswer={setTextAnswer}
              />
            )}
            {activeRound === 2 && (
              <PasswordGateRound
                r1Answer={r1Answer}
                answer={textAnswer}
                setAnswer={setTextAnswer}
                onSubmit={() => handleSubmit()}
                submitting={submitting}
              />
            )}
            {activeRound === 3 && (
              <HtmlAssessmentRound
                round={activeRoundConfig}
                answers={r3Answers}
                setAnswers={setR3Answers}
              />
            )}
            {activeRound === 4 && (
              <TechQuizRound
                round={activeRoundConfig}
                mcqAnswers={mcqAnswers}
                setMcqAnswers={setMcqAnswers}
              />
            )}
            {activeRound === 5 && (
              <CrackPasswordRound
                round={activeRoundConfig}
                subIndex={currentQuestionIndex}
                answer={textAnswer}
                setAnswer={setTextAnswer}
                onSubmit={(finalKey) => handleSubmit(finalKey)}
                isSubmitting={submitting}
              />
            )}

            {/* Bottom Submit Button (for Round 1, Round 3, and Round 4; Rounds 2 and 5 have their own action buttons) */}
            {activeRound === currentRound && (activeRound === 1 || activeRound === 3 || activeRound === 4) && (
              <div className={styles.inputGroup} style={{ marginTop: 20 }}>
                <button
                  className={styles.submitBtn}
                  onClick={() => handleSubmit()}
                  disabled={submitting}
                  style={{ width: "100%" }}
                >
                  {submitting
                    ? "Checking..."
                    : activeRound === 4
                    ? "Submit Tech Quiz (10 MCQs) →"
                    : activeRound === 3
                    ? "Submit HTML Assessment (10 MCQs) →"
                    : "Submit Gadget Name →"}
                </button>
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`${styles.feedback} ${feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError}`}>
                <span>{feedback.type === "success" ? "✅" : "❌"}</span>
                <span>{feedback.message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
