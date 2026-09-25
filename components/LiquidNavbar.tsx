"use client";

import { motion } from "framer-motion";
import styles from "./LiquidNavbar.module.css";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

interface LiquidNavbarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function LiquidNavbar({ tabs, activeTab, onTabChange }: LiquidNavbarProps) {
  return (
    <div className={styles.navbarContainer}>
      <nav className={styles.navbar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`${styles.tabBtn} ${isActive ? styles.active : ""}`}
            >
              {isActive && (
                <motion.div
                  layoutId="liquid-indicator"
                  className={styles.indicator}
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <span className={styles.tabContent}>
                {tab.icon && <span className={styles.icon}>{tab.icon}</span>}
                <span className={styles.label}>{tab.label}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
