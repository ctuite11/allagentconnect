import React from "react";
import Monogram from "./Monogram";

const LEFT_NODES = [
  { label: "Seller agent access", icon: "M12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20Z M12 4V2 M12 22V20 M4 12H2 M22 12H20" },
  { label: "Buyer agent access", icon: "M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21 M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" },
  { label: "Buyer/Renter Needs", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" },
  { label: "Off-market listings", icon: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z" },
  { label: "Coming-soon listings", icon: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0" },
];

const RIGHT_NODES = [
  { label: "Increased deal velocity", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { label: "Actionable intelligence", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
  { label: "Stronger agent relationships", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M9 3a4 4 0 010 8 M16 3.13a4 4 0 010 7.75" },
  { label: "Increased GCI", icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" },
  { label: "Higher agent production / GCI", icon: "M3 3v18h18 M18 9l-5 5-3-3-4 4" },
];

const leftYFractions = [-0.68, -0.34, 0, 0.34, 0.68];
const rightYFractions = [-0.68, -0.34, 0, 0.34, 0.68];

/* ── scoped keyframes ── */
const scopedStyles = `
@keyframes eco-orbit {
  to { transform: rotate(360deg); }
}
@keyframes eco-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes eco-glow-pulse {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.06); }
}
@keyframes eco-particle {
  0% { offset-distance: 0%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
`;

const ResultsHub = () => {
  const W = 1000, H = 420;
  const cx = W / 2, cy = H / 2;
  const spread = 140;
  const PILL_W = 180, PILL_H = 32;
  const leftNodeX = 155, rightNodeX = W - 155;

  /* orbit rings */
  const orbitRadii = [52, 72, 96];

  /* orbit dot positions (angle, radius, speed multiplier) */
  const orbitDots = [
    { r: 52, startAngle: 0, dur: 28 },
    { r: 52, startAngle: 180, dur: 28 },
    { r: 72, startAngle: 90, dur: 36 },
    { r: 72, startAngle: 270, dur: 36 },
    { r: 96, startAngle: 45, dur: 44 },
    { r: 96, startAngle: 200, dur: 44 },
  ];

  const leftNodes = LEFT_NODES.map((n, i) => ({ ...n, x: leftNodeX, y: cy + leftYFractions[i] * spread }));
  const rightNodes = RIGHT_NODES.map((n, i) => ({ ...n, x: rightNodeX, y: cy + rightYFractions[i] * spread }));

  const buildPath = (nx: number, ny: number, side: "left" | "right") => {
    const isLeft = side === "left";
    const outerR = orbitRadii[orbitRadii.length - 1] + 4;
    const angle = Math.atan2(ny - cy, nx - cx);
    const hx = cx + Math.cos(angle) * outerR;
    const hy = cy + Math.sin(angle) * outerR;
    const npx = isLeft ? nx + PILL_W / 2 + 20 : nx - PILL_W / 2 - 20;
    const cpx1 = isLeft ? npx + 50 : npx - 50;
    const cpx2 = isLeft ? hx - 36 : hx + 36;
    return `M ${npx} ${ny} C ${cpx1} ${ny}, ${cpx2} ${hy}, ${hx} ${hy}`;
  };

  return (
    <section className="w-full py-20 px-4 overflow-hidden" style={{ background: "#0a0e1a" }}>
      <style>{scopedStyles}</style>
      <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center max-w-[680px]">
          <div className="inline-flex items-center gap-2 pl-3.5 pr-5 py-2 rounded-full" style={{ background: "rgba(14,86,245,0.08)", border: "1px solid rgba(14,86,245,0.18)" }}>
            <span className="font-['Manrope'] font-semibold text-[14px] tracking-[0.28px]" style={{ color: "#6B9AFF" }}>⚡ Capability</span>
          </div>
          <h2 className="font-['Manrope'] font-bold text-[clamp(28px,4vw,48px)] tracking-[-1.5px] leading-[1.12]" style={{ color: "#ffffff" }}>
            Turning network intelligence into real results.
          </h2>
          <p className="font-['Manrope'] font-bold text-[20px] tracking-[-0.3px] leading-[1.4] mt-1" style={{ color: "#0E56F5" }}>
            Data in. Dollars out.
          </p>
        </div>

        {/* Desktop SVG radial diagram */}
        <div className="hidden lg:block w-full" style={{ maxWidth: W }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }} aria-label="All Agent Connect ecosystem diagram">

            {/* ── Connector lines ── */}
            {leftNodes.map((n) => (
              <path key={n.label + "-line"} d={buildPath(n.x, n.y, "left")} fill="none" stroke="rgba(14,86,245,0.2)" strokeWidth="1" strokeDasharray="4 4" strokeLinecap="round" />
            ))}
            {rightNodes.map((n) => (
              <path key={n.label + "-line"} d={buildPath(n.x, n.y, "right")} fill="none" stroke="rgba(5,150,105,0.2)" strokeWidth="1" strokeDasharray="4 4" strokeLinecap="round" />
            ))}

            {/* ── Traveling particles ── */}
            {leftNodes.map((n, i) => {
              const pathId = `left-path-${i}`;
              return (
                <g key={`left-particle-${i}`}>
                  <path id={pathId} d={buildPath(n.x, n.y, "left")} fill="none" stroke="none" />
                  <circle r="2.5" fill="#0E56F5" opacity="0">
                    <animateMotion dur={`${3 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.6}s`}>
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur={`${3 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.6}s`} />
                  </circle>
                </g>
              );
            })}
            {rightNodes.map((n, i) => {
              const pathId = `right-path-${i}`;
              /* Reverse the path so particles travel from center → right */
              const fwd = buildPath(n.x, n.y, "right");
              return (
                <g key={`right-particle-${i}`}>
                  <path id={pathId} d={fwd} fill="none" stroke="none" />
                  <circle r="2.5" fill="#059669" opacity="0">
                    <animateMotion dur={`${3 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.5}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur={`${3 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.5}s`} />
                  </circle>
                </g>
              );
            })}

            {/* ── Glow behind monogram ── */}
            <circle cx={cx} cy={cy} r={96} fill="url(#centerGlow)" style={{ animation: "eco-glow-pulse 4s ease-in-out infinite" }} />
            <defs>
              <radialGradient id="centerGlow">
                <stop offset="0%" stopColor="#0E56F5" stopOpacity="0.25" />
                <stop offset="60%" stopColor="#0E56F5" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#0E56F5" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ── Orbit rings ── */}
            {orbitRadii.map((r) => (
              <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
            ))}

            {/* ── Orbit dots ── */}
            {orbitDots.map((d, i) => (
              <g key={`orbit-dot-${i}`} style={{ transformOrigin: `${cx}px ${cy}px`, animation: `eco-orbit ${d.dur}s linear infinite` }}>
                <circle cx={cx + d.r * Math.cos(d.startAngle * Math.PI / 180)} cy={cy + d.r * Math.sin(d.startAngle * Math.PI / 180)} r="2.2" fill="rgba(255,255,255,0.25)" />
              </g>
            ))}

            {/* ── Center monogram ── */}
            <foreignObject x={cx - 34} y={cy - 34} width={68} height={68} style={{ animation: "eco-float 5s ease-in-out infinite" }}>
              <div style={{ width: 68, height: 68, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Monogram size={60} />
              </div>
            </foreignObject>

            {/* ── Center labels ── */}
            <text x={cx} y={cy + 50} textAnchor="middle" fontFamily="Manrope,Helvetica" fontWeight="800" fontSize="14" letterSpacing="-0.3" fill="#ffffff">All Agent Connect</text>
            <text x={cx} y={cy + 66} textAnchor="middle" fontFamily="Manrope,Helvetica" fontWeight="500" fontSize="11.5" fill="#92a2bb">Private agent network</text>

            {/* ── Left pills (blue) ── */}
            {leftNodes.map((n) => {
              const iconBoxSize = 28, gap = 6;
              const totalW = iconBoxSize + gap + PILL_W;
              const startX = n.x - totalW / 2 - 10;
              return (
                <g key={n.label} transform={`translate(${startX}, ${n.y - PILL_H / 2})`}>
                  <rect x="0" y="0" width={iconBoxSize} height={PILL_H} rx="6" fill="rgba(14,86,245,0.08)" stroke="rgba(14,86,245,0.18)" strokeWidth="0.8" />
                  <g transform={`translate(${iconBoxSize / 2 - 7}, ${PILL_H / 2 - 7})`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4B83F7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                  </g>
                  <rect x={iconBoxSize + gap} y="0" width={PILL_W} height={PILL_H} rx={PILL_H / 2} fill="rgba(14,86,245,0.06)" stroke="rgba(14,86,245,0.25)" strokeWidth="0.8" />
                  <text x={iconBoxSize + gap + PILL_W / 2} y={PILL_H / 2 + 4.5} textAnchor="middle" fontFamily="Manrope,Helvetica" fontWeight="600" fontSize="11.5" fill="#c8d5f0">{n.label}</text>
                </g>
              );
            })}

            {/* ── Right pills (green) ── */}
            {rightNodes.map((n) => {
              const iconBoxSize = 28, gap = 6;
              const startX = n.x - PILL_W / 2 + 10;
              return (
                <g key={n.label} transform={`translate(${startX}, ${n.y - PILL_H / 2})`}>
                  <rect x="0" y="0" width={PILL_W} height={PILL_H} rx={PILL_H / 2} fill="rgba(5,150,105,0.06)" stroke="rgba(5,150,105,0.25)" strokeWidth="0.8" />
                  <circle cx={14} cy={PILL_H / 2} r={3.5} fill="#059669" />
                  <text x={PILL_W / 2 + 4} y={PILL_H / 2 + 4.5} textAnchor="middle" fontFamily="Manrope,Helvetica" fontWeight="600" fontSize="11.5" fill="#b4e4cb">{n.label}</text>
                  <rect x={PILL_W + gap} y="0" width={iconBoxSize} height={PILL_H} rx="6" fill="rgba(5,150,105,0.08)" stroke="rgba(5,150,105,0.18)" strokeWidth="0.8" />
                  <g transform={`translate(${PILL_W + gap + iconBoxSize / 2 - 7}, ${PILL_H / 2 - 7})`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4eca8a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── Mobile fallback ── */}
        <div className="lg:hidden w-full flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(14,86,245,0.25) 0%, transparent 70%)", transform: "scale(2.2)" }} />
              <Monogram size={56} />
            </div>
            <p className="font-['Manrope'] font-bold text-[14px]" style={{ color: "#ffffff" }}>All Agent Connect</p>
            <p className="font-['Manrope'] font-medium text-[12px] -mt-2" style={{ color: "#92a2bb" }}>Private agent network</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LEFT_NODES.map((n) => (
              <div key={n.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-sm" style={{ background: "rgba(14,86,245,0.06)", border: "1px solid rgba(14,86,245,0.2)" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#0E56F5" }} />
                <span className="font-['Manrope'] font-semibold text-[12px]" style={{ color: "#c8d5f0" }}>{n.label}</span>
              </div>
            ))}
            {RIGHT_NODES.map((n) => (
              <div key={n.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-sm" style={{ background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#059669" }} />
                <span className="font-['Manrope'] font-semibold text-[12px]" style={{ color: "#b4e4cb" }}>{n.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResultsHub;
