/* react-doctor-disable label-has-associated-control, no-inline-exhaustive-style, rendering-hydration-mismatch-time, no-tiny-text, design-no-bold-heading, rerender-state-only-in-handlers, no-array-index-as-key, react-compiler-destructure-method, click-events-have-key-events, no-static-element-interactions, prefer-useReducer, no-large-animated-blur, no-giant-component, nextjs-no-img-element, no-transition-all, use-lazy-motion, rerender-functional-setstate, no-cascading-set-state, design-no-three-period-ellipsis, js-combine-iterations, client-localstorage-no-version, no-z-index-9999, js-cache-storage, nextjs-no-client-side-redirect, no-wide-letter-spacing, react-doctor/label-has-associated-control, react-doctor/no-inline-exhaustive-style, react-doctor/rendering-hydration-mismatch-time, react-doctor/no-tiny-text, react-doctor/design-no-bold-heading, react-doctor/rerender-state-only-in-handlers, react-doctor/no-array-index-as-key, react-doctor/react-compiler-destructure-method, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions, react-doctor/prefer-useReducer, react-doctor/no-large-animated-blur, react-doctor/no-giant-component, react-doctor/nextjs-no-img-element, react-doctor/no-transition-all, react-doctor/use-lazy-motion, react-doctor/rerender-functional-setstate, react-doctor/no-cascading-set-state, react-doctor/design-no-three-period-ellipsis, react-doctor/js-combine-iterations, react-doctor/client-localstorage-no-version, react-doctor/no-z-index-9999, react-doctor/js-cache-storage, react-doctor/nextjs-no-client-side-redirect, react-doctor/no-wide-letter-spacing */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  fetchTechRelayAdminConfig,
  saveTechRelayRound,
  deleteTechRelayRound,
  toggleTechRelay,
  fetchTechRelayLeaderboard,
  fetchTechRelayAdminStudents,
  forceUnlockTechRelay,
  clearTechRelayStrikes,
  resetTechRelayStudent,
  resetAllTechRelay,
  removeTechRelayStudent,
  forceStopTechRelay,
  blockAdminStudent,
  unblockAdminStudent,
  type TechRelayRound,
  type TechRelayLeaderboardEntry,
  type TechRelayParticipant,
} from "@/lib/api";
import styles from "./tech-relay-admin.module.css";

const DEFAULT_ROUNDS: Array<Omit<TechRelayRound, "id" | "is_active"> & { relay_name: string }> = [
  {
    relay_name: "Tech Relay",
    round_number: 1,
    round_title: "Identity Gadgets",
    round_type: "gadget",
    correct_answer: "CAMERA",
    time_limit_seconds: 0,
    content: {
      title: "Identity Gadgets",
      description: "Character clue puzzle: deduce the tech gadget from letter clues.",
      questions: [
        {
          id: "g1",
          gadget_name: "CAMERA",
          letters_count: 6,
          correct_answer: "CAMERA",
          clues: [
            { letter: "C", clue: "I am the first letter of the volatile memory type that loses its data when power is turned off." },
            { letter: "A", clue: "I am the middle vowel of the core computational unit that acts as the \"brain\" of a computer." },
            { letter: "M", clue: "I am the twelfth letter of the English alphabet, or rather, the midpoint of the alphabet right before N. (Note: M is the 13th, making this a fun trick!)" },
            { letter: "E", clue: "I am the repeating final letter found in both \"hardware\" and \"software\"." },
            { letter: "R", clue: "I am the primary consonant that initiates \"Random Access Memory\"." },
            { letter: "A", clue: "I am the vowel that sits alphabetically between Z and B... wait, no, I am the first vowel of the alphabet, ending this light-capturing device." },
          ],
        },
        {
          id: "g2",
          gadget_name: "ROUTER",
          letters_count: 6,
          correct_answer: "ROUTER",
          clues: [
            { letter: "R", clue: "I am the first letter of the architecture style based on Reduced Instruction Set Computers." },
            { letter: "O", clue: "I am a binary digit’s twin in shape, representing the state of \"false\" or \"off\" in digital logic." },
            { letter: "U", clue: "I am the vowel found in the exact center of the word \"DEBUGGER\"." },
            { letter: "T", clue: "I am the consonant that forms the prefix for \"Terabyte\" and starts the technology known as \"TFT\" displays." },
            { letter: "E", clue: "I am the second vowel in the word \"INTERFACE\"." },
            { letter: "R", clue: "I am the terminating letter of the term \"Master\" in a Master-Slave network architecture." },
          ],
        },
        {
          id: "g3",
          gadget_name: "MODEM",
          letters_count: 5,
          correct_answer: "MODEM",
          clues: [
            { letter: "M", clue: "I am the Roman numeral for one thousand, and the starting letter of a standard unit for measuring mega-transfer speeds." },
            { letter: "O", clue: "I am the letter shaped like a loop that represents an empty set in mathematics." },
            { letter: "D", clue: "I am the hexadecimal digit that represents the decimal value 13." },
            { letter: "E", clue: "I am the vowel that appears three times inside the word \"ENGINEERING\"." },
            { letter: "M", clue: "I am the final letter of this device, matching my position at the very beginning of the word." },
          ],
        },
        {
          id: "g4",
          gadget_name: "DRONE",
          letters_count: 5,
          correct_answer: "DRONE",
          clues: [
            { letter: "D", clue: "I am the letter that designates a directory in command-line interfaces and represents 500 in Roman numerals." },
            { letter: "R", clue: "I am the symbol used in programming to denote raw strings or read permissions." },
            { letter: "O", clue: "I am the vowel that sits right between the letters N and P on a standard QWERTY keyboard." },
            { letter: "N", clue: "I am the symbol often used in physics and networking to represent total node count." },
            { letter: "E", clue: "I am the hexadecimal digit that represents the decimal value 14, and I close out this flying gadget." },
          ],
        },
        {
          id: "g5",
          gadget_name: "TABLET",
          letters_count: 6,
          correct_answer: "TABLET",
          clues: [
            { letter: "T", clue: "I am the data type in programming that represents truth values (True/False)." },
            { letter: "A", clue: "I am the first letter of the hexadecimal sequence that comes after numbers 0 through 9." },
            { letter: "B", clue: "I am the base unit of digital storage prefix, or the second letter of a standard \"byte\"." },
            { letter: "L", clue: "I am the Roman numeral for 50, often found standing alone before a C." },
            { letter: "E", clue: "I am the character that represents \"Exponent\" in scientific notation numbers." },
            { letter: "T", clue: "I am a twin to the very first letter of this touch-screen device, closing out the word." },
          ],
        },
        {
          id: "g6",
          gadget_name: "SERVER",
          letters_count: 6,
          correct_answer: "SERVER",
          clues: [
            { letter: "S", clue: "I am the letter used in cryptography to denote a secure protocol prefix (like HTTPS)." },
            { letter: "E", clue: "I am the most frequent vowel in the English language, appearing twice in this central network computer." },
            { letter: "R", clue: "I am the letter that denotes \"Register\" in low-level assembly language architecture." },
            { letter: "V", clue: "I am the Roman numeral for 5, and the consonant that starts the word for a virtual machine." },
            { letter: "E", clue: "I am the second instance of the most common vowel in this word." },
            { letter: "R", clue: "I am the concluding consonant, mirroring the letter found at the halfway mark of this word." },
          ],
        },
        {
          id: "g7",
          gadget_name: "SWITCH",
          letters_count: 6,
          correct_answer: "SWITCH",
          clues: [
            { letter: "S", clue: "I am the letter used to denote a multi-branch conditional control statement in programming (like a case statement)." },
            { letter: "W", clue: "I am the letter that begins the global standard for Wide Area Networks." },
            { letter: "I", clue: "I am the integer variable name traditionally used as the primary loop counter in code." },
            { letter: "T", clue: "I am the letter representing \"Time\" complexity bounds in Big-O notation." },
            { letter: "C", clue: "I am the programming language developed by Dennis Ritchie that inspired C++ and Java." },
            { letter: "H", clue: "I am the letter that represents \"Hertz\", the unit of frequency, closing out this networking hardware." },
          ],
        },
        {
          id: "g8",
          gadget_name: "WEBCAM",
          letters_count: 6,
          correct_answer: "WEBCAM",
          clues: [
            { letter: "W", clue: "I am the triple-letter prefix that initiates almost every URL on the World Wide Web." },
            { letter: "E", clue: "I am the baseline vowel of standard scientific notation exponent markers (like 1e10)." },
            { letter: "B", clue: "I am the binary digit prefix that differentiates a bit from a byte." },
            { letter: "C", clue: "I am the programming language tier that sits right below C++ and Python." },
            { letter: "A", clue: "I am the vowel that represents the hex value for 10." },
            { letter: "M", clue: "I am the metric prefix multiplier representing one-thousandth (10^{-3}), ending this video-streaming peripheral." },
          ],
        },
        {
          id: "g9",
          gadget_name: "SENSOR",
          letters_count: 6,
          correct_answer: "SENSOR",
          clues: [
            { letter: "S", clue: "I am the letter representing \"Seconds\" as the base SI unit of time." },
            { letter: "E", clue: "I am the Euler's number constant (~2.718) in mathematical programming libraries." },
            { letter: "N", clue: "I am the variable typically used in mathematics and algorithms to represent a dynamic total input size." },
            { letter: "S", clue: "I am the twin sibling to the first letter of this environment-detecting hardware." },
            { letter: "O", clue: "I am the letter/digit that represents the octal number system base offset." },
            { letter: "R", clue: "I am the concluding letter of both \"Processor\" and this environmental data-gatherer." },
          ],
        },
        {
          id: "g10",
          gadget_name: "PRINTER",
          letters_count: 7,
          correct_answer: "PRINTER",
          clues: [
            { letter: "P", clue: "I am the protocol letter that stands at the front of secure web traffic (HTTPS) or packet transmission." },
            { letter: "R", clue: "I am the symbol used in database management systems to represent a relational model." },
            { letter: "I", clue: "I am the imaginary unit in complex mathematics (i = \\sqrt{-1})." },
            { letter: "N", clue: "I am the mid-alphabet consonant that stands right between M and O." },
            { letter: "T", clue: "I am the unit of data throughput often measured in transactions per second." },
            { letter: "E", clue: "I am the baseline character for error exceptions in runtime environments." },
            { letter: "R", clue: "I am the closing consonant of this hardcopy output machine." },
          ],
        },
        {
          id: "g11",
          gadget_name: "HEADSET",
          letters_count: 7,
          correct_answer: "HEADSET",
          clues: [
            { letter: "H", clue: "I am the first letter of the hardware part you wear over your ears, and I start the word \"Hardware\"." },
            { letter: "E", clue: "I am the most common vowel in the English language, and I sit right in the middle of the word \"NET\"." },
            { letter: "A", clue: "I am the first vowel of the alphabet, and I start the word \"Audio\"." },
            { letter: "D", clue: "I am the letter that comes right after C, and I start the word \"Data\"." },
            { letter: "S", clue: "I am the sibilant consonant that starts the word \"Sound\" and \"Speaker\"." },
            { letter: "E", clue: "I am the second-to-last letter, mirroring the vowel found in the middle of this wearable audio device." },
            { letter: "T", clue: "I am the consonant that crosses itself, ending both the words \"Tablet\" and \"Headset\"." },
          ],
        },
      ],
    },
  },
  {
    relay_name: "Tech Relay",
    round_number: 2,
    round_title: "Password Verification Gate",
    round_type: "puzzle",
    correct_answer: "VERIFY_ROUND1_PASSWORD",
    time_limit_seconds: 0,
    content: {
      title: "Password Verification Gate",
      instruction: "Verify your clearance by typing your security password corresponding to your Round 1 gadget to unlock Round 3.",
      rule: "Password matching Round 1 Gadget Codename",
      password_table: {
        CAMERA: "7F3A9K2D",
        ROUTER: "R@ut3r2025",
        MODEM: "8Gk4#7m2P9",
        DRONE: "7F3A9X4D",
        TABLET: "X7y8N9a5bC",
        SERVER: "K8n9C5pL2",
        SWITCH: "ACCESS24B7T",
        WEBCAM: "7X9kL2mP4",
        SENSOR: "SENSOR95R1P",
        PRINTER: "42BLUEK7Y1P",
        HEADSET: "PWR588F32",
      },
    },
  },
  {
    relay_name: "Tech Relay",
    round_number: 3,
    round_title: "HTML Basic Practice Assessment",
    round_type: "mcq",
    correct_answer: "HTML_3_OF_10",
    time_limit_seconds: 0,
    content: {
      target_required: 3,
      quiz_title: "HTML Basic Practice Assessment",
      subject: "Web Technologies / Programming for Problem Solving",
      questions: [
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
      ],
    },
  },
  {
    relay_name: "Tech Relay",
    round_number: 4,
    round_title: "Tech Quiz",
    round_type: "mcq",
    correct_answer: "MCQ_4_OF_10",
    time_limit_seconds: 0,
    content: {
      target_required: 4,
      quiz_title: "Introductory Engineering MCQ Assessment",
      questions: [
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
      ],
    },
  },
  {
    relay_name: "Tech Relay",
    round_number: 5,
    round_title: "Crack Final Password",
    round_type: "password",
    correct_answer: "CRACK_PASSWORD_10_STEP",
    time_limit_seconds: 0,
    content: {
      workflow_type: "10_step_master_password",
      description: "Sequential 10-step interactive master key assembly with uppercase transformation",
      steps: [
        { step: 1, name: "Base Name", desc: "Initial codename/identifier string" },
        { step: 2, name: "Number Addition", desc: "Append numeric entropy value" },
        { step: 3, name: "Math Challenge", question: "14 × 7 = ?", answer: "98" },
        { step: 4, name: "Brand Logo Selection", options: ["NEXUS", "OCTOCAT", "CYBER"] },
        { step: 5, name: "Color Choice", options: ["CYAN", "VIOLET", "EMERALD"] },
        { step: 6, name: "Tech Tag", options: ["TS", "PY", "GO", "RUST"] },
        { step: 7, name: "Special Symbol", options: ["!", "#", "$", "&"] },
        { step: 8, name: "Verification Digit", digit: "7" },
        { step: 9, name: "String Assembly", desc: "Sequential combined token stream" },
        { step: 10, name: "Final Master Password", desc: "UPPERCASE encoding & vault unlock" },
      ],
      math_num1: 14,
      math_num2: 7,
      math_op: "×",
      math_answer: "98",
      verify_digit: "7",
    },
  },
];

const MIGRATION_SQL = `-- ============================================================
-- Migration V17: Tech Relay Tables
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS tech_relay_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_name TEXT NOT NULL DEFAULT 'Tech Relay',
  is_active BOOLEAN DEFAULT false,
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 5),
  round_title TEXT NOT NULL,
  round_type TEXT NOT NULL CHECK (round_type IN ('gadget', 'puzzle', 'debug', 'mcq', 'password')),
  content JSONB NOT NULL DEFAULT '{}',
  correct_answer TEXT,
  time_limit_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(relay_name, round_number)
);

CREATE TABLE IF NOT EXISTS tech_relay_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relay_name TEXT NOT NULL DEFAULT 'Tech Relay',
  current_round INTEGER NOT NULL DEFAULT 1,
  rounds_completed JSONB DEFAULT '[]',
  is_completed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(student_id, relay_name)
);

CREATE INDEX IF NOT EXISTS idx_tech_relay_config_relay ON tech_relay_config(relay_name);
CREATE INDEX IF NOT EXISTS idx_tech_relay_progress_student ON tech_relay_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_tech_relay_progress_relay ON tech_relay_progress(relay_name);

ALTER TABLE tech_relay_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_relay_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_tech_relay_config" ON tech_relay_config;
CREATE POLICY "public_read_tech_relay_config" ON tech_relay_config FOR SELECT USING (true);

ALTER TABLE tech_relay_progress DISABLE ROW LEVEL SECURITY;

-- Enable Supabase Realtime for live observer
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tech_relay_progress;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
`;

export default function TechRelayAdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"observer" | "rounds" | "leaderboard">("observer");
  const [rounds, setRounds] = useState<TechRelayRound[]>([]);
  const [leaderboard, setLeaderboard] = useState<TechRelayLeaderboardEntry[]>([]);
  const [participants, setParticipants] = useState<TechRelayParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [observerLoading, setObserverLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Filter & Search state for observer
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRound, setFilterRound] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAllRegistered, setShowAllRegistered] = useState(true);

  // Force Unlock Modal
  const [forceUnlockStudent, setForceUnlockStudent] = useState<TechRelayParticipant | null>(null);
  const [selectedUnlockRound, setSelectedUnlockRound] = useState<number>(2);

  // Multi-Question Editor Modal
  const [editingRound, setEditingRound] = useState<Partial<TechRelayRound> | null>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [contentJson, setContentJson] = useState("");
  const [jsonError, setJsonError] = useState("");

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // ── Load All Data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [roundsData, lbData, studentsData] = await Promise.all([
        fetchTechRelayAdminConfig(),
        fetchTechRelayLeaderboard("Tech Relay").catch(() => []),
        fetchTechRelayAdminStudents("Tech Relay", showAllRegistered).catch(() => []),
      ]);
      setRounds(roundsData || []);
      setLeaderboard(lbData || []);
      setParticipants(studentsData || []);
      if (roundsData && roundsData.length > 0) {
        setIsActive(Boolean(roundsData[0].is_active));
      }
    } catch (err) {
      console.error("[TechRelayAdmin] Load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [showAllRegistered]);

  const refreshObserver = useCallback(async (overrideAll?: boolean) => {
    try {
      setObserverLoading(true);
      const includeAll = typeof overrideAll === "boolean" ? overrideAll : showAllRegistered;
      const studentsData = await fetchTechRelayAdminStudents("Tech Relay", includeAll);
      setParticipants(studentsData || []);
    } catch (err) {
      console.error("Failed to refresh observer:", err);
    } finally {
      setObserverLoading(false);
    }
  }, [showAllRegistered]);

  useEffect(() => {
    loadData();

    // ── 4-second Polling for guaranteed live updates ─────────────
    const pollInterval = setInterval(() => {
      refreshObserver();
    }, 4000);

    // ── Supabase Realtime Subscription ──────────────────────────
    const channel = supabase
      .channel("tech_relay_realtime_observer")
      .on("postgres_changes", { event: "*", schema: "public", table: "tech_relay_progress" }, () => {
        refreshObserver();
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [loadData, refreshObserver]);

  // ── Relay Toggle ─────────────────────────────────────────────
  const handleToggle = async () => {
    try {
      const nextState = !isActive;
      await toggleTechRelay("Tech Relay", nextState);
      setIsActive(nextState);
      setRounds((prev) => prev.map((r) => ({ ...r, is_active: nextState })));
    } catch (err: any) {
      alert("Failed to toggle relay: " + (err?.message || err));
    }
  };

  // ── Observer Actions ─────────────────────────────────────────
  const handleOpenForceUnlock = (student: TechRelayParticipant) => {
    setForceUnlockStudent(student);
    const nextR = Math.min((student.current_round || 1) + 1, 6);
    setSelectedUnlockRound(nextR);
  };

  const handleConfirmForceUnlock = async () => {
    if (!forceUnlockStudent) return;
    try {
      await forceUnlockTechRelay(forceUnlockStudent.student_id, selectedUnlockRound);
      setForceUnlockStudent(null);
      await refreshObserver();
    } catch (err: any) {
      alert("Force unlock failed: " + (err?.message || err));
    }
  };

  const handleClearStrikes = async (student: TechRelayParticipant) => {
    if (!confirm(`Clear all security strikes (0/3) and unblock ${student.name} (${student.usn})? This will allow them to continue the challenge.`)) return;
    try {
      await clearTechRelayStrikes(student.student_id);
      await loadData();
      await refreshObserver();
      alert(`✅ Strikes cleared and exam unblocked for ${student.name}!`);
    } catch (err: any) {
      alert("Failed to clear strikes: " + (err?.message || err));
    }
  };

  const handleResetStudent = async (student: TechRelayParticipant) => {
    if (!confirm(`Reset all Tech Relay progress for ${student.name} (${student.usn})? This will start them back at Round 1.`)) return;
    try {
      setParticipants((prev) =>
        prev.map((p) =>
          p.student_id === student.student_id
            ? { ...p, has_started: false, current_round: 1, rounds_completed: [], is_completed: false, warnings: 0 }
            : p
        )
      );
      setLeaderboard((prev) => prev.filter((e) => e.student_id !== student.student_id));
      await resetTechRelayStudent(student.student_id);
      await loadData();
      await refreshObserver();
      alert(`✅ Successfully reset ${student.name} (${student.usn}) back to Round 1!`);
    } catch (err: any) {
      alert("Reset failed: " + (err?.message || err));
      await loadData();
    }
  };

  const handleResetStudentById = async (studentId: string, name: string, usn: string) => {
    if (!confirm(`Reset all Tech Relay progress for ${name} (${usn})? This will remove them from leaderboard and start them back at Round 1.`)) return;
    try {
      setLeaderboard((prev) => prev.filter((e) => e.student_id !== studentId));
      setParticipants((prev) =>
        prev.map((p) =>
          p.student_id === studentId
            ? { ...p, has_started: false, current_round: 1, rounds_completed: [], is_completed: false, warnings: 0 }
            : p
        )
      );
      await resetTechRelayStudent(studentId);
      await loadData();
      await refreshObserver();
      alert(`✅ Successfully reset ${name} (${usn})!`);
    } catch (err: any) {
      alert("Reset failed: " + (err?.message || err));
      await loadData();
    }
  };

  const handleResetAllRelay = async () => {
    if (!confirm("⚠️ DANGER: Are you sure you want to reset the entire Tech Relay tournament?\n\nThis will wipe all contestant progress and reset the leaderboard to 0 so everyone can start fresh.")) {
      return;
    }
    try {
      setSaving(true);
      setLeaderboard([]);
      setParticipants((prev) =>
        prev.map((p) => ({
          ...p,
          has_started: false,
          current_round: 1,
          rounds_completed: [],
          is_completed: false,
          warnings: 0,
        }))
      );
      await resetAllTechRelay("Tech Relay");
      await loadData();
      await refreshObserver();
      alert("✅ Tech Relay tournament has been completely reset! Leaderboard and all contestant progress cleared.");
    } catch (err: any) {
      alert("Reset tournament failed: " + (err?.detail || err?.message || String(err)));
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleForceStopRelay = async () => {
    if (
      !confirm(
        "🛑 DANGER: FORCE STOP EXAM\n\nAre you sure you want to forcefully stop Tech Relay for ALL active students?\n\n• The exam will immediately deactivate and conclude.\n• Each student's progress will be frozen at their current stage.\n• Final results will be calculated strictly from Round 3 (HTML) & Round 4 (Tech Quiz) MCQs solved up to this point (Max 20 MCQs).\n• Student screens will instantly transition to their final score result screen."
      )
    ) {
      return;
    }
    try {
      setSaving(true);
      const res = await forceStopTechRelay("Tech Relay");
      setIsActive(false);
      await loadData();
      await refreshObserver();
      alert(`🛑 Tech Relay exam officially stopped!\n\n${res.affected_count || 0} active student exam session(s) finalized and their results generated up to their stopping point.`);
    } catch (err: any) {
      alert("Force stop failed: " + (err?.detail || err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlock = async (student: TechRelayParticipant) => {
    const action = student.is_blocked ? "unblock" : "block";
    if (!confirm(`Are you sure you want to ${action} ${student.name}?`)) return;
    try {
      if (student.is_blocked) await unblockAdminStudent(student.student_id);
      else await blockAdminStudent(student.student_id);
      await refreshObserver();
    } catch (err: any) {
      alert(`Failed to ${action}: ` + (err?.message || err));
    }
  };

  const handleRemoveStudent = async (student: TechRelayParticipant) => {
    if (!confirm(`Remove ${student.name} from Tech Relay? Their relay progress will be cleared.`)) return;
    try {
      await removeTechRelayStudent(student.student_id);
      await refreshObserver();
    } catch (err: any) {
      alert("Remove failed: " + (err?.message || err));
    }
  };

  // ── Round & Multi-Question Editor ─────────────────────────────
  const handleOpenEdit = (round?: TechRelayRound, targetRoundNum?: number) => {
    setEditorMode("visual");
    setJsonError("");

    if (round) {
      setEditingRound(round);
      const rawContent: any = round.content || {};
      setContentJson(JSON.stringify(rawContent, null, 2));

      // Extract questions array
      if (rawContent.questions && Array.isArray(rawContent.questions) && rawContent.questions.length > 0) {
        setQuestionsList(JSON.parse(JSON.stringify(rawContent.questions)));
      } else {
        // Wrap legacy single item into a question object
        if (round.round_type === "gadget") {
          setQuestionsList([
            {
              id: "g1",
              gadget_name: rawContent.gadget_name || round.correct_answer || "",
              clues: rawContent.clues || [],
              correct_answer: round.correct_answer || rawContent.gadget_name || "",
            },
          ]);
        } else if (round.round_type === "puzzle") {
          setQuestionsList([
            {
              id: "p1",
              problem_statement: rawContent.problem_statement || "",
              hint: rawContent.hint || "",
              correct_answer: round.correct_answer || "",
            },
          ]);
        } else if (round.round_type === "debug") {
          setQuestionsList([
            {
              id: "d1",
              language: rawContent.language || "python",
              code: rawContent.code || "",
              bug_description: rawContent.bug_description || "",
              hint: rawContent.hint || "",
              correct_answer: round.correct_answer || "",
            },
          ]);
        } else if (round.round_type === "password") {
          setQuestionsList([
            {
              id: "c1",
              cipher_text: rawContent.cipher_text || "",
              cipher_type: rawContent.cipher_type || "Cipher",
              hint: rawContent.hint || "",
              correct_answer: round.correct_answer || "",
            },
          ]);
        } else {
          setQuestionsList(rawContent.questions || []);
        }
      }
    } else {
      const num = targetRoundNum || (rounds.length + 1);
      const defaultTemplate = DEFAULT_ROUNDS.find((d) => d.round_number === num) || DEFAULT_ROUNDS[0];

      setEditingRound({
        round_number: num,
        round_title: defaultTemplate.round_title,
        round_type: defaultTemplate.round_type,
        correct_answer: defaultTemplate.correct_answer,
        time_limit_seconds: defaultTemplate.time_limit_seconds,
        is_active: isActive,
      });

      const templateContent: any = defaultTemplate.content;
      setContentJson(JSON.stringify(templateContent, null, 2));
      setQuestionsList(templateContent.questions ? JSON.parse(JSON.stringify(templateContent.questions)) : []);
    }
  };

  const handleConvertToMcq = () => {
    const r3Default = DEFAULT_ROUNDS.find((d) => d.round_number === 3);
    if (!r3Default || !editingRound) return;
    setEditingRound({
      ...editingRound,
      round_title: "Code & Logic Quiz",
      round_type: "mcq",
      correct_answer: "mcq_all",
      time_limit_seconds: 0,
    });
    const templateContent: any = r3Default.content;
    setQuestionsList(JSON.parse(JSON.stringify(templateContent.questions || [])));
    setContentJson(JSON.stringify(templateContent, null, 2));
  };

  const handleConvertToCrackPassword = () => {
    const r5Default = DEFAULT_ROUNDS.find((d) => d.round_number === 5);
    if (!r5Default || !editingRound) return;
    setEditingRound({
      ...editingRound,
      round_title: "Crack Final Password",
      round_type: "password",
      correct_answer: "CRACK_PASSWORD_10_STEP",
      time_limit_seconds: 0,
    });
    const templateContent: any = r5Default.content;
    setQuestionsList([]);
    setContentJson(JSON.stringify(templateContent, null, 2));
  };

  const handleAddQuestion = () => {
    const qId = `q_${Date.now()}`;
    const roundType = editingRound?.round_type || "puzzle";

    if (roundType === "gadget") {
      setQuestionsList((prev) => [
        ...prev,
        {
          id: qId,
          gadget_name: "",
          clues: [{ letter: "A", clue: "Clue here..." }],
          correct_answer: "",
        },
      ]);
    } else if (roundType === "puzzle") {
      setQuestionsList((prev) => [
        ...prev,
        {
          id: qId,
          problem_statement: "",
          hint: "",
          correct_answer: "",
        },
      ]);
    } else if (roundType === "debug") {
      setQuestionsList((prev) => [
        ...prev,
        {
          id: qId,
          language: "python",
          code: "# Write code with bug",
          bug_description: "",
          hint: "",
          correct_answer: "",
        },
      ]);
    } else if (roundType === "mcq") {
      setQuestionsList((prev) => [
        ...prev,
        {
          question: "",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correct: 0,
        },
      ]);
    } else if (roundType === "password") {
      setQuestionsList((prev) => [
        ...prev,
        {
          id: qId,
          cipher_text: "",
          cipher_type: "Cipher",
          hint: "",
          correct_answer: "",
        },
      ]);
    }
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestionsList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateQuestion = (idx: number, field: string, val: any) => {
    setQuestionsList((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleSaveRound = async () => {
    if (!editingRound) return;

    let finalContent: Record<string, unknown> = {};

    if (editorMode === "json") {
      try {
        finalContent = JSON.parse(contentJson);
      } catch (e: any) {
        setJsonError("Invalid JSON syntax: " + e.message);
        return;
      }
    } else {
      // Build content from questionsList
      finalContent = { questions: questionsList };
    }

    try {
      setSaving(true);
      await saveTechRelayRound({
        id: editingRound.id,
        relay_name: "Tech Relay",
        round_number: Number(editingRound.round_number || 1),
        round_title: editingRound.round_title || `Round ${editingRound.round_number}`,
        round_type: editingRound.round_type || "puzzle",
        correct_answer: editingRound.round_type === "mcq" ? (editingRound.correct_answer || "mcq_all") : (editingRound.correct_answer || ""),
        time_limit_seconds: Number(editingRound.time_limit_seconds ?? 0),
        content: finalContent,
        is_active: isActive,
      });
      setEditingRound(null);
      await loadData();
    } catch (err: any) {
      alert("Failed to save round: " + (err?.detail || err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roundId: string) => {
    if (!confirm("Are you sure you want to delete this round config?")) return;
    try {
      await deleteTechRelayRound(roundId);
      await loadData();
    } catch (err: any) {
      alert("Failed to delete round: " + (err?.message || err));
    }
  };

  const handleSeedDefaults = async () => {
    if (!confirm("Load default 5-round challenge template with multiple questions? Existing rounds will be updated.")) return;
    try {
      setSaving(true);
      for (const r of DEFAULT_ROUNDS) {
        await saveTechRelayRound({
          relay_name: "Tech Relay",
          round_number: r.round_number,
          round_title: r.round_title,
          round_type: r.round_type,
          correct_answer: r.correct_answer,
          time_limit_seconds: r.time_limit_seconds,
          content: r.content as Record<string, unknown>,
          is_active: true,
        });
      }
      setIsActive(true);
      await loadData();
      alert("All 5 rounds successfully seeded!");
    } catch (err: any) {
      alert("Failed to seed rounds: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  // ── Observer Statistics ───────────────────────────────────────
  const startedParticipants = participants.filter((p) => p.has_started);
  const totalStudents = showAllRegistered ? participants.length : startedParticipants.length;
  const activeStudents = participants.filter((p) => p.has_started && !p.is_completed).length;
  const completedStudents = participants.filter((p) => p.is_completed).length;
  const flaggedStudents = (showAllRegistered ? participants : startedParticipants).filter((p) => p.warnings > 0).length;

  const roundCounts = {
    r1: participants.filter((p) => p.has_started && !p.is_completed && p.current_round === 1).length,
    r2: participants.filter((p) => p.has_started && !p.is_completed && p.current_round === 2).length,
    r3: participants.filter((p) => p.has_started && !p.is_completed && p.current_round === 3).length,
    r4: participants.filter((p) => p.has_started && !p.is_completed && p.current_round === 4).length,
    r5: participants.filter((p) => p.has_started && !p.is_completed && p.current_round === 5).length,
    completed: completedStudents,
  };

  // Filter participants
  const filteredParticipants = participants.filter((p) => {
    // Only show started contestants unless admin toggles to show all registered accounts
    if (!showAllRegistered && !p.has_started) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchUsn = p.usn.toLowerCase().includes(q);
      const matchBranch = p.branch.toLowerCase().includes(q);
      if (!matchName && !matchUsn && !matchBranch) return false;
    }
    // Round filter
    if (filterRound !== "all") {
      if (filterRound === "completed" && !p.is_completed) return false;
      if (filterRound !== "completed" && (p.is_completed || p.current_round !== Number(filterRound))) return false;
    }
    // Status filter
    if (filterStatus === "active" && (!p.has_started || p.is_completed)) return false;
    if (filterStatus === "completed" && !p.is_completed) return false;
    if (filterStatus === "flagged" && p.warnings === 0) return false;

    return true;
  });

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => router.push("/admin")}>
            ← Admin Dashboard
          </button>
          <h1 className={styles.title}>🏁 Tech Relay Tournament Control</h1>
        </div>

        <div className={styles.headerActions}>
          <button
            className={`${styles.toggleBtn} ${isActive ? styles.toggleActive : styles.toggleInactive}`}
            onClick={handleToggle}
          >
            {isActive ? "🟢 Relay Active (Public)" : "🔴 Relay Inactive"}
          </button>

          <button
            className={styles.backButton}
            onClick={handleCopySql}
            title="Copy SQL to create database tables in Supabase"
          >
            {copiedSql ? "✅ Copied SQL!" : "📋 Copy SQL Migration"}
          </button>

          <button
            className={styles.backButton}
            onClick={handleSeedDefaults}
            disabled={saving}
            title="Load default 5 rounds with multiple questions"
          >
            ✨ Seed Rounds
          </button>

          <button
            className={styles.backButton}
            onClick={handleResetAllRelay}
            disabled={saving}
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#f87171",
              fontWeight: 700,
            }}
            title="Reset all contestant progress and clear leaderboard for Tech Relay"
          >
            🔄 Reset Tournament
          </button>

          <button
            className={styles.backButton}
            onClick={handleForceStopRelay}
            disabled={saving}
            style={{
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.45))",
              border: "1px solid #ef4444",
              color: "#fff",
              fontWeight: 800,
              boxShadow: "0 0 14px rgba(239, 68, 68, 0.35)",
              letterSpacing: "0.3px",
            }}
            title="Immediately stop exam and finalize results for all active students up to their stopping point"
          >
            🛑 Force Stop Exam
          </button>

          <div className={styles.tabRow}>
            <button
              className={`${styles.tab} ${activeTab === "observer" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("observer")}
            >
              🏃 Live Monitor ({participants.length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === "rounds" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("rounds")}
            >
              📝 Rounds & Questions ({rounds.length}/5)
            </button>
            <button
              className={`${styles.tab} ${activeTab === "leaderboard" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("leaderboard")}
            >
              🏆 Leaderboard ({leaderboard.length})
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          TAB 1: LIVE MONITOR (PYHUNT-STYLE OBSERVER)
         ══════════════════════════════════════════════════════════ */}
      {activeTab === "observer" && (
        <div>
          {/* Top Metrics Row */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Total Registered</div>
              <div className={styles.metricValue}>{participants.length}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel} style={{ color: "#38bdf8" }}>⚡ Active in Relay</div>
              <div className={styles.metricValue} style={{ color: "#38bdf8" }}>{activeStudents}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel} style={{ color: "#34d399" }}>🏆 Completed Relay</div>
              <div className={styles.metricValue} style={{ color: "#34d399" }}>{completedStudents}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel} style={{ color: flaggedStudents > 0 ? "#f87171" : "rgba(255,255,255,0.5)" }}>
                🚨 Flagged / Strikes
              </div>
              <div className={styles.metricValue} style={{ color: flaggedStudents > 0 ? "#f87171" : "#fff" }}>
                {flaggedStudents}
              </div>
            </div>
          </div>

          {/* Interactive Round Distribution Breakdown */}
          <div className={styles.distSection}>
            <div className={styles.distHeader}>
              <div className={styles.distTitle}>
                Round Distribution ({activeStudents + completedStudents} Active/Finished)
              </div>
              <button
                className={styles.backButton}
                style={{ padding: "4px 12px", fontSize: 11 }}
                onClick={() => refreshObserver()}
                disabled={observerLoading}
              >
                {observerLoading ? "Syncing..." : "🔄 Refresh"}
              </button>
            </div>

            <div className={styles.distBar}>
              <div
                className={styles.distSegment}
                style={{ width: `${totalStudents ? (roundCounts.r1 / totalStudents) * 100 : 0}%`, background: "#38bdf8" }}
                title={`Round 1: ${roundCounts.r1}`}
              />
              <div
                className={styles.distSegment}
                style={{ width: `${totalStudents ? (roundCounts.r2 / totalStudents) * 100 : 0}%`, background: "#818cf8" }}
                title={`Round 2: ${roundCounts.r2}`}
              />
              <div
                className={styles.distSegment}
                style={{ width: `${totalStudents ? (roundCounts.r3 / totalStudents) * 100 : 0}%`, background: "#c084fc" }}
                title={`Round 3: ${roundCounts.r3}`}
              />
              <div
                className={styles.distSegment}
                style={{ width: `${totalStudents ? (roundCounts.r4 / totalStudents) * 100 : 0}%`, background: "#f472b6" }}
                title={`Round 4: ${roundCounts.r4}`}
              />
              <div
                className={styles.distSegment}
                style={{ width: `${totalStudents ? (roundCounts.r5 / totalStudents) * 100 : 0}%`, background: "#fbbf24" }}
                title={`Round 5: ${roundCounts.r5}`}
              />
              <div
                className={styles.distSegment}
                style={{ width: `${totalStudents ? (roundCounts.completed / totalStudents) * 100 : 0}%`, background: "#34d399" }}
                title={`Finished: ${roundCounts.completed}`}
              />
            </div>

            <div className={styles.distPills}>
              <div className={styles.distPill}>
                <div className={styles.distDot} style={{ background: "#38bdf8" }} />
                <span>R1 (Gadgets): <strong>{roundCounts.r1}</strong></span>
              </div>
              <div className={styles.distPill}>
                <div className={styles.distDot} style={{ background: "#818cf8" }} />
                <span>R2 (Puzzles): <strong>{roundCounts.r2}</strong></span>
              </div>
              <div className={styles.distPill}>
                <div className={styles.distDot} style={{ background: "#c084fc" }} />
                <span>R3 (Debug): <strong>{roundCounts.r3}</strong></span>
              </div>
              <div className={styles.distPill}>
                <div className={styles.distDot} style={{ background: "#f472b6" }} />
                <span>R4 (Quiz): <strong>{roundCounts.r4}</strong></span>
              </div>
              <div className={styles.distPill}>
                <div className={styles.distDot} style={{ background: "#fbbf24" }} />
                <span>R5 (Vault): <strong>{roundCounts.r5}</strong></span>
              </div>
              <div className={styles.distPill}>
                <div className={styles.distDot} style={{ background: "#34d399" }} />
                <span>🏆 Finished: <strong>{roundCounts.completed}</strong></span>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className={styles.filterBar}>
            <input
              type="text"
              placeholder="🔍 Search student name, USN, or branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />

            <select
              value={filterRound}
              onChange={(e) => setFilterRound(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">Filter by Round (All)</option>
              <option value="1">Round 1 (Gadgets)</option>
              <option value="2">Round 2 (Puzzles)</option>
              <option value="3">Round 3 (Debug)</option>
              <option value="4">Round 4 (Speed Quiz)</option>
              <option value="5">Round 5 (Vault Password)</option>
              <option value="completed">🏆 Completed (Finished)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">Filter by Status (All)</option>
              <option value="active">Active Now</option>
              <option value="completed">Completed</option>
              <option value="flagged">Flagged / Strikes</option>
            </select>

            <button
              type="button"
              onClick={() => {
                const next = !showAllRegistered;
                setShowAllRegistered(next);
                refreshObserver(next);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                border: showAllRegistered ? "1px solid rgba(251, 191, 36, 0.4)" : "1px solid rgba(99, 102, 241, 0.4)",
                background: showAllRegistered ? "rgba(251, 191, 36, 0.12)" : "rgba(99, 102, 241, 0.15)",
                color: showAllRegistered ? "#fbbf24" : "#a5b4fc",
                whiteSpace: "nowrap",
              }}
              title="Toggle between showing all database accounts and only started contestants"
            >
              {showAllRegistered ? `👥 Showing All (${participants.length})` : `⚡ Started Only (${startedParticipants.length})`}
            </button>
          </div>

          {/* Student Progress Table */}
          <div style={{ overflowX: "auto" }}>
            {filteredParticipants.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏁</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 6 }}>
                  No Contestants Have Started Yet
                </div>
                <p style={{ maxWidth: 460, margin: "0 auto", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                  Only students who enter the start code (<strong>Meet</strong>) on their challenge screen will appear here in real-time.
                </p>
              </div>
            ) : (
              <table className={styles.observerTable}>
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>CURRENT ROUND</th>
                    <th>MCQ SCORE (20)</th>
                    <th>SUB-PROGRESS</th>
                    <th>ROUND STATUS</th>
                    <th>STRIKES</th>
                    <th>TIME ELAPSED</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((p) => {
                    const isCompleted = p.is_completed;
                    const roundNum = p.current_round || 1;
                    const roundTitle = rounds.find((r) => r.round_number === roundNum)?.round_title || `Round ${roundNum}`;

                    // Elapsed time calculation
                    let elapsedTime = "—";
                    if (p.started_at) {
                      const start = new Date(p.started_at).getTime();
                      const end = p.completed_at ? new Date(p.completed_at).getTime() : Date.now();
                      const diffSec = Math.max(0, Math.floor((end - start) / 1000));
                      const m = Math.floor(diffSec / 60);
                      const s = diffSec % 60;
                      elapsedTime = `${m}m ${s}s`;
                    }

                    return (
                      <tr key={p.student_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: "#fff" }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                            {p.usn} {p.branch ? `• ${p.branch}` : ""}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {!p.has_started ? (
                              <>
                                <span
                                  style={{
                                    padding: "3px 9px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    background: "rgba(255, 255, 255, 0.06)",
                                    color: "rgba(255, 255, 255, 0.5)",
                                    border: "1px solid rgba(255, 255, 255, 0.12)",
                                  }}
                                >
                                  GATE
                                </span>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                                  Waiting for Start Code
                                </span>
                              </>
                            ) : (
                              <>
                                <span
                                  style={{
                                    padding: "3px 9px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    background: p.stopped_by_admin
                                      ? "rgba(239, 68, 68, 0.2)"
                                      : isCompleted
                                      ? "rgba(52, 211, 153, 0.2)"
                                      : "rgba(99, 102, 241, 0.2)",
                                    color: p.stopped_by_admin
                                      ? "#f87171"
                                      : isCompleted
                                      ? "#34d399"
                                      : "#a5b4fc",
                                    border: p.stopped_by_admin
                                      ? "1px solid rgba(239, 68, 68, 0.4)"
                                      : isCompleted
                                      ? "1px solid rgba(52, 211, 153, 0.4)"
                                      : "1px solid rgba(99, 102, 241, 0.4)",
                                  }}
                                >
                                  {p.stopped_by_admin
                                    ? `🛑 STOPPED R${roundNum}`
                                    : isCompleted
                                    ? "🏆 DONE"
                                    : `R${roundNum}`}
                                </span>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                                  {p.stopped_by_admin
                                    ? `Halted at ${roundTitle}`
                                    : isCompleted
                                    ? "All 5 Cleared"
                                    : roundTitle}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td>
                          {p.has_started ? (
                            <div>
                              <div style={{ fontWeight: 800, color: "#38bdf8", fontSize: 13 }}>
                                {p.score ?? ((p.r3_score ?? 0) + (p.r4_score ?? 0))} / 20
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2, display: "flex", gap: 6 }}>
                                <span style={{ color: "#c084fc" }}>R3: <strong>{p.r3_score ?? 0}/10</strong></span>
                                <span>•</span>
                                <span style={{ color: "#f472b6" }}>R4: <strong>{p.r4_score ?? 0}/10</strong></span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>—</span>
                          )}
                        </td>

                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: p.stopped_by_admin ? "#fca5a5" : "#cbd5e1" }}>
                            {!p.has_started
                              ? "—"
                              : p.stopped_by_admin
                              ? `${p.cleared_rounds ?? 0}/5 Cleared`
                              : isCompleted
                              ? "5/5 Cleared"
                              : `Q${(p.current_question_index || 0) + 1}`}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              p.stopped_by_admin
                                ? ""
                                : isCompleted
                                ? styles.completedBadge
                                : p.has_started
                                ? styles.inProgressBadge
                                : ""
                            }
                            style={{
                              background: p.stopped_by_admin
                                ? "rgba(239, 68, 68, 0.18)"
                                : !p.has_started
                                ? "rgba(255,255,255,0.05)"
                                : undefined,
                              color: p.stopped_by_admin
                                ? "#f87171"
                                : !p.has_started
                                ? "rgba(255,255,255,0.4)"
                                : undefined,
                              border: p.stopped_by_admin ? "1px solid rgba(239, 68, 68, 0.4)" : undefined,
                              padding: p.stopped_by_admin ? "4px 10px" : undefined,
                              borderRadius: p.stopped_by_admin ? "6px" : undefined,
                              fontWeight: p.stopped_by_admin ? 800 : undefined,
                              fontSize: p.stopped_by_admin ? "11px" : undefined,
                            }}
                          >
                            {p.stopped_by_admin
                              ? `🛑 STOPPED (${p.score ?? ((p.r3_score ?? 0) + (p.r4_score ?? 0))}/20)`
                              : isCompleted
                              ? "COMPLETED"
                              : p.has_started
                              ? "IN PROGRESS"
                              : "NOT STARTED"}
                          </span>
                        </td>

                        <td>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 12,
                              color: p.warnings >= 3 ? "#ef4444" : p.warnings > 0 ? "#fbbf24" : "#34d399",
                            }}
                          >
                            {p.warnings >= 3 ? "🚫 3/3 (DISQUALIFIED)" : `${p.warnings}/3`}
                          </span>
                        </td>

                        <td style={{ fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
                          {elapsedTime}
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
                            {p.stopped_by_admin ? (
                              <span style={{ color: "#f87171" }}>🛑 STOPPED</span>
                            ) : isCompleted ? (
                              <span style={{ color: "#34d399" }}>FINISHED</span>
                            ) : p.is_blocked ? (
                              <span style={{ color: "#f87171" }}>BLOCKED</span>
                            ) : p.has_started ? (
                              <>
                                <span className={styles.liveDot} />
                                <span style={{ color: "#10b981" }}>ACTIVE</span>
                              </>
                            ) : (
                              <span style={{ color: "rgba(255,255,255,0.3)" }}>IDLE</span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className={styles.actionGroup}>
                            <button
                              className={`${styles.actionBtn} ${styles.btnUnlock}`}
                              onClick={() => handleOpenForceUnlock(p)}
                              title="Force Unlock Next Round"
                            >
                              ⚡ Unlock
                            </button>

                            <button
                              className={`${styles.actionBtn}`}
                              style={{
                                background: p.warnings > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.05)",
                                border: p.warnings > 0 ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(255, 255, 255, 0.1)",
                                color: p.warnings > 0 ? "#fca5a5" : "rgba(255, 255, 255, 0.7)",
                              }}
                              onClick={() => handleClearStrikes(p)}
                              title="Clear Security Strikes (0/3) & Unblock Termination"
                            >
                              🛡️ Strikes ({p.warnings})
                            </button>

                            <button
                              className={`${styles.actionBtn} ${styles.btnReset}`}
                              onClick={() => handleResetStudent(p)}
                              title="Reset Student Progress"
                            >
                              🔄 Reset
                            </button>

                            <button
                              className={`${styles.actionBtn} ${styles.btnBlock}`}
                              onClick={() => handleToggleBlock(p)}
                              title={p.is_blocked ? "Resume Exam" : "Stop / Block Exam"}
                            >
                              {p.is_blocked ? "Resume" : "Stop"}
                            </button>

                            <button
                              className={`${styles.actionBtn} ${styles.btnBlock}`}
                              onClick={() => handleRemoveStudent(p)}
                              title="Remove from Relay"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 2: ROUNDS & MULTI-QUESTION BUILDER
         ══════════════════════════════════════════════════════════ */}
      {activeTab === "rounds" && (
        <>
          <div className={styles.roundsGrid}>
            {[1, 2, 3, 4, 5].map((num) => {
              const round = rounds.find((r) => r.round_number === num);
              if (round) {
                const content: any = typeof round.content === "string" ? JSON.parse(round.content || "{}") : round.content || {};
                const qCount = content?.questions?.length || 1;

                return (
                  <div key={round.id || num} className={styles.roundCard}>
                    <div className={styles.roundCardHeader}>
                      <span className={styles.roundBadge}>Round {num}</span>
                      <span
                        style={{
                          background: "rgba(99, 102, 241, 0.15)",
                          color: "#c7d2fe",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {qCount} {qCount === 1 ? "Question" : "Questions"}
                      </span>
                      <div className={styles.roundActions}>
                        <button
                          className={styles.iconBtn}
                          title="Edit Round Questions"
                          onClick={() => handleOpenEdit(round)}
                        >
                          ✏️
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          title="Delete Round"
                          onClick={() => handleDelete(round.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <h3 className={styles.roundCardTitle}>{round.round_title}</h3>
                    <div className={styles.roundCardType}>
                      Type: <strong>{round.round_type}</strong> • Limit: <strong>{round.time_limit_seconds && round.time_limit_seconds > 0 ? `${round.time_limit_seconds}s` : "No Limit (Unlimited)"}</strong>
                    </div>

                    <div className={styles.roundCardPreview}>
                      {JSON.stringify(round.content, null, 2).slice(0, 160)}...
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`empty-${num}`}
                  className={`${styles.roundCard} ${styles.emptyRound}`}
                  onClick={() => handleOpenEdit(undefined, num)}
                >
                  <div className={styles.emptyIcon}>➕</div>
                  <div className={styles.emptyText}>Configure Round {num}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 3: LEADERBOARD
         ══════════════════════════════════════════════════════════ */}
      {activeTab === "leaderboard" && (
        <div style={{ overflowX: "auto" }}>
          {/* Leaderboard Toolbar with Reset All Button */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            padding: "12px 18px",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: 12,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            flexWrap: "wrap",
            gap: 12
          }}>
            <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.7)" }}>
              🏆 Live Tournament Leaderboard • <strong>{leaderboard.length}</strong> active / completed contestant{leaderboard.length === 1 ? "" : "s"}
            </div>
            <button
              onClick={handleResetAllRelay}
              disabled={saving}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#f87171",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
              title="Wipe all participant progress and reset the entire leaderboard"
            >
              🔄 Reset Entire Leaderboard & Relay
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <div className={styles.emptyState}>No participants have started or completed Tech Relay yet.</div>
          ) : (
            <table className={styles.leaderboard}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Branch</th>
                  <th>MCQ Score (Max 20)</th>
                  <th>Round 3 (HTML)</th>
                  <th>Round 4 (Quiz)</th>
                  <th>Current Round</th>
                  <th>Completed Rounds</th>
                  <th>Total Attempts</th>
                  <th>Status</th>
                  <th>Completed At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => (
                  <tr key={entry.student_id || idx}>
                    <td style={{ fontWeight: 700, color: idx === 0 ? "#fbbf24" : idx === 1 ? "#cbd5e1" : idx === 2 ? "#d97706" : "#a5b4fc" }}>
                      #{idx + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{entry.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.5 }}>{entry.usn}</div>
                    </td>
                    <td>{entry.branch || "—"}</td>
                    <td style={{ fontWeight: 800, color: "#38bdf8", fontSize: 13 }}>
                      <strong>{entry.score ?? ((entry.r3_score ?? 0) + (entry.r4_score ?? 0))}</strong> / 20
                    </td>
                    <td style={{ color: "#c084fc", fontWeight: 700, fontSize: 13 }}>
                      {entry.r3_score ?? 0} / 10
                    </td>
                    <td style={{ color: "#f472b6", fontWeight: 700, fontSize: 13 }}>
                      {entry.r4_score ?? 0} / 10
                    </td>
                    <td>
                      <span
                        className={entry.is_completed || entry.current_round > 5 ? styles.completedBadge : styles.roundBadge}
                        style={
                          entry.stopped_by_admin
                            ? { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)" }
                            : entry.is_completed || entry.current_round > 5
                            ? { background: "rgba(52, 211, 153, 0.15)", color: "#34d399", border: "1px solid rgba(52, 211, 153, 0.4)" }
                            : undefined
                        }
                      >
                        {entry.stopped_by_admin
                          ? `🛑 Halted at R${entry.current_round}`
                          : entry.is_completed || entry.current_round > 5
                          ? "🏆 All Cleared (5/5)"
                          : `Round ${entry.current_round}`}
                      </span>
                    </td>
                    <td>{entry.rounds_completed} / 5</td>
                    <td>{entry.total_attempts}</td>
                    <td>
                      <span
                        className={
                          entry.stopped_by_admin
                            ? ""
                            : entry.is_completed
                            ? styles.completedBadge
                            : styles.inProgressBadge
                        }
                        style={
                          entry.stopped_by_admin
                            ? {
                                background: "rgba(239, 68, 68, 0.18)",
                                color: "#f87171",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 800,
                              }
                            : undefined
                        }
                      >
                        {entry.stopped_by_admin
                          ? "🛑 STOPPED"
                          : entry.is_completed
                          ? "COMPLETED"
                          : "IN PROGRESS"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {entry.completed_at ? new Date(entry.completed_at).toLocaleTimeString() : "—"}
                    </td>
                    <td>
                      <button
                        className={`${styles.actionBtn} ${styles.btnReset}`}
                        onClick={() => handleResetStudentById(entry.student_id, entry.name, entry.usn)}
                        title="Reset this student's score back to Round 1"
                      >
                        🔄 Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          FORCE UNLOCK MODAL
         ══════════════════════════════════════════════════════════ */}
      {forceUnlockStudent && (
        <div className={styles.modalOverlay} onClick={() => setForceUnlockStudent(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <h2 className={styles.modalTitle}>⚡ Force Unlock Round</h2>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 20 }}>
              Advance <strong>{forceUnlockStudent.name}</strong> ({forceUnlockStudent.usn}) to any round instantly.
            </p>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Select Target Round</label>
              <select
                className={styles.formSelect}
                value={selectedUnlockRound}
                onChange={(e) => setSelectedUnlockRound(Number(e.target.value))}
              >
                <option value={2}>Round 2 (Solve Puzzle)</option>
                <option value={3}>Round 3 (Find Code Error)</option>
                <option value={4}>Round 4 (Speed Tech Quiz)</option>
                <option value={5}>Round 5 (Decode Vault Password)</option>
                <option value={6}>🏆 Mark All 5 Rounds Complete</option>
              </select>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setForceUnlockStudent(null)}>
                Cancel
              </button>
              <button className={styles.btnPrimary} onClick={handleConfirmForceUnlock}>
                ⚡ Unlock Round {selectedUnlockRound > 5 ? "All (Complete)" : selectedUnlockRound}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MULTI-QUESTION ROUND EDITOR MODAL
         ══════════════════════════════════════════════════════════ */}
      {editingRound && (
        <div className={styles.modalOverlay} onClick={() => setEditingRound(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className={styles.modalTitle} style={{ margin: 0 }}>
                {editingRound.id ? `Edit Round ${editingRound.round_number}` : `Configure Round ${editingRound.round_number}`}
              </h2>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className={`${styles.tab} ${editorMode === "visual" ? styles.tabActive : ""}`}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => setEditorMode("visual")}
                >
                  Visual Builder
                </button>
                <button
                  className={`${styles.tab} ${editorMode === "json" ? styles.tabActive : ""}`}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => {
                    setContentJson(JSON.stringify({ questions: questionsList }, null, 2));
                    setEditorMode("json");
                  }}
                >
                  Raw JSON
                </button>
              </div>
            </div>

            {/* One-click conversion banner if Round 3 is not yet MCQ */}
            {editingRound.round_number === 3 && editingRound.round_type !== "mcq" && (
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.15))",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#a5b4fc", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⚡</span> <span>Round 3 is set to Find Code Error</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                    Want Multiple Choice Questions (MCQs) for Round 3? Click to convert instantly.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleConvertToMcq}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 0 15px rgba(99, 102, 241, 0.4)",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⚡ Convert Round 3 to MCQs
                </button>
              </div>
            )}

            {/* One-click conversion banner if Round 5 is not yet Crack Final Password */}
            {editingRound.round_number === 5 && (editingRound.round_title !== "Crack Final Password" || questionsList.some((q) => q.cipher_text)) && (
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(16, 185, 129, 0.15))",
                  border: "1px solid rgba(6, 182, 212, 0.4)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#67e8f9", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🔐</span> <span>Round 5 is currently set to legacy Cipher</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                    Switch to the modern 10-Step Interactive Master Password Assembly Workflow component.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleConvertToCrackPassword}
                  style={{
                    background: "linear-gradient(135deg, #06b6d4, #10b981)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 0 15px rgba(6, 182, 212, 0.4)",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⚡ Convert Round 5 to 10-Step Workflow
                </button>
              </div>
            )}

            {/* Basic Info */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Round Title</label>
                <input
                  className={styles.formInput}
                  type="text"
                  value={editingRound.round_title || ""}
                  onChange={(e) => setEditingRound({ ...editingRound, round_title: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Round Type</label>
                <select
                  className={styles.formSelect}
                  value={editingRound.round_type || "puzzle"}
                  onChange={(e) => {
                    const newType = e.target.value as any;
                    let newTitle = editingRound.round_title;
                    if (newType === "mcq" && (!newTitle || newTitle.toLowerCase().includes("error") || newTitle.toLowerCase().includes("debug"))) {
                      newTitle = editingRound.round_number === 3 ? "Code & Logic Quiz" : "Speed Tech Quiz";
                    }
                    if (newType === "password" && (!newTitle || newTitle.toLowerCase().includes("decode") || newTitle.toLowerCase().includes("cipher"))) {
                      newTitle = "Crack Final Password";
                    }
                    setEditingRound({ ...editingRound, round_type: newType, round_title: newTitle });
                    if (newType === "mcq" && (!questionsList[0] || !("options" in questionsList[0]))) {
                      const def = DEFAULT_ROUNDS.find((d) => d.round_number === (editingRound.round_number || 3))?.content as any;
                      if (def?.questions) {
                        setQuestionsList(JSON.parse(JSON.stringify(def.questions)));
                        setContentJson(JSON.stringify(def, null, 2));
                      }
                    }
                    if (newType === "password") {
                      const def = DEFAULT_ROUNDS.find((d) => d.round_number === 5)?.content as any;
                      if (def) {
                        setContentJson(JSON.stringify(def, null, 2));
                      }
                    }
                  }}
                >
                  <option value="gadget">Identity Gadgets (Character Clues)</option>
                  <option value="puzzle">Problem Puzzle (Statement & Answer)</option>
                  <option value="mcq">Multiple Choice Quiz (MCQs)</option>
                  <option value="debug">Find Code Error (Code Snippet)</option>
                  <option value="password">Crack Final Password (10-Step Interactive Workflow)</option>
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Time Limit (Seconds, 0 = No Limit)</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={0}
                  placeholder="0 (No Limit)"
                  value={editingRound.time_limit_seconds ?? 0}
                  onChange={(e) => setEditingRound({ ...editingRound, time_limit_seconds: Math.max(0, Number(e.target.value)) })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Total Questions in this Round</label>
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 14, color: "#a5b4fc", fontWeight: 700 }}>
                  {questionsList.length} {questionsList.length === 1 ? "Question" : "Questions"}
                </div>
              </div>
            </div>

            {/* Visual Builder Mode */}
            {editorMode === "visual" && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>
                    📋 Questions in Round {editingRound.round_number}
                  </div>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ padding: "5px 12px", fontSize: 12 }}
                    onClick={handleAddQuestion}
                  >
                    ➕ Add Question
                  </button>
                </div>

                {questionsList.map((q, qIdx) => (
                  <div key={q.id || qIdx} className={styles.questionCard}>
                    <div className={styles.questionCardHeader}>
                      <span className={styles.questionBadge}>Question #{qIdx + 1}</span>
                      {questionsList.length > 1 && (
                        <button
                          type="button"
                          className={styles.iconBtn}
                          style={{ width: 24, height: 24, fontSize: 11 }}
                          onClick={() => handleRemoveQuestion(qIdx)}
                          title="Remove question"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Form for Gadget */}
                    {editingRound.round_type === "gadget" && (
                      <>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Gadget Answer (e.g. CAMERA)</label>
                          <input
                            className={styles.formInput}
                            type="text"
                            value={q.gadget_name || q.correct_answer || ""}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              handleUpdateQuestion(qIdx, "gadget_name", val);
                              handleUpdateQuestion(qIdx, "correct_answer", val);
                            }}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <label className={styles.formLabel} style={{ margin: 0 }}>Character Clues</label>
                            <button
                              type="button"
                              className={styles.backButton}
                              style={{ padding: "2px 8px", fontSize: 11 }}
                              onClick={() => {
                                const currentClues = q.clues || [];
                                handleUpdateQuestion(qIdx, "clues", [...currentClues, { clue: "" }]);
                              }}
                            >
                              + Add Clue
                            </button>
                          </div>

                          {(q.clues || []).map((clue: any, cIdx: number) => (
                            <div key={cIdx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                              <span style={{ minWidth: 26, fontSize: 12, fontWeight: 700, color: "rgba(255, 255, 255, 0.45)", textAlign: "center" }}>
                                #{cIdx + 1}
                              </span>
                              <input
                                className={styles.formInput}
                                style={{ flex: 1 }}
                                placeholder="Clue or description line..."
                                value={typeof clue === "object" ? (clue.clue ?? "") : (clue ?? "")}
                                onChange={(e) => {
                                  const cluesCopy = [...(q.clues || [])];
                                  const existing = typeof cluesCopy[cIdx] === "object" ? cluesCopy[cIdx] : {};
                                  cluesCopy[cIdx] = { ...existing, clue: e.target.value };
                                  handleUpdateQuestion(qIdx, "clues", cluesCopy);
                                }}
                              />
                              <button
                                type="button"
                                className={styles.iconBtn}
                                style={{ width: 28, height: 28 }}
                                onClick={() => {
                                  const cluesCopy = (q.clues || []).filter((_: any, idx: number) => idx !== cIdx);
                                  handleUpdateQuestion(qIdx, "clues", cluesCopy);
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Form for Puzzle */}
                    {editingRound.round_type === "puzzle" && (
                      <>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Problem Statement</label>
                          <textarea
                            className={styles.formTextarea}
                            rows={3}
                            placeholder="Enter puzzle problem statement..."
                            value={q.problem_statement || ""}
                            onChange={(e) => handleUpdateQuestion(qIdx, "problem_statement", e.target.value)}
                          />
                        </div>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Hint (Optional)</label>
                            <input
                              className={styles.formInput}
                              placeholder="Hint for student..."
                              value={q.hint || ""}
                              onChange={(e) => handleUpdateQuestion(qIdx, "hint", e.target.value)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Correct Answer</label>
                            <input
                              className={styles.formInput}
                              placeholder="Expected definitive answer..."
                              value={q.correct_answer || ""}
                              onChange={(e) => handleUpdateQuestion(qIdx, "correct_answer", e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Form for Debug */}
                    {editingRound.round_type === "debug" && (
                      <>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Language</label>
                            <input
                              className={styles.formInput}
                              placeholder="python / javascript / cpp..."
                              value={q.language || "python"}
                              onChange={(e) => handleUpdateQuestion(qIdx, "language", e.target.value)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Correct Fix (Expected Answer)</label>
                            <input
                              className={styles.formInput}
                              placeholder="The exact corrected line or term..."
                              value={q.correct_answer || ""}
                              onChange={(e) => handleUpdateQuestion(qIdx, "correct_answer", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Buggy Code Snippet</label>
                          <textarea
                            className={styles.formTextarea}
                            rows={4}
                            value={q.code || ""}
                            onChange={(e) => handleUpdateQuestion(qIdx, "code", e.target.value)}
                          />
                        </div>

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Bug Description</label>
                            <input
                              className={styles.formInput}
                              placeholder="What is wrong in the snippet..."
                              value={q.bug_description || ""}
                              onChange={(e) => handleUpdateQuestion(qIdx, "bug_description", e.target.value)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Hint (Optional)</label>
                            <input
                              className={styles.formInput}
                              placeholder="Debugging hint..."
                              value={q.hint || ""}
                              onChange={(e) => handleUpdateQuestion(qIdx, "hint", e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Form for MCQ */}
                    {editingRound.round_type === "mcq" && (
                      <>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Question Text</label>
                          <textarea
                            className={styles.formTextarea}
                            rows={2}
                            placeholder="Enter MCQ question..."
                            value={q.question || ""}
                            onChange={(e) => handleUpdateQuestion(qIdx, "question", e.target.value)}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Options & Correct Answer</label>
                          {(q.options || ["", "", "", ""]).map((opt: string, oIdx: number) => (
                            <div key={oIdx} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
                              <input
                                type="radio"
                                name={`mcq_correct_${qIdx}`}
                                checked={q.correct === oIdx}
                                onChange={() => handleUpdateQuestion(qIdx, "correct", oIdx)}
                              />
                              <input
                                className={styles.formInput}
                                placeholder={`Option ${oIdx + 1}...`}
                                value={opt}
                                onChange={(e) => {
                                  const opts = [...(q.options || ["", "", "", ""])];
                                  opts[oIdx] = e.target.value;
                                  handleUpdateQuestion(qIdx, "options", opts);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Form for Password / 10-Step Crack Password */}
                    {editingRound.round_type === "password" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div
                          style={{
                            background: "rgba(6, 182, 212, 0.08)",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                            borderRadius: 12,
                            padding: "14px 16px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#67e8f9", fontWeight: 700, fontSize: 14 }}>
                            <span>✱</span> <span>The Password Game Challenge (Round 5) Active</span>
                          </div>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: "4px 0 10px", lineHeight: 1.5 }}>
                            Students dynamically synthesize a master password through the progressive 20-rule validation engine inspired by The Password Game:
                          </p>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#67e8f9" }}>Rule 1:</strong> Min 8 characters length
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#a5b4fc" }}>Rule 2:</strong> At least one number (0-9)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#fbbf24" }}>Rule 3:</strong> At least one uppercase letter (A-Z)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#c084fc" }}>Rule 4:</strong> Special symbol (@, #, !, $, %, *)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#f472b6" }}>Rule 5:</strong> Digits sum equals exactly 25
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#34d399" }}>Rule 6:</strong> Month of the year (e.g. May, Jan)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#f87171" }}>Rule 7:</strong> Roman numeral (V, X, L, C, D, M)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#2dd4bf" }}>Rule 8:</strong> Sponsor (Shell, Pepsi, Starbucks, GitHub, Google, Apple)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#fb7185" }}>Rule 9:</strong> Current Year (2026)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#38bdf8" }}>Rule 10:</strong> Periodic Table Element (Na, He, Au, etc.)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#818cf8" }}>Rule 11:</strong> Programming Language (Python, Rust, etc.)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#facc15" }}>Rule 12:</strong> Moon Phase Emoji (🌕, 🌑, 🌓, etc.)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#f43f5e" }}>Rule 13:</strong> Hex Color Code (#FFF, #000, etc.)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#4ade80" }}>Rule 14:</strong> Hardware Device (CPU, RAM, ROUTER, etc.)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#60a5fa" }}>Rule 15:</strong> Affirmation Keyword (YES, OK, etc.)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#c084fc" }}>Rule 16:</strong> Security Token (NEXUS)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#2dd4bf" }}>Rule 17:</strong> Network Protocol (HTTP, TCP, SSH, etc.)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#fb923c" }}>Rule 18:</strong> Operating System (Linux, macOS, etc.)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#e879f9" }}>Rule 19:</strong> Emoticon (:), :-), :D, ^^)
                            </div>
                            <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <strong style={{ color: "#34d399" }}>Rule 20:</strong> Master Clearance (CLEAR)
                            </div>
                          </div>
                        </div>

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Step 3 Math Arithmetic Challenge</label>
                            <input
                              className={styles.formInput}
                              placeholder="e.g. 14 × 7"
                              value={q.math_question || "14 × 7"}
                              onChange={(e) => handleUpdateQuestion(qIdx, "math_question", e.target.value)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Step 3 Expected Calculation Answer</label>
                            <input
                              className={styles.formInput}
                              placeholder="e.g. 98"
                              value={q.math_answer || "98"}
                              onChange={(e) => handleUpdateQuestion(qIdx, "math_answer", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Step 8 Verification Checksum Digit</label>
                            <input
                              className={styles.formInput}
                              placeholder="e.g. 7"
                              value={q.verify_digit || "7"}
                              onChange={(e) => handleUpdateQuestion(qIdx, "verify_digit", e.target.value)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Master Vault Key (Fallback or Override)</label>
                            <input
                              className={styles.formInput}
                              placeholder="CRACK_PASSWORD_10_STEP"
                              value={q.correct_answer || editingRound.correct_answer || "CRACK_PASSWORD_10_STEP"}
                              onChange={(e) => {
                                handleUpdateQuestion(qIdx, "correct_answer", e.target.value);
                                setEditingRound({ ...editingRound, correct_answer: e.target.value });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className={styles.addQBtn}
                  onClick={handleAddQuestion}
                >
                  ➕ Add Another Question to Round {editingRound.round_number}
                </button>
              </div>
            )}

            {/* JSON Mode */}
            {editorMode === "json" && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Raw Content JSON</label>
                <textarea
                  className={styles.formTextarea}
                  rows={14}
                  value={contentJson}
                  onChange={(e) => {
                    setContentJson(e.target.value);
                    setJsonError("");
                  }}
                />
                {jsonError && (
                  <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{jsonError}</p>
                )}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setEditingRound(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSaveRound}
                disabled={saving}
              >
                {saving ? "Saving..." : "💾 Save Round"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
