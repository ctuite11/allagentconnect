import React from "react";

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
      return { rail: 4.6, rung: 1.9, dot: 3.2 };
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

  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const y = topPad + t * span;

    const phase = t * Math.PI * 4; // two full twists
    const xA = cx + Math.sin(phase) * amp;
    const xB = cx + Math.sin(phase + Math.PI) * amp;

    const z = (Math.cos(phase) + 1) / 2; // 0..1 front/back cue
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
      className={
        "relative overflow-visible pointer-events-none select-none" +
        (className ? ` ${className}` : "")
      }
      style={{ opacity: o }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Soft glow */}
          <filter id="dnaGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.45 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Brand gradients */}
          <linearGradient id="railA" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0E56F5" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0E56F5" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="railB" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#BFDBFE" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Inline CSS animations (no deps) */}
        <style>{`
          @keyframes dnaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .dna-rot { transform-origin: 50% 50%; animation: dnaSpin 58s linear infinite; }

          @keyframes dnaTwinkle { 0%,100% { opacity: .10; } 50% { opacity: .28; } }
          .dna-twinkle { animation: dnaTwinkle 3.6s ease-in-out infinite; }
        `}</style>

        <g className="dna-rot">
          {/* Rails */}
          <path
            d={pathA}
            fill="none"
            stroke="url(#railA)"
            strokeWidth={s.rail}
            filter="url(#dnaGlow)"
          />
          <path
            d={pathB}
            fill="none"
            stroke="url(#railB)"
            strokeWidth={s.rail}
            filter="url(#dnaGlow)"
          />

          {/* Rungs */}
          {pts.map((p, idx) => {
            if (idx === 0 || idx === pts.length - 1) return null;

            // Depth cue makes the helix read as 3D
            const rungOpacity = 0.14 + p.z * 0.34;

            return (
              <g key={idx} opacity={rungOpacity}>
                <line
                  x1={p.xA}
                  y1={p.y}
                  x2={p.xB}
                  y2={p.y}
                  stroke="#94A3B8"
                  strokeWidth={s.rung}
                  strokeLinecap="round"
                />
                <circle cx={p.xA} cy={p.y} r={s.dot} fill="#0E56F5" opacity={0.70} />
                <circle cx={p.xB} cy={p.y} r={s.dot} fill="#93C5FD" opacity={0.55} />
              </g>
            );
          })}

          {/* Twinkles */}
          {pts
            .filter((_, i) => i % 3 === 0)
            .map((p, i) => (
              <circle
                key={`tw-${i}`}
                className="dna-twinkle"
                cx={cx + (p.xA - cx) * 0.35}
                cy={p.y}
                r={2.2}
                fill="#E2E8F0"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
        </g>
      </svg>
    </div>
  );
}
