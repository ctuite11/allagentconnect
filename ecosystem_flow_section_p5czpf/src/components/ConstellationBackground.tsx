import { useMemo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Dot {
  id: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
}

interface Line {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface WakeNode {
  id: number;
  x: number;
  y: number;
  color: "blue" | "green";
}

export default function ConstellationBackground() {
  const dots: Dot[] = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: 3 + Math.random() * 2,
        delay: Math.random() * 4,
      })),
    []
  );

  const lines: Line[] = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x1: Math.random() * 100,
        y1: Math.random() * 100,
        x2: Math.random() * 100,
        y2: Math.random() * 100,
      })),
    []
  );

  // Wake-up nodes: brief glow on random background nodes
  const [wakeNodes, setWakeNodes] = useState<WakeNode[]>([]);

  useEffect(() => {
    let counter = 0;
    const fireWave = () => {
      const isBlue = counter % 2 === 0;
      const color: "blue" | "green" = isBlue ? "blue" : "green";
      // pick 4-7 nodes on the relevant side
      const side = isBlue ? [0, 38] : [62, 100]; // x% range
      const count = 4 + Math.floor(Math.random() * 4);
      const nodes: WakeNode[] = Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        x: side[0] + Math.random() * (side[1] - side[0]),
        y: 10 + Math.random() * 80,
        color,
      }));
      setWakeNodes(nodes);
      counter++;
      // clear after animation
      setTimeout(() => setWakeNodes([]), 1800);
    };

    const interval = setInterval(fireWave, 3200);
    // kick off after a short wait
    const timeout = setTimeout(fireWave, 1200);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* SVG connecting lines */}
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {lines.map((line) => (
          <line
            key={line.id}
            x1={`${line.x1}%`}
            y1={`${line.y1}%`}
            x2={`${line.x2}%`}
            y2={`${line.y2}%`}
            stroke="#3B82F6"
            strokeWidth="0.5"
            strokeOpacity="0.18"
          />
        ))}
      </svg>

      {/* Animated constellation dots */}
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-full"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: "3px",
            height: "3px",
            backgroundColor: "#3B82F6",
          }}
          animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.4, 1] }}
          transition={{ duration: dot.duration, delay: dot.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Network wake-up nodes */}
      <AnimatePresence>
        {wakeNodes.map((node) => (
          <motion.div
            key={node.id}
            className="absolute rounded-full"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: "8px",
              height: "8px",
              marginLeft: "-4px",
              marginTop: "-4px",
              backgroundColor: node.color === "blue" ? "#3B82F6" : "#22C55E",
              boxShadow: node.color === "blue"
                ? "0 0 12px 4px rgba(59,130,246,0.6)"
                : "0 0 12px 4px rgba(34,197,94,0.6)",
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0.9, 0.9, 0], scale: [0.4, 1.4, 1.2, 0.6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
