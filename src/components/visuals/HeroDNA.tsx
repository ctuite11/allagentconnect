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
          <filter id="dna-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style>{`
          .dna-rot {
            transform-box: fill-box;
            transform-origin: center;
            animation: dnaSpin 20s linear infinite;
            will-change: transform;
          }
          @keyframes dnaSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .dna-twinkle {
            animation: dnaTwinkle 2.4s ease-in-out infinite;
          }
          @keyframes dnaTwinkle {
            0%, 100% { opacity: 0.15; }
            50% { opacity: 0.65; }
          }
        `}</style>

        <g className="dna-rot" filter="url(#dna-glow)">
          {/* Rails */}
          <path
            d={pathA}
            stroke="currentColor"
            strokeWidth={s.rail}
            fill="none"
            strokeLinecap="round"
            opacity={0.65}
          />
          <path
            d={pathB}
            stroke="currentColor"
            strokeWidth={s.rail}
            fill="none"
            strokeLinecap="round"
            opacity={0.35}
          />

          {/* Rungs */}
          {pts.map((p, idx) => {
            if (idx === 0 || idx === pts.length - 1) return null;
            const rungOpacity = 0.10 + p.z * 0.30;

            return (
              <g key={idx}>
                <line
                  x1={p.xA}
                  y1={p.y}
                  x2={p.xB}
                  y2={p.y}
                  stroke="currentColor"
                  strokeWidth={s.rung}
                  strokeOpacity={rungOpacity}
                  strokeLinecap="round"
                />
                <circle
                  cx={p.xA}
                  cy={p.y}
                  r={s.dot}
                  fill="currentColor"
                  fillOpacity={rungOpacity}
                />
                <circle
                  cx={p.xB}
                  cy={p.y}
                  r={s.dot}
                  fill="currentColor"
                  fillOpacity={rungOpacity * 0.75}
                />
              </g>
            );
          })}

          {/* Twinkles */}
          {pts
            .filter((_, i) => i % 3 === 0)
            .map((p, i) => (
              <circle
                key={`twinkle-${i}`}
                className="dna-twinkle"
                cx={(p.xA + p.xB) / 2}
                cy={p.y}
                r={2}
                fill="white"
                style={{ animationDelay: `${i * 0.22}s` }}
                opacity={0.25}
              />
            ))}
        </g>
      </svg>
    </div>
  );
}
