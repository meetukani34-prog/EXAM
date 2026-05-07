"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────

export interface SpatialNode {
  id: string;
  name: string;
  type: "folder" | "exam";
  children?: SpatialNode[];
  examData?: {
    duration: number;
    questions: number;
    branch: string;
    isActive: boolean;
  };
  depth: number;
}

// ── Mock Data ──────────────────────────────────────────────────

const MOCK_HIERARCHY: SpatialNode[] = [
  {
    id: "f1",
    name: "Semester 1",
    type: "folder",
    depth: 0,
    children: [
      {
        id: "f1-1",
        name: "Data Structures",
        type: "folder",
        depth: 1,
        children: [
          {
            id: "e1",
            name: "Linked Lists Quiz",
            type: "exam",
            depth: 2,
            examData: { duration: 30, questions: 15, branch: "CS", isActive: true },
          },
          {
            id: "e2",
            name: "Stack & Queues",
            type: "exam",
            depth: 2,
            examData: { duration: 45, questions: 20, branch: "CS", isActive: true },
          },
        ],
      },
      {
        id: "f1-2",
        name: "Computer Networks",
        type: "folder",
        depth: 1,
        children: [
          {
            id: "e3",
            name: "OSI Model Basics",
            type: "exam",
            depth: 2,
            examData: { duration: 20, questions: 10, branch: "CS", isActive: true },
          },
        ],
      },
    ],
  },
  {
    id: "f2",
    name: "Semester 2",
    type: "folder",
    depth: 0,
    children: [
      {
        id: "e4",
        name: "Advanced Java",
        type: "exam",
        depth: 1,
        examData: { duration: 60, questions: 30, branch: "CSE", isActive: true },
      },
    ],
  },
];

// ── Components ─────────────────────────────────────────────────

export default function SpatialHierarchy({ onLaunchExam }: { onLaunchExam: (exam: any) => void }) {
  const [hierarchy, setHierarchy] = useState<SpatialNode[]>(MOCK_HIERARCHY);
  const [currentPathIds, setCurrentPathIds] = useState<string[]>([]);
  
  const currentPathNodes = useMemo(() => {
    let nodes: SpatialNode[] = [];
    let currentLevel = hierarchy;
    for (const id of currentPathIds) {
        const node = currentLevel.find(n => n.id === id);
        if (node) {
            nodes.push(node);
            currentLevel = node.children || [];
        }
    }
    return nodes;
  }, [hierarchy, currentPathIds]);

  // Navigate into a folder
  const handleEnterNode = (node: SpatialNode) => {
    if (node.type === "folder") {
      setCurrentPathIds((prev) => [...prev, node.id]);
    } else {
      onLaunchExam(node);
    }
  };

  // Navigate back to a specific level
  const handleNavigateTo = (index: number) => {
    if (index === -1) {
      setCurrentPathIds([]);
    } else {
      setCurrentPathIds((prev) => prev.slice(0, index + 1));
    }
  };

  // Current view nodes
  const currentNodes = useMemo(() => {
    if (currentPathNodes.length === 0) return hierarchy;
    return currentPathNodes[currentPathNodes.length - 1].children || [];
  }, [hierarchy, currentPathNodes]);

  const handleAddFolder = () => {
    const folderName = prompt("Enter folder name:") || "New Folder";
    const newFolder: SpatialNode = {
      id: `f-${Date.now()}`,
      name: folderName,
      type: "folder",
      depth: currentPathIds.length,
      children: [],
    };

    if (currentPathIds.length === 0) {
      setHierarchy([...hierarchy, newFolder]);
    } else {
      const updateHierarchy = (nodes: SpatialNode[], pathIndex: number): SpatialNode[] => {
        if (pathIndex === currentPathIds.length) return nodes;
        return nodes.map(node => {
          if (node.id === currentPathIds[pathIndex]) {
            if (pathIndex === currentPathIds.length - 1) {
              return { ...node, children: [...(node.children || []), newFolder] };
            }
            return { ...node, children: updateHierarchy(node.children || [], pathIndex + 1) };
          }
          return node;
        });
      };
      setHierarchy(updateHierarchy(hierarchy, 0));
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "60vh", width: "100%" }}>
      {/* 1. Luminous Path-Trace (Breadcrumbs) & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: "20px", zIndex: 20, position: "relative" }}>
        <LuminousBreadcrumbs path={currentPathNodes} onNavigate={handleNavigateTo} />
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAddFolder}
          style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.2))",
            border: "1px solid rgba(99,102,241,0.4)",
            borderRadius: "12px",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backdropFilter: "blur(10px)"
          }}
        >
          <span>+</span> New Folder
        </motion.button>
      </div>

      {/* 2. Spatial Node Container */}
      <div style={{ padding: "40px 0" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPathIds.length > 0 ? currentPathIds[currentPathIds.length - 1] : "root"}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={warpVariants}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "30px",
              perspective: "1000px",
            }}
          >
            {currentNodes.map((node) => (
              <SpatialNodeItem
                key={node.id}
                node={node}
                onClick={() => handleEnterNode(node)}
                depth={currentPathIds.length}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Atmospheric Background Glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
    </div>
  );
}

// ── Shared Transitions ──────────────────────────────────────────

const warpVariants: any = {
  initial: {
    scale: 0.8,
    opacity: 0,
    filter: "blur(20px)",
    z: -100,
  },
  animate: {
    scale: 1,
    opacity: 1,
    filter: "blur(0px)",
    z: 0,
    transition: {
      duration: 0.8,
      ease: [0.34, 1.56, 0.64, 1] as any,
      staggerChildren: 0.05,
    },
  },
  exit: {
    scale: 1.5,
    opacity: 0,
    filter: "blur(40px)",
    z: 100,
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
};

// ── Luminous Breadcrumbs ────────────────────────────────────────

function LuminousBreadcrumbs({
  path,
  onNavigate,
}: {
  path: SpatialNode[];
  onNavigate: (index: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "20px 0",
        position: "relative",
      }}
    >
      {/* Root Dot */}
      <BreadcrumbDot
        active={path.length === 0}
        label="Portal"
        onClick={() => onNavigate(-1)}
      />

      {path.map((node, i) => (
        <div key={node.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 40, opacity: 0.3 }}
            style={{
              height: "1px",
              background: "linear-gradient(90deg, #6366f1, transparent)",
            }}
          />
          <BreadcrumbDot
            active={i === path.length - 1}
            label={node.name}
            onClick={() => onNavigate(i)}
          />
        </div>
      ))}
    </div>
  );
}

function BreadcrumbDot({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <motion.div
        animate={{
          boxShadow: active ? "0 0 15px #6366f1" : "0 0 0px transparent",
          scale: active ? 1.2 : 1,
        }}
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: active ? "#6366f1" : "rgba(255,255,255,0.2)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      />
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          color: active ? "#6366f1" : "rgba(148,163,184,0.5)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </motion.div>
  );
}

// ── Spatial Node Item (Orb) ────────────────────────────────────

function SpatialNodeItem({
  node,
  onClick,
  depth,
}: {
  node: SpatialNode;
  onClick: () => void;
  depth: number;
}) {
  const isFolder = node.type === "folder";
  
  // Tethered Drifting Logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const dx = useSpring(x, springConfig);
  const dy = useSpring(y, springConfig);

  const handleDrag = (event: any, info: any) => {
    // Logic for delayed-weight physics would go here if we were using custom movement
    // But Framer Motion's `drag` already feels quite good with constraints
  };

  // Atmospheric Depth styling
  const atmosphericStyle = {
    zIndex: 10 - depth,
    filter: `blur(${depth * 1.5}px)`, // Increased blur for depth
    transform: `translateZ(${depth * -20}px) scale(${1 - depth * 0.05})`, // Perspective scaling
    opacity: 1 - depth * 0.15,
  };

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.1}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        position: "relative",
        cursor: "pointer",
        ...atmosphericStyle,
      }}
    >
      <div
        style={{
          padding: "32px",
          borderRadius: "32px",
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: isFolder 
            ? "0 20px 40px rgba(0,0,0,0.2), inset 0 0 20px rgba(255,255,255,0.02)"
            : "0 10px 30px rgba(99,102,241,0.1), inset 0 0 10px rgba(99,102,241,0.05)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow Pulse for active/special nodes */}
        {node.examData?.isActive && (
          <motion.div
            animate={{
              opacity: [0.05, 0.2, 0.05], // More subtle glow
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: "-20%", // Larger glow area
              background: "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)",
              zIndex: -1,
            }}
          />
        )}

        {/* Icon / Avatar */}
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: isFolder 
              ? "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))"
              : "linear-gradient(135deg, #6366f1, #06b6d4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            boxShadow: isFolder ? "none" : "0 0 20px rgba(6,182,212,0.3)",
          }}
        >
          {isFolder ? "📁" : "⚡"}
        </div>

        {/* Name */}
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#fff" }}>
            {node.name}
          </h3>
          <p style={{ fontSize: "12px", color: "rgba(148,163,184,0.6)", marginTop: "4px" }}>
            {isFolder ? `${node.children?.length || 0} items` : `${node.examData?.questions} Questions`}
          </p>
        </div>

        {/* Action Button */}
        {!isFolder && (
          <div
            style={{
              padding: "8px 16px",
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#818cf8",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Initialize
          </div>
        )}
      </div>
    </motion.div>
  );
}
