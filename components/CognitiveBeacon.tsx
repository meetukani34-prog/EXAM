"use client";

import React from 'react';
import { LazyMotion, m, AnimatePresence, domAnimation } from 'framer-motion';
import styles from './CodingInterface.module.css';

interface CognitiveBeaconProps {
  hint: string;
  isRevealed: boolean;
  onReveal: () => void;
}

export default function CognitiveBeacon({ hint, isRevealed, onReveal }: CognitiveBeaconProps) {
  if (!hint) return null;

  return (
    <LazyMotion features={domAnimation}>
      <div className={styles.beaconContainer}>
        <div className={styles.beaconGlow} />
        <div className={styles.beaconHeader}>
          <span className={styles.beaconIcon}>💡</span>
          <span className={styles.beaconTitle}>Cognitive Beacon</span>
        </div>

        <AnimatePresence mode="wait">
          {!isRevealed ? (
            <m.button
              key="reveal-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={styles.revealBtn}
              onClick={onReveal}
            >
              Reveal Insight Drift
            </m.button>
          ) : (
            <m.div
              key="hint-content"
              initial={{ filter: 'blur(8px)', opacity: 0 }}
              animate={{ filter: 'blur(0px)', opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={styles.hintText}
            >
              {hint}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
