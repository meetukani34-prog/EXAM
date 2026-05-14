"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CodingInterface.module.css';

interface CognitiveBeaconProps {
  hint: string;
  isRevealed: boolean;
  onReveal: () => void;
}

export default function CognitiveBeacon({ hint, isRevealed, onReveal }: CognitiveBeaconProps) {
  if (!hint) return null;

  return (
    <div className={styles.beaconContainer}>
      <div className={styles.beaconGlow} />
      <div className={styles.beaconHeader}>
        <span className={styles.beaconIcon}>💡</span>
        <span className={styles.beaconTitle}>Cognitive Beacon</span>
      </div>

      <AnimatePresence mode="wait">
        {!isRevealed ? (
          <motion.button
            key="reveal-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={styles.revealBtn}
            onClick={onReveal}
          >
            Reveal Insight Drift
          </motion.button>
        ) : (
          <motion.div
            key="hint-content"
            initial={{ filter: 'blur(10px)', opacity: 0 }}
            animate={{ filter: 'blur(0px)', opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={styles.hintText}
          >
            {hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
