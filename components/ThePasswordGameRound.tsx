"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Lock,
  Unlock,
  KeyRound,
  RotateCcw,
  Calendar,
  FlaskConical,
  Code2,
  Moon,
  Palette,
  Cpu,
  ThumbsUp,
  ShieldAlert,
  Globe2,
  Laptop,
  Smile,
  ShieldCheck,
} from "lucide-react";
import type { TechRelayRound } from "@/lib/api";

export interface ThePasswordGameRoundProps {
  round?: TechRelayRound;
  subIndex?: number;
  answer?: string;
  setAnswer?: (ans: string) => void;
  onSubmit?: (finalAnswer: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

// ── Sponsors with Brand Logos (Rule 8) ──────────────────────────────
interface Sponsor {
  id: string;
  name: string;
  brandKeyword: string;
  tagline: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  icon: React.ReactNode;
}

const SPONSORS: Sponsor[] = [
  {
    id: "pepsi",
    name: "Pepsi",
    brandKeyword: "pepsi",
    tagline: "Classic Refreshment",
    badgeBg: "bg-blue-950/40",
    badgeBorder: "border-blue-500/40",
    badgeText: "text-blue-300",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="#004B93" stroke="white" strokeWidth="1.5" />
        <path d="M4 17C10 11 30 11 36 17C30 23 10 23 4 17Z" fill="white" />
        <path d="M4 17C12 14 28 14 36 17C35 27 28 35 20 37C11 35 5 27 4 17Z" fill="#C9002B" />
      </svg>
    ),
  },
  {
    id: "starbucks",
    name: "Starbucks",
    brandKeyword: "starbucks",
    tagline: "Brewed Inspiration",
    badgeBg: "bg-emerald-950/40",
    badgeBorder: "border-emerald-500/40",
    badgeText: "text-emerald-300",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="#006241" stroke="#D4E9E2" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="12" fill="#00754A" />
        <path d="M20 12L21.5 16.5H26L22.5 19.5L24 24L20 21L16 24L17.5 19.5L14 16.5H18.5L20 12Z" fill="#D4E9E2" />
      </svg>
    ),
  },
  {
    id: "shell",
    name: "Shell",
    brandKeyword: "shell",
    tagline: "Powering Mobility",
    badgeBg: "bg-amber-950/40",
    badgeBorder: "border-amber-500/40",
    badgeText: "text-amber-300",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 4C14 4 6 12 7 24C8 30 14 34 20 34C26 34 32 30 33 24C34 12 26 4 20 4Z"
          fill="#FBCE07"
          stroke="#DD1D21"
          strokeWidth="2"
        />
        <path d="M12 24C15 15 25 15 28 24M16 29C18 20 22 20 24 29" stroke="#DD1D21" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "github",
    name: "GitHub",
    brandKeyword: "github",
    tagline: "Open Source Tech",
    badgeBg: "bg-purple-950/40",
    badgeBorder: "border-purple-500/40",
    badgeText: "text-purple-300",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        />
      </svg>
    ),
  },
  {
    id: "google",
    name: "Google",
    brandKeyword: "google",
    tagline: "Tech Innovation",
    badgeBg: "bg-red-950/40",
    badgeBorder: "border-red-500/40",
    badgeText: "text-red-300",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
    ),
  },
  {
    id: "apple",
    name: "Apple",
    brandKeyword: "apple",
    tagline: "Design & Compute",
    badgeBg: "bg-slate-800/40",
    badgeBorder: "border-slate-500/40",
    badgeText: "text-slate-200",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.67-.82 1.13-1.96.99-3.11-.97.04-2.15.65-2.85 1.47-.62.72-1.16 1.88-1.02 3 1.09.09 2.21-.55 2.88-1.36z" />
      </svg>
    ),
  },
];

// ── Valid Months (Rule 6) ───────────────────────────────────────────
const VALID_MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
];

// ── Valid Roman Numerals (Rule 7) ───────────────────────────────────
const ROMAN_NUMERALS = ["I", "V", "X", "L", "C", "D", "M"];

// ── Chemistry Periodic Table Elements (Rule 10) ─────────────────────
interface ChemicalElement {
  symbol: string;
  name: string;
  number: number;
}

const PERIODIC_ELEMENTS: ChemicalElement[] = [
  { symbol: "He", name: "Helium", number: 2 },
  { symbol: "Li", name: "Lithium", number: 3 },
  { symbol: "Be", name: "Beryllium", number: 4 },
  { symbol: "Ne", name: "Neon", number: 10 },
  { symbol: "Na", name: "Sodium", number: 11 },
  { symbol: "Mg", name: "Magnesium", number: 12 },
  { symbol: "Al", name: "Aluminium", number: 13 },
  { symbol: "Si", name: "Silicon", number: 14 },
  { symbol: "Cl", name: "Chlorine", number: 17 },
  { symbol: "Ar", name: "Argon", number: 18 },
  { symbol: "Ca", name: "Calcium", number: 20 },
  { symbol: "Sc", name: "Scandium", number: 21 },
  { symbol: "Ti", name: "Titanium", number: 22 },
  { symbol: "Cr", name: "Chromium", number: 24 },
  { symbol: "Mn", name: "Manganese", number: 25 },
  { symbol: "Fe", name: "Iron", number: 26 },
  { symbol: "Co", name: "Cobalt", number: 27 },
  { symbol: "Ni", name: "Nickel", number: 28 },
  { symbol: "Cu", name: "Copper", number: 29 },
  { symbol: "Zn", name: "Zinc", number: 30 },
  { symbol: "Ga", name: "Gallium", number: 31 },
  { symbol: "Ge", name: "Germanium", number: 32 },
  { symbol: "As", name: "Arsenic", number: 33 },
  { symbol: "Se", name: "Selenium", number: 34 },
  { symbol: "Br", name: "Bromine", number: 35 },
  { symbol: "Kr", name: "Krypton", number: 36 },
  { symbol: "Rb", name: "Rubidium", number: 37 },
  { symbol: "Sr", name: "Strontium", number: 38 },
  { symbol: "Zr", name: "Zirconium", number: 40 },
  { symbol: "Mo", name: "Molybdenum", number: 42 },
  { symbol: "Ru", name: "Ruthenium", number: 44 },
  { symbol: "Rh", name: "Rhodium", number: 45 },
  { symbol: "Pd", name: "Palladium", number: 46 },
  { symbol: "Ag", name: "Silver", number: 47 },
  { symbol: "Cd", name: "Cadmium", number: 48 },
  { symbol: "In", name: "Indium", number: 49 },
  { symbol: "Sn", name: "Tin", number: 50 },
  { symbol: "Sb", name: "Antimony", number: 51 },
  { symbol: "Te", name: "Tellurium", number: 52 },
  { symbol: "Xe", name: "Xenon", number: 54 },
  { symbol: "Cs", name: "Caesium", number: 55 },
  { symbol: "Ba", name: "Barium", number: 56 },
  { symbol: "Pt", name: "Platinum", number: 78 },
  { symbol: "Au", name: "Gold", number: 79 },
  { symbol: "Hg", name: "Mercury", number: 80 },
  { symbol: "Pb", name: "Lead", number: 82 },
  { symbol: "Bi", name: "Bismuth", number: 83 },
  { symbol: "Rn", name: "Radon", number: 86 },
  { symbol: "Ra", name: "Radium", number: 88 },
  { symbol: "U", name: "Uranium", number: 92 },
  { symbol: "Pu", name: "Plutonium", number: 94 },
];

// ── Rule 11: Programming Languages ──────────────────────────────────
const PROGRAMMING_LANGUAGES = [
  "python",
  "rust",
  "java",
  "golang",
  "javascript",
  "typescript",
  "kotlin",
  "swift",
  "html",
  "css",
  "sql",
  "ruby",
  "php",
  "scala",
  "perl",
];

// ── Rule 12: Moon Phases ────────────────────────────────────────────
const MOON_PHASES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

// ── Rule 14: Hardware Devices / Codename ─────────────────────────────
const HARDWARE_COMPONENTS = [
  "cpu",
  "ram",
  "gpu",
  "rom",
  "ssd",
  "router",
  "modem",
  "drone",
  "camera",
  "sensor",
  "printer",
  "switch",
  "server",
];

// ── Rule 15: Affirmation / Agreement words ──────────────────────────
const AFFIRMATION_WORDS = ["yes", "ok", "true", "ready", "done", "pass"];

// ── Rule 16: Security Token / CAPTCHA ───────────────────────────────
const SECURITY_TOKEN = "NEXUS";

// ── Rule 17: Network & Web Protocols ────────────────────────────────
const NETWORK_PROTOCOLS = ["http", "https", "tcp", "udp", "ssh", "ftp", "dns", "smtp", "websocket"];

// ── Rule 18: Operating Systems ──────────────────────────────────────
const OPERATING_SYSTEMS = ["linux", "windows", "macos", "unix", "ubuntu", "android", "ios", "debian", "fedora"];

// ── Rule 19: Emoticons / Happy Faces ────────────────────────────────
const EMOTICONS = [":)", ":-)", ":d", "^^", ";)", "(:", "(-:"];

// ── Rule 20: Vault Activation Key ───────────────────────────────────
const ACTIVATION_CLEARANCE = "CLEAR";

export default function ThePasswordGameRound({
  answer: externalAnswer = "",
  setAnswer: externalSetAnswer,
  onSubmit,
  isSubmitting = false,
}: ThePasswordGameRoundProps) {
  const [internalPassword, setInternalPassword] = useState<string>(externalAnswer);
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [maxUnlockedRule, setMaxUnlockedRule] = useState<number>(1);

  // Sync with external state if passed
  const password = externalSetAnswer ? externalAnswer : internalPassword;
  const updatePassword = (val: string) => {
    setInternalPassword(val);
    if (externalSetAnswer) {
      externalSetAnswer(val);
    }
  };

  const appendToPassword = (snippet: string) => {
    updatePassword(password + snippet);
  };

  // ── Rule Validation Engine (20 Rules) ───────────────────────────────
  const ruleEvaluation = useMemo(() => {
    const trimmed = password;
    const lower = trimmed.toLowerCase();

    // Rule 1: Length >= 8
    const r1Valid = trimmed.length >= 8;

    // Rule 2: Contains number
    const r2Valid = /\d/.test(trimmed);

    // Rule 3: Contains uppercase
    const r3Valid = /[A-Z]/.test(trimmed);

    // Rule 4: Contains special character
    const r4Valid = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(trimmed);

    // Rule 5: Digits sum to 25
    const digits = (trimmed.match(/\d/g) || []).map(Number);
    const digitSum = digits.reduce((sum, d) => sum + d, 0);
    const r5Valid = digitSum === 25;

    // Rule 6: Includes a valid month
    const matchedMonth = VALID_MONTHS.find((m) => lower.includes(m));
    const r6Valid = Boolean(matchedMonth);

    // Rule 7: Includes a Roman numeral
    const foundRomans = ROMAN_NUMERALS.filter((rn) => trimmed.includes(rn));
    const r7Valid = foundRomans.length > 0;

    // Rule 8: Includes sponsor
    const matchedSponsor = SPONSORS.find((s) => lower.includes(s.brandKeyword));
    const r8Valid = Boolean(matchedSponsor);

    // Rule 9: Current Year (2026)
    const r9Valid = trimmed.includes("2026");

    // Rule 10: Chemistry Periodic Table Element Symbol (e.g. Na, He, Au)
    const matchedElement = PERIODIC_ELEMENTS.find(
      (el) => trimmed.includes(el.symbol) || lower.includes(el.symbol.toLowerCase())
    );
    const r10Valid = Boolean(matchedElement);

    // Rule 11: Programming Language
    const matchedLang = PROGRAMMING_LANGUAGES.find((lang) => lower.includes(lang));
    const r11Valid = Boolean(matchedLang);

    // Rule 12: Moon Phase Emoji
    const matchedMoon = MOON_PHASES.find((m) => trimmed.includes(m));
    const r12Valid = Boolean(matchedMoon);

    // Rule 13: Hex Color Code (e.g. #FFF, #000, #FF0000)
    const hexColorMatch = trimmed.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/);
    const r13Valid = Boolean(hexColorMatch);

    // Rule 14: Hardware Component
    const matchedHardware = HARDWARE_COMPONENTS.find((hw) => lower.includes(hw));
    const r14Valid = Boolean(matchedHardware);

    // Rule 15: Affirmation Word (YES, OK, etc.)
    const matchedAffirmation = AFFIRMATION_WORDS.find((word) => lower.includes(word));
    const r15Valid = Boolean(matchedAffirmation);

    // Rule 16: Security CAPTCHA Token (NEXUS)
    const r16Valid = trimmed.includes(SECURITY_TOKEN) || lower.includes(SECURITY_TOKEN.toLowerCase());

    // Rule 17: Network Protocol
    const matchedProtocol = NETWORK_PROTOCOLS.find((proto) => lower.includes(proto));
    const r17Valid = Boolean(matchedProtocol);

    // Rule 18: Operating System
    const matchedOS = OPERATING_SYSTEMS.find((os) => lower.includes(os));
    const r18Valid = Boolean(matchedOS);

    // Rule 19: Emoticon / Happy Face
    const matchedEmoticon = EMOTICONS.find((emo) => lower.includes(emo));
    const r19Valid = Boolean(matchedEmoticon);

    // Rule 20: Master Vault Clearance Code (CLEAR)
    const r20Valid = trimmed.includes(ACTIVATION_CLEARANCE) || lower.includes(ACTIVATION_CLEARANCE.toLowerCase());

    return {
      r1: { id: 1, valid: r1Valid, length: trimmed.length },
      r2: { id: 2, valid: r2Valid },
      r3: { id: 3, valid: r3Valid },
      r4: { id: 4, valid: r4Valid },
      r5: { id: 5, valid: r5Valid, sum: digitSum, digitsCount: digits.length },
      r6: { id: 6, valid: r6Valid, matchedMonth },
      r7: { id: 7, valid: r7Valid, foundRomans },
      r8: { id: 8, valid: r8Valid, matchedSponsor },
      r9: { id: 9, valid: r9Valid },
      r10: { id: 10, valid: r10Valid, matchedElement },
      r11: { id: 11, valid: r11Valid, matchedLang },
      r12: { id: 12, valid: r12Valid, matchedMoon },
      r13: { id: 13, valid: r13Valid, hex: hexColorMatch?.[0] },
      r14: { id: 14, valid: r14Valid, matchedHardware },
      r15: { id: 15, valid: r15Valid, matchedAffirmation },
      r16: { id: 16, valid: r16Valid, token: SECURITY_TOKEN },
      r17: { id: 17, valid: r17Valid, matchedProtocol },
      r18: { id: 18, valid: r18Valid, matchedOS },
      r19: { id: 19, valid: r19Valid, matchedEmoticon },
      r20: { id: 20, valid: r20Valid, clearance: ACTIVATION_CLEARANCE },
    };
  }, [password]);

  // Progressive unlock tracking (rules 1 to 20)
  useEffect(() => {
    const checks = [
      ruleEvaluation.r1.valid,
      ruleEvaluation.r2.valid,
      ruleEvaluation.r3.valid,
      ruleEvaluation.r4.valid,
      ruleEvaluation.r5.valid,
      ruleEvaluation.r6.valid,
      ruleEvaluation.r7.valid,
      ruleEvaluation.r8.valid,
      ruleEvaluation.r9.valid,
      ruleEvaluation.r10.valid,
      ruleEvaluation.r11.valid,
      ruleEvaluation.r12.valid,
      ruleEvaluation.r13.valid,
      ruleEvaluation.r14.valid,
      ruleEvaluation.r15.valid,
      ruleEvaluation.r16.valid,
      ruleEvaluation.r17.valid,
      ruleEvaluation.r18.valid,
      ruleEvaluation.r19.valid,
      ruleEvaluation.r20.valid,
    ];

    let progressiveMax = 1;
    for (let i = 0; i < checks.length; i++) {
      if (checks[i]) {
        progressiveMax = Math.min(20, i + 2);
      } else {
        break;
      }
    }

    setMaxUnlockedRule((prev) => Math.max(prev, progressiveMax));
  }, [ruleEvaluation]);

  // ── 20 Rules Definitions ───────────────────────────────────────────
  const allRulesList = [
    {
      id: 1,
      ruleNumber: 1,
      title: "Your password must be at least 8 characters.",
      isValid: ruleEvaluation.r1.valid,
      renderDetails: () => (
        <div className="flex items-center gap-2 mt-1.5 text-xs">
          <span className="font-mono px-2 py-0.5 rounded bg-black/30 border border-white/5">
            Length: <strong className={ruleEvaluation.r1.valid ? "text-emerald-400" : "text-rose-400"}>{ruleEvaluation.r1.length}</strong> / 8
          </span>
          {ruleEvaluation.r1.length < 8 && (
            <span className="text-rose-400/80">({8 - ruleEvaluation.r1.length} more characters needed)</span>
          )}
        </div>
      ),
    },
    {
      id: 2,
      ruleNumber: 2,
      title: "Your password must include a number.",
      isValid: ruleEvaluation.r2.valid,
      renderDetails: () => (
        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
          <span>Accepts any digit <strong>0-9</strong></span>
          {ruleEvaluation.r2.valid && <span className="text-emerald-400 font-semibold">✓ Number detected</span>}
        </div>
      ),
    },
    {
      id: 3,
      ruleNumber: 3,
      title: "Your password must include an uppercase letter.",
      isValid: ruleEvaluation.r3.valid,
      renderDetails: () => (
        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
          <span>Accepts any capital letter <strong>A-Z</strong></span>
          {ruleEvaluation.r3.valid && <span className="text-emerald-400 font-semibold">✓ Uppercase detected</span>}
        </div>
      ),
    },
    {
      id: 4,
      ruleNumber: 4,
      title: "Your password must include a special character.",
      isValid: ruleEvaluation.r4.valid,
      renderDetails: () => (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
          <span className="text-slate-400">Accepted:</span>
          {["@", "#", "!", "$", "%", "*", "&", "?"].map((sym) => (
            <span
              key={sym}
              className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
                password.includes(sym)
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                  : "bg-white/5 text-slate-400"
              }`}
            >
              {sym}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: 5,
      ruleNumber: 5,
      title: "The digits in your password must add up to 25.",
      isValid: ruleEvaluation.r5.valid,
      renderDetails: () => {
        const { sum, digitsCount } = ruleEvaluation.r5;
        const diff = 25 - sum;
        const has2026 = password.includes("2026");
        return (
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">
                Current digit sum:{" "}
                <strong
                  className={`font-mono text-sm ${
                    sum === 25 ? "text-emerald-400 font-bold" : sum > 25 ? "text-rose-400 font-bold" : "text-amber-400 font-bold"
                  }`}
                >
                  {sum}
                </strong>{" "}
                / 25
              </span>
              <span className="text-[11px] text-slate-400">
                {digitsCount} digit{digitsCount === 1 ? "" : "s"} entered
              </span>
            </div>

            <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden border border-white/5">
              <div
                className={`h-full transition-all duration-300 ${
                  sum === 25 ? "bg-emerald-500" : sum > 25 ? "bg-rose-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, (sum / 25) * 100)}%` }}
              />
            </div>

            <div className="text-[11px]">
              {sum === 25 ? (
                <span className="text-emerald-400 font-semibold">🎯 Target sum 25 reached exactly!</span>
              ) : sum < 25 ? (
                <span className="text-amber-400/90">
                  Tip: Need <strong>+{diff}</strong> more.{" "}
                  {has2026
                    ? "(2026 digits = 10, remaining needed: 15, e.g. +555 or +96 or +87)"
                    : "(e.g. 2026 + 555 adds to 25)"}
                </span>
              ) : (
                <span className="text-rose-400/90">
                  Tip: Exceeded target by <strong>{sum - 25}</strong>. Reduce or remove some digits.
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 6,
      ruleNumber: 6,
      title: "Your password must include a month of the year.",
      isValid: ruleEvaluation.r6.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1">
          {ruleEvaluation.r6.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span>✓ Month identified:</span>
              <span className="capitalize font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200">
                {ruleEvaluation.r6.matchedMonth}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
              <span>Examples:</span>
              {["May", "Jan", "Feb", "March", "April", "June", "Dec"].map((m) => (
                <span key={m} className="px-1.5 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[10px]">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 7,
      ruleNumber: 7,
      title: "Your password must include a roman numeral.",
      isValid: ruleEvaluation.r7.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1">
          {ruleEvaluation.r7.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span>✓ Roman numeral:</span>
              <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200">
                {ruleEvaluation.r7.foundRomans?.join(", ")}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-slate-400">Must be uppercase:</span>
              {ROMAN_NUMERALS.map((rn) => (
                <span
                  key={rn}
                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                    password.includes(rn)
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                      : "bg-white/5 text-slate-300"
                  }`}
                >
                  {rn}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 8,
      ruleNumber: 8,
      title: "Your password must include one of our sponsors:",
      isValid: ruleEvaluation.r8.valid,
      renderDetails: () => (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SPONSORS.map((s) => {
              const isMatched = password.toLowerCase().includes(s.brandKeyword);
              return (
                <div
                  key={s.id}
                  className={`relative p-2.5 rounded-xl border flex items-center gap-2.5 transition-all duration-300 ${
                    isMatched
                      ? "bg-emerald-950/50 border-emerald-500/60 shadow-md shadow-emerald-900/30 scale-[1.02]"
                      : `${s.badgeBg} ${s.badgeBorder} opacity-75 hover:opacity-100`
                  }`}
                >
                  <div className="shrink-0">{s.icon}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-bold leading-tight ${isMatched ? "text-emerald-300" : s.badgeText}`}>
                        {s.name}
                      </span>
                      {isMatched && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{s.tagline}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {ruleEvaluation.r8.valid && (
            <p className="text-[11px] text-emerald-400 font-semibold mt-1">
              ✓ Sponsor keyword &quot;{ruleEvaluation.r8.matchedSponsor?.name}&quot; verified!
            </p>
          )}
        </div>
      ),
    },
    {
      id: 9,
      ruleNumber: 9,
      title: "Your password must include the current year (2026).",
      isValid: ruleEvaluation.r9.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1">
          {ruleEvaluation.r9.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Current year verified:</span>
              <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold">
                2026
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Please include <strong className="text-amber-300 font-mono">2026</strong> in your password.
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 10,
      ruleNumber: 10,
      title: "Your password must include a periodic table element symbol (e.g., Na, He, Au).",
      isValid: ruleEvaluation.r10.valid,
      renderDetails: () => (
        <div className="mt-2 text-xs space-y-2">
          {ruleEvaluation.r10.valid && ruleEvaluation.r10.matchedElement ? (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex flex-col items-center justify-center font-mono shrink-0">
                <span className="text-[9px] text-emerald-300/80 leading-none">
                  {ruleEvaluation.r10.matchedElement.number}
                </span>
                <span className="text-base font-bold text-emerald-200 leading-none">
                  {ruleEvaluation.r10.matchedElement.symbol}
                </span>
              </div>
              <div>
                <div className="text-emerald-300 font-bold flex items-center gap-1">
                  <span>✓ Element Identified:</span>
                  <span className="text-white">
                    {ruleEvaluation.r10.matchedElement.name} ({ruleEvaluation.r10.matchedElement.symbol})
                  </span>
                </div>
                <div className="text-[11px] text-emerald-400/80">
                  Atomic Number #{ruleEvaluation.r10.matchedElement.number}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
                <span>Chemistry element symbol required (case-insensitive):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { sym: "Na", name: "Sodium" },
                  { sym: "He", name: "Helium" },
                  { sym: "Au", name: "Gold" },
                  { sym: "Fe", name: "Iron" },
                  { sym: "Cu", name: "Copper" },
                  { sym: "Ag", name: "Silver" },
                  { sym: "Al", name: "Aluminium" },
                  { sym: "Si", name: "Silicon" },
                  { sym: "Mg", name: "Magnesium" },
                ].map((item) => (
                  <button
                    key={item.sym}
                    type="button"
                    onClick={() => appendToPassword(item.sym)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] border transition-colors cursor-pointer ${
                      password.toLowerCase().includes(item.sym.toLowerCase())
                        ? "bg-emerald-500/25 text-emerald-200 border-emerald-500/50 font-bold"
                        : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                    }`}
                  >
                    +<strong>{item.sym}</strong> ({item.name})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 11,
      ruleNumber: 11,
      title: "Your password must include a programming language (e.g., Python, Rust, Java, Go, HTML).",
      isValid: ruleEvaluation.r11.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1.5">
          {ruleEvaluation.r11.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Programming Language:</span>
              <span className="capitalize font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold">
                {ruleEvaluation.r11.matchedLang}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {["Python", "Rust", "Java", "Go", "HTML", "SQL", "Swift", "Kotlin"].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => appendToPassword(lang)}
                  className="px-2 py-0.5 rounded font-mono text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                >
                  +{lang}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 12,
      ruleNumber: 12,
      title: "Your password must include a moon phase emoji.",
      isValid: ruleEvaluation.r12.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-2">
          {ruleEvaluation.r12.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-2">
              <span className="text-lg">{ruleEvaluation.r12.matchedMoon}</span>
              <span>✓ Moon phase emoji verified!</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-slate-400">
                <Moon className="w-3.5 h-3.5 text-amber-300" />
                <span>Click any moon emoji to insert into your password:</span>
              </div>
              <div className="flex flex-wrap gap-2 text-lg">
                {MOON_PHASES.map((moon) => (
                  <button
                    key={moon}
                    type="button"
                    onClick={() => appendToPassword(moon)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 transition-colors cursor-pointer"
                    title={`Insert ${moon}`}
                  >
                    {moon}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 13,
      ruleNumber: 13,
      title: "Your password must include a valid hex color code (e.g., #FFF, #000, #F00, #10B).",
      isValid: ruleEvaluation.r13.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1.5">
          {ruleEvaluation.r13.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-white/30"
                style={{ backgroundColor: ruleEvaluation.r13.hex }}
              />
              <span>✓ Hex Color:</span>
              <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold">
                {ruleEvaluation.r13.hex}
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span>Click a 3-letter hex code (letters A-F recommended so sum is unchanged):</span>
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {["#FFF", "#ABC", "#DEF", "#F0F", "#0FF"].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => appendToPassword(hex)}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                  >
                    +{hex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 14,
      ruleNumber: 14,
      title: "Your password must include a computer hardware component (e.g., CPU, RAM, GPU, ROUTER).",
      isValid: ruleEvaluation.r14.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1.5">
          {ruleEvaluation.r14.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Hardware component:</span>
              <span className="uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold">
                {ruleEvaluation.r14.matchedHardware}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
              {["CPU", "RAM", "GPU", "SSD", "ROUTER", "MODEM", "DRONE", "SENSOR"].map((hw) => (
                <button
                  key={hw}
                  type="button"
                  onClick={() => appendToPassword(hw)}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                >
                  +{hw}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 15,
      ruleNumber: 15,
      title: "Your password must include an affirmation keyword (e.g., YES, OK, TRUE, READY).",
      isValid: ruleEvaluation.r15.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1">
          {ruleEvaluation.r15.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Affirmation verified:</span>
              <span className="uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold">
                {ruleEvaluation.r15.matchedAffirmation}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              {["YES", "OK", "TRUE", "READY"].map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => appendToPassword(word)}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                >
                  +{word}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 16,
      ruleNumber: 16,
      title: `Your password must include the security CAPTCHA token: "${SECURITY_TOKEN}".`,
      isValid: ruleEvaluation.r16.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-2">
          {ruleEvaluation.r16.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Security token &quot;{SECURITY_TOKEN}&quot; verified!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded bg-indigo-950/60 border border-indigo-500/50 font-mono font-bold text-sm tracking-widest text-indigo-300 select-all">
                {SECURITY_TOKEN}
              </div>
              <button
                type="button"
                onClick={() => appendToPassword(SECURITY_TOKEN)}
                className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 font-semibold text-xs cursor-pointer"
              >
                + Insert Token
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 17,
      ruleNumber: 17,
      title: "Your password must include a network protocol (e.g., HTTP, TCP, UDP, SSH, DNS).",
      isValid: ruleEvaluation.r17.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1">
          {ruleEvaluation.r17.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Protocol verified:</span>
              <span className="uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold">
                {ruleEvaluation.r17.matchedProtocol}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              {["TCP", "UDP", "HTTP", "SSH", "DNS"].map((proto) => (
                <button
                  key={proto}
                  type="button"
                  onClick={() => appendToPassword(proto)}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                >
                  +{proto}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 18,
      ruleNumber: 18,
      title: "Your password must include an operating system name (e.g., Linux, Windows, macOS, Ubuntu).",
      isValid: ruleEvaluation.r18.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1">
          {ruleEvaluation.r18.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Operating System:</span>
              <span className="capitalize font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold">
                {ruleEvaluation.r18.matchedOS}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              {["Linux", "macOS", "Windows", "Ubuntu", "Android", "iOS"].map((os) => (
                <button
                  key={os}
                  type="button"
                  onClick={() => appendToPassword(os)}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                >
                  +{os}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 19,
      ruleNumber: 19,
      title: "Your password must include a happy face emoticon (e.g., :) or :-D or ^^).",
      isValid: ruleEvaluation.r19.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1">
          {ruleEvaluation.r19.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Emoticon identified:</span>
              <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold">
                {ruleEvaluation.r19.matchedEmoticon}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 text-[12px] font-mono">
              {[":)", ":-)", ":D", "^^", ";)"].map((face) => (
                <button
                  key={face}
                  type="button"
                  onClick={() => appendToPassword(face)}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                >
                  +{face}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 20,
      ruleNumber: 20,
      title: `Final Vault Clearance: Your password must include the activation key "${ACTIVATION_CLEARANCE}".`,
      isValid: ruleEvaluation.r20.valid,
      renderDetails: () => (
        <div className="mt-1.5 text-xs space-y-1.5">
          {ruleEvaluation.r20.valid ? (
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Final Clearance Code Activated!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Add the final unlock keyword:</span>
              <button
                type="button"
                onClick={() => appendToPassword(ACTIVATION_CLEARANCE)}
                className="px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-200 font-bold text-xs cursor-pointer"
              >
                +{ACTIVATION_CLEARANCE}
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  // Visible rules: progressive reveal only
  const visibleRules = allRulesList.filter((r) => r.ruleNumber <= maxUnlockedRule);

  // Render order: reverse order as in Password Game (latest unlocked at top)
  const displayRules = [...visibleRules].reverse();

  const totalSatisfied = allRulesList.filter((r) => r.isValid).length;
  const isAllSatisfied = totalSatisfied === allRulesList.length;

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    updatePassword("");
  };

  const handleFinalSubmit = () => {
    if (!isAllSatisfied || isSubmitting) return;
    if (onSubmit) {
      onSubmit(password);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* ── Glassmorphism Container ───────────────────────────────── */}
      <div
        className="rounded-3xl border border-white/10 p-5 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.78) 0%, rgba(10, 15, 30, 0.88) 100%)",
          boxShadow: "0 20px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.12)",
        }}
      >
        {/* Subtle Ambient Radial Glow */}
        <div
          className="absolute -top-24 -left-24 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-20"
          style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-20"
          style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)" }}
        />

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl text-amber-400">✱</span>
              <h2 className="text-xl sm:text-2xl font-serif tracking-tight text-white font-bold">
                The Password Game
              </h2>
              <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Round 5
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Construct a single master password that satisfies all progressive security rules.
            </p>
          </div>

          {/* Progress Pill */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-1.5 transition-colors ${
                isAllSatisfied
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-300"
              }`}
            >
              {isAllSatisfied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{totalSatisfied} / 20 Rules</span>
            </div>
          </div>
        </div>

        {/* ── Main Input Box ─────────────────────────────────────── */}
        <div className="mt-6 space-y-2 relative z-10">
          <div className="flex items-center justify-between">
            <label htmlFor="password-input" className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>Please choose a password</span>
            </label>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              {password.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="hover:text-white transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="hover:text-rose-400 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="relative group">
            <input
              id="password-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => updatePassword(e.target.value)}
              placeholder="Type your password here..."
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-slate-950/80 border border-slate-700/80 group-hover:border-slate-600 rounded-2xl px-4 py-3.5 sm:py-4 pr-24 text-base sm:text-xl font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner"
            />

            {/* Right-side elements: Peek + Live Length Counter */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>

              {/* Prominent Live Character Length Badge */}
              <div
                className={`font-mono text-xs sm:text-sm font-bold px-2.5 py-1 rounded-lg border transition-all ${
                  password.length >= 8
                    ? "bg-slate-800/90 text-slate-200 border-slate-700/70"
                    : "bg-slate-900/90 text-slate-500 border-slate-800"
                }`}
                title={`Length: ${password.length} characters`}
              >
                {password.length}
              </div>
            </div>
          </div>
        </div>

        {/* ── Rule Validation Cards Stack ───────────────────────── */}
        <div className="mt-6 space-y-3.5 relative z-10">
          <AnimatePresence initial={false}>
            {displayRules.map((rule) => {
              const isGreen = rule.isValid;

              return (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: -16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-lg ${
                    isGreen
                      ? "bg-emerald-950/25 border-emerald-500/40 text-emerald-100 shadow-emerald-950/20"
                      : "bg-rose-950/30 border-rose-500/40 text-rose-100 shadow-rose-950/20"
                  }`}
                  style={{
                    backdropFilter: "blur(12px)",
                  }}
                >
                  {/* Top Status Bar with Badge */}
                  <div
                    className={`px-4 py-2 border-b flex items-center justify-between ${
                      isGreen
                        ? "bg-emerald-900/40 border-emerald-500/20 text-emerald-300"
                        : "bg-rose-900/40 border-rose-500/20 text-rose-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 font-mono ${
                          isGreen ? "bg-emerald-500/25 text-emerald-200" : "bg-rose-500/25 text-rose-200"
                        }`}
                      >
                        {isGreen ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                            <span>Rule {rule.ruleNumber}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-rose-400 font-bold text-sm leading-none">×</span>
                            <span>Rule {rule.ruleNumber}</span>
                          </>
                        )}
                      </span>
                    </div>

                    <span className="text-[11px] font-medium tracking-wide">
                      {isGreen ? (
                        <span className="text-emerald-400 font-semibold">SATISFIED</span>
                      ) : (
                        <span className="text-rose-400/90 font-semibold">REQUIRED</span>
                      )}
                    </span>
                  </div>

                  {/* Rule Card Body */}
                  <div className="p-4">
                    <p className={`text-sm sm:text-base font-medium leading-relaxed ${isGreen ? "text-emerald-100" : "text-rose-100"}`}>
                      {rule.title}
                    </p>

                    {/* Dynamic rule details / interactive sub-indicators */}
                    {rule.renderDetails()}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Completion Gate & Final Submit Action ──────────────── */}
        <div className="mt-8 pt-6 border-t border-white/10 relative z-10 space-y-4">
          {isAllSatisfied ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center space-y-1"
            >
              <div className="flex items-center justify-center gap-2 font-bold text-base sm:text-lg">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-spin" />
                <span>All 20 Progressive Rules Satisfied!</span>
              </div>
              <p className="text-xs text-emerald-400/80">
                The Master Security Vault is primed. Click below to submit and finalize the Tech Relay challenge.
              </p>
            </motion.div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Gate Status: <strong>{totalSatisfied} of 20 Rules Met</strong></span>
              <span>All 20 rules must turn green to unlock</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={!isAllSatisfied || isSubmitting}
            className={`w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg tracking-wide uppercase flex items-center justify-center gap-3 transition-all duration-300 ${
              isAllSatisfied
                ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-xl shadow-emerald-500/25 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
                : "bg-slate-900/60 border border-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Unlocking Security Vault...</span>
              </>
            ) : isAllSatisfied ? (
              <>
                <Unlock className="w-5 h-5 text-slate-950" />
                <span>⚡ UNLOCK VAULT & SUBMIT CHALLENGE</span>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 text-slate-500" />
                <span>Complete All 20 Rules To Unlock ({totalSatisfied}/20)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
