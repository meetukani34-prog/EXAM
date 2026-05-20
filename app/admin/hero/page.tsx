"use client";

import React, { useState } from "react";
import { ChevronDown, Infinity, Menu, X } from "lucide-react";
import styles from "./hero.module.css";

const BG_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4";

const navLinks = [
  { label: "Home", active: true },
  { label: "Wellness", dropdown: true },
  { label: "Routine" },
  { label: "Our Team" },
];

export default function HeroPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.heroRoot}>
      {/* ── Background Video ── */}
      <video
        className={styles.bgVideo}
        autoPlay
        muted
        loop
        playsInline
        src={BG_VIDEO}
      />

      {/* ── Navbar ── */}
      <nav className={styles.navbar}>
        {/* Logo (left) */}
        <div className={styles.logo}>
          <Infinity size={22} strokeWidth={1.5} />
          <span className={styles.logoText}>Equilibrium</span>
        </div>

        {/* Nav pill (center — desktop only) */}
        <div className={`${styles.navPill} ${styles.liquidGlass}`}>
          {navLinks.map((link) => (
            <button
              key={link.label}
              className={`${styles.navLink} ${
                link.active ? styles.navLinkActive : styles.navLinkInactive
              }`}
            >
              {link.label}
              {link.dropdown && (
                <ChevronDown size={13} className={styles.dropdownIcon} />
              )}
            </button>
          ))}
        </div>

        {/* CTAs (right — desktop only) */}
        <div className={styles.ctaGroup}>
          <button className={`${styles.btnLogin} ${styles.liquidGlass}`}>
            Log in
          </button>
          <button className={styles.btnBegin}>Begin Now</button>
        </div>

        {/* Mobile toggle */}
        <button
          className={`${styles.mobileToggle} ${styles.liquidGlass}`}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {/* ── Mobile Menu ── */}
      {menuOpen && (
        <div className={`${styles.mobileMenu} ${styles.liquidGlass}`}>
          {navLinks.map((link) => (
            <button
              key={link.label}
              className={`${styles.mobileNavLink} ${
                link.active ? styles.mobileNavLinkActive : ""
              }`}
            >
              <span>{link.label}</span>
              {link.dropdown && <ChevronDown size={13} />}
            </button>
          ))}
          <div className={styles.mobileCTARow}>
            <button
              className={`${styles.mobileCTABtn} ${styles.btnLogin} ${styles.liquidGlass}`}
            >
              Log in
            </button>
            <button
              className={`${styles.mobileCTABtn} ${styles.btnBegin}`}
            >
              Begin Now
            </button>
          </div>
        </div>
      )}

      {/* ── Hero Content (bottom-left) ── */}
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>
          Live Better, Feel Whole Every Day
        </h1>
        <p className={styles.heroSubtitle}>
          Take charge of how you feel with a companion built for your
          journey—build routines, follow your growth, and unlock tailored
          insights for a steadier, more vibrant life each day.
        </p>
        <div className={styles.heroBtnRow}>
          <button className={styles.btnStartToday}>Start Today</button>
          <button className={`${styles.btnDiscover} ${styles.liquidGlass}`}>
            Discover How
          </button>
        </div>
      </div>
    </div>
  );
}
