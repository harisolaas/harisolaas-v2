"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

interface Props {
  goal: number;
  label: string;
  treesLabel: string;
  locale: string;
  onCheckout: () => void;
  optimisticBump?: number;
}

// Seeded pseudo-random so the same count always renders the same forest
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Hill curve: returns y for a given x (0-100). Matches the SVG ground path.
function hillYAt(x: number): number {
  const t = x / 100;
  return 65 - Math.sin(t * Math.PI) * 12;
}

interface TreeData {
  x: number;
  baseY: number;
  height: number;
  canopyRx: number;
  canopyRy: number;
  lean: number;
  shade: string;
}

function Tree({ x, baseY, height, canopyRx, canopyRy, lean, shade }: TreeData) {
  const trunkHeight = height * 0.35;
  const trunkWidth = Math.max(1.2, height * 0.055);
  const canopyCy = baseY - trunkHeight - canopyRy * 0.6;

  return (
    <motion.g
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      style={{ originX: `${x}px`, originY: `${baseY}px` }}
    >
      <rect
        x={x - trunkWidth / 2 + lean * 0.3}
        y={baseY - trunkHeight}
        width={trunkWidth}
        height={trunkHeight}
        rx={0.4}
        fill="#6B4F3A"
      />
      <ellipse
        cx={x + lean}
        cy={canopyCy}
        rx={canopyRx}
        ry={canopyRy}
        fill={shade}
      />
    </motion.g>
  );
}

const GREENS = [
  "#2D4A3E",
  "#3A5F4F",
  "#4A7A5E",
  "#3E6B52",
  "#4F7D5F",
  "#5C8A6A",
];

export default function TreeCounter({ goal, label, treesLabel, locale, onCheckout, optimisticBump = 0 }: Props) {
  const [count, setCount] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    fetch("/api/brote/counter")
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  // Pre-compute ALL tree positions upfront.
  // Trees are placed in evenly-spaced slots, but the ORDER they appear in
  // is shuffled — so the first 10 tickets produce 10 trees spread across
  // the whole hill, not clumped to one side.
  const allTrees = useMemo(() => {
    const posRand = seededRandom(42);
    const shuffleRand = seededRandom(99);

    // 1. Generate a tree for each slot (evenly spaced)
    const slotTrees: TreeData[] = [];
    for (let i = 0; i < goal; i++) {
      const slot = (i + 0.5) / goal;
      const baseX = 8 + slot * 84;
      const jitter = (posRand() - 0.5) * (60 / goal);
      const x = Math.max(6, Math.min(94, baseX + jitter));

      const baseY = hillYAt(x) + 2;

      const distFromCenter = Math.abs(x - 50) / 50;
      const sizeFactor = 1 - distFromCenter * 0.2;

      const height = (10 + posRand() * 8) * sizeFactor;
      const canopyRx = (2.5 + posRand() * 2) * sizeFactor;
      const canopyRy = (3 + posRand() * 2.5) * sizeFactor;
      const lean = (posRand() - 0.5) * 1.5;
      const shade = GREENS[Math.floor(posRand() * GREENS.length)];

      slotTrees.push({ x, baseY, height, canopyRx, canopyRy, lean, shade });
    }

    // 2. Shuffle the order trees appear in (Fisher-Yates)
    const order = Array.from({ length: goal }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(shuffleRand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    // 3. Return trees in shuffled order
    return order.map((slotIdx) => slotTrees[slotIdx]);
  }, [goal]);

  const bump = optimisticBump || (hovered ? 1 : 0);
  const treeCount = Math.min(count + bump, goal);

  // Take the first N trees, then sort by baseY for painter's algorithm
  const visibleTrees = allTrees
    .slice(0, treeCount)
    .sort((a, b) => a.baseY - b.baseY);

  return (
    <div className="w-full max-w-sm mx-auto">
      <svg
        viewBox="0 0 100 70"
        preserveAspectRatio="xMidYMax meet"
        className="w-full h-auto"
        role="img"
        aria-label={`${count} ${treesLabel}`}
      >
        {/* Ground hill */}
        <path
          d="M0,65 Q25,56 50,53 Q75,56 100,65 L100,70 L0,70 Z"
          fill="#A8B5A0"
        />

        {/* Trees */}
        {visibleTrees.map((t) => (
          <Tree key={`tree-${t.x.toFixed(2)}`} {...t} />
        ))}

        {/* Counter text on the hill */}
        <text
          x="50"
          y="63"
          textAnchor="middle"
          fill="#2D4A3E"
          fontSize="3.2"
          fontWeight="600"
          opacity={0.7}
        >
          {locale === "es" ? "Árboles plantados" : "Trees planted"}
        </text>
        <text
          x="50"
          y="67.5"
          textAnchor="middle"
          fill="#2D4A3E"
          fontSize="4.5"
          fontWeight="700"
        >
          {treeCount}/{goal}
        </text>
      </svg>

      <button
        onClick={onCheckout}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="mt-2 block w-full cursor-pointer text-center text-md font-semibold text-forest underline decoration-forest/30 underline-offset-2 transition-colors hover:text-terracotta hover:decoration-terracotta/30"
      >
        {locale === "es"
          ? "Comprá tu entrada y hacé crecer el bosque ☝️"
          : "Get your ticket and grow the forest ☝️"}
      </button>

      {/* DEV ONLY — remove before launch */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-2 flex gap-2 justify-center">
          <button
            onClick={() => setCount((c) => Math.min(c + 1, goal))}
            className="rounded bg-forest/10 px-3 py-1 text-xs text-forest hover:bg-forest/20"
          >
            + 1
          </button>
          <button
            onClick={() => setCount((c) => Math.min(c + 10, goal))}
            className="rounded bg-forest/10 px-3 py-1 text-xs text-forest hover:bg-forest/20"
          >
            + 10
          </button>
          <button
            onClick={() => setCount(goal)}
            className="rounded bg-forest/10 px-3 py-1 text-xs text-forest hover:bg-forest/20"
          >
            Max
          </button>
          <button
            onClick={() => setCount(0)}
            className="rounded bg-forest/10 px-3 py-1 text-xs text-forest hover:bg-forest/20"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
