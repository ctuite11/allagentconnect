import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type HeroDNASize = "sm" | "md" | "lg";

type HeroDNAProps = {
  className?: string;
  /** 0..1 */
  opacity?: number;
  size?: HeroDNASize;
};

const sizeToStroke = (size: HeroDNASize) => {
  switch (size) {
    case "sm":
      return { rail: 2.2, rung: 1.2, dot: 2.2 };
    case "md":
      return { rail: 2.6, rung: 1.35, dot: 2.6 };
    case "lg":
    default:
      return { rail: 3.0, rung: 1.5, dot: 3.0 };
  }
};

export default function HeroDNA({
  className,
  opacity = 0.22,
  size = "lg",
}: HeroDNAProps) {
  const o = Math.min(1, Math.max(0, opacity));
  const s = sizeToStroke(size);

  // Helix geometry (SVG space)
  const W = 900;
  const H = 900;
  const cx = W / 2;

  const steps = 22;
  const amp = 180;
  const topPad = 90;
  const bottomPad = 90;
  const span = H - topPad - bottomPad;

  // Build points for left/right rails and rungs
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const y = topPad + t * span;

    // phase shift creates the twist
    const phase = t * Math.PI * 4; // two full twists
    const xA = cx + Math.sin(phase) * amp;
    const xB = cx + Math.sin(phase + Math.PI) * amp;

    // Depth cue: rungs fade based on "front/back"
    const z = (Math.cos(phase) + 1) / 2;
    return { t, y, xA, xB, z };
  });

  const railPath = (key: "xA" | "xB") => {
    const p = pts;
    const d: string[] = [];
    d.push(`M ${p[0][key]} ${p[0].y}`);
    for (let i = 1; i < p.length; i++) {
      const prev = p[i - 1];
      const cur = p[i];
      const midY = (prev.y + cur.y) / 2;
      d.push(`C ${prev[key]} ${midY}, ${cur[key]} ${midY}, ${cur[key]} ${cur.y}`);
    }
    return d.join(" ");
  };

  const pathA = railPath("xA");
  const pathB = railPath("xB");

  return (
    <div
      className={cn(
        "relative overflow-visible pointer-events-none select-none",
        className
      )}
      style={{ opacity: o }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Soft glow filter */}
          <filter id="dna-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient for rail A */}
          <linearGradient id="railGradA" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0E56F5" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="1" />
            <stop offset="100%" stopColor="#0E56F5" stopOpacity="0.6" />
          </linearGradient>

          {/* Gradient for rail B */}
          <linearGradient id="railGradB" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#10B981" stopOpacity="1" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Rotate the whole helix slowly for "life" */}
        <motion.g
          animate={{ rotateY: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center center" }}
          filter="url(#dna-glow)"
        >
          {/* Rails */}
          <path
            d={pathA}
            stroke="url(#railGradA)"
            strokeWidth={s.rail}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={pathB}
            stroke="url(#railGradB)"
            strokeWidth={s.rail}
            fill="none"
            strokeLinecap="round"
          />

          {/* Rungs (base pairs) */}
          {pts.map((p, idx) => {
            if (idx === 0 || idx === pts.length - 1) return null;

            // Fade rungs based on depth cue
            const rungOpacity = 0.10 + p.z * 0.30;

            return (
              <g key={idx}>
                <line
                  x1={p.xA}
                  y1={p.y}
                  x2={p.xB}
                  y2={p.y}
                  stroke="#94A3B8"
                  strokeWidth={s.rung}
                  strokeOpacity={rungOpacity}
                  strokeLinecap="round"
                />
                {/* endpoints as tiny nodes */}
                <circle cx={p.xA} cy={p.y} r={s.dot} fill="#0E56F5" fillOpacity={rungOpacity * 1.2} />
                <circle cx={p.xB} cy={p.y} r={s.dot} fill="#059669" fillOpacity={rungOpacity * 1.2} />
              </g>
            );
          })}

          {/* Twinkle particles (subtle) */}
          {pts
            .filter((_, i) => i % 3 === 0)
            .map((p, i) => (
              <motion.circle
                key={`twinkle-${i}`}
                cx={(p.xA + p.xB) / 2}
                cy={p.y}
                r={2}
                fill="#fff"
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{
                  duration: 2 + i * 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
        </motion.g>
      </svg>
    </div>
  );
}
