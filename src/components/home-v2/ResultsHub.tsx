import React from "react";

const LEFT_NODES = [
  { label: "Seller agent access", icon: "M12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20Z M12 4V2 M12 22V20 M4 12H2 M22 12H20", color: "#fac022" },
  { label: "Buyer agent access", icon: "M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21 M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z", color: "#ff6b56" },
  { label: "Buyer/Renter Needs", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10", color: "#fac022" },
  { label: "Off-market listings", icon: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z", color: "#fac022" },
  { label: "Coming-soon listings", icon: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0", color: "#92a2bb" },
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

const ResultsHub = () => {
  const W = 1100, H = 400;
  const cx = W / 2, cy = H / 2;
  const r1 = 36, r2 = 56, r3 = 80;
  const leftNodeX = 88, rightNodeX = W - 88;
  const spread = 148;

  const leftNodes = LEFT_NODES.map((n, i) => ({ ...n, x: leftNodeX, y: cy + leftYFractions[i] * spread }));
  const rightNodes = RIGHT_NODES.map((n, i) => ({ ...n, x: rightNodeX, y: cy + rightYFractions[i] * spread }));

  const buildPath = (nx: number, ny: number, side: "left" | "right") => {
    const isLeft = side === "left";
    const angle = Math.atan2(ny - cy, nx - cx);
    const hx = cx + Math.cos(angle) * (r3 + 2);
    const hy = cy + Math.sin(angle) * (r3 + 2);
    const npx = isLeft ? nx + 6 : nx - 6;
    const cpx1 = isLeft ? npx + 70 : npx - 70;
    const cpx2 = isLeft ? hx - 50 : hx + 50;
    return `M ${npx} ${ny} C ${cpx1} ${ny}, ${cpx2} ${hy}, ${hx} ${hy}`;
  };

  return (
    <section className="w-full bg-white py-28 px-4 overflow-hidden">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-16">
        {/* Header */}
        <div className="flex flex-col items-center gap-5 text-center max-w-[680px]">
          <div className="inline-flex items-center gap-2 pl-3.5 pr-5 py-2 bg-[#2537ff0f] border border-[#2537ff26] rounded-full">
            <span className="font-['Manrope'] font-semibold text-[#2537ff] text-[14px] tracking-[0.28px]">⚡ Capability</span>
          </div>
          <h2 className="font-['Manrope'] font-bold text-[#292d32] text-[clamp(28px,4vw,52px)] tracking-[-2px] leading-[1.15]">
            Turning network intelligence into real results.
          </h2>
          <p className="font-['Manrope'] font-medium text-[#40424d] text-[17px] leading-[1.7]">
            Data in. Dollars out.
          </p>
        </div>

        {/* Desktop SVG radial diagram */}
        <div className="hidden lg:block w-full -mt-4" style={{ maxWidth: W }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }} aria-label="All Agent Connect network diagram">
            {/* Connection lines */}
            {leftNodes.map((n) => (
              <path key={n.label + "-line"} d={buildPath(n.x, n.y, "left")} fill="none" stroke="#c7cfe0" strokeWidth="1.4" strokeDasharray="5 4" strokeLinecap="round" />
            ))}
            {rightNodes.map((n) => (
              <path key={n.label + "-line"} d={buildPath(n.x, n.y, "right")} fill="none" stroke="#c7cfe0" strokeWidth="1.4" strokeDasharray="5 4" strokeLinecap="round" />
            ))}

            {/* Hub glow rings */}
            <circle cx={cx} cy={cy} r={r3 + 90} fill="rgba(37,55,255,0.025)" style={{ filter: "blur(12px)" }} />
            <circle cx={cx} cy={cy} r={r3 + 66} fill="rgba(37,55,255,0.04)" style={{ filter: "blur(8px)" }} />
            <circle cx={cx} cy={cy} r={r3 + 46} fill="rgba(37,55,255,0.055)" style={{ filter: "blur(6px)" }} />
            <circle cx={cx} cy={cy} r={r3 + 30} fill="rgba(37,55,255,0.07)" style={{ filter: "blur(4px)" }} />
            <circle cx={cx} cy={cy} r={r3 + 16} fill="rgba(37,55,255,0.09)" style={{ filter: "blur(2px)" }} />
            <circle cx={cx} cy={cy} r={r3} fill="rgba(37,55,255,0.12)" stroke="rgba(37,55,255,0.14)" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={r2} fill="rgba(37,55,255,0.17)" stroke="rgba(37,55,255,0.20)" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={r1 + 6} fill="rgba(37,55,255,0.26)" />
            <circle cx={cx} cy={cy} r={r1} fill="#2537ff" />

            {/* Hub AAC monogram */}
            <g transform={`translate(${cx}, ${cy})`}>
              <line x1="-17" y1="5" x2="-12.5" y2="-5" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="-8" y1="5" x2="-12.5" y2="-5" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="-15.4" y1="1.4" x2="-9.6" y2="1.4" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="-4" y1="5" x2="0.5" y2="-5" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="5" y1="5" x2="0.5" y2="-5" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="-2.4" y1="1.4" x2="3.4" y2="1.4" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M 17 -3.5 A 5 5 0 1 0 17 3.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </g>

            {/* Hub label */}
            <text x={cx} y={cy + r3 + 34} textAnchor="middle" fontFamily="Manrope,Helvetica" fontWeight="700" fontSize="13" fill="#292d32">All Agent Connect</text>
            <text x={cx} y={cy + r3 + 50} textAnchor="middle" fontFamily="Manrope,Helvetica" fontWeight="500" fontSize="12" fill="#92a2bb">Private agent network</text>

            {/* Left nodes */}
            {leftNodes.map((n) => {
              const pillW = 160, pillH = 32, iconBoxSize = 30, gap = 8;
              const totalW = iconBoxSize + gap + pillW;
              const startX = n.x - totalW;
              return (
                <g key={n.label} transform={`translate(${startX}, ${n.y - pillH / 2})`}>
                  <rect x="0" y="0" width={iconBoxSize} height={pillH} rx="6" fill="white" stroke="#e8eaf0" strokeWidth="1.2" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.07))" }} />
                  <g transform={`translate(${iconBoxSize / 2 - 7}, ${pillH / 2 - 7})`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={n.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                  </g>
                  <rect x={iconBoxSize + gap} y="0" width={pillW} height={pillH} rx={pillH / 2} fill="white" stroke="#2537ff" strokeWidth="1.2" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.07))" }} />
                  <text x={iconBoxSize + gap + pillW / 2} y={pillH / 2 + 4.5} textAnchor="middle" fontFamily="Manrope,Helvetica" fontWeight="600" fontSize="11.5" fill="#40424d">{n.label}</text>
                </g>
              );
            })}

            {/* Right nodes */}
            {rightNodes.map((n) => {
              const pillW = 192, pillH = 32, iconBoxSize = 30, gap = 8;
              return (
                <g key={n.label} transform={`translate(${n.x}, ${n.y - pillH / 2})`}>
                  <rect x="0" y="0" width={pillW} height={pillH} rx={pillH / 2} fill="white" stroke="#1bc572" strokeWidth="1.2" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.07))" }} />
                  <circle cx={16} cy={pillH / 2} r={4} fill="#1bc572" />
                  <text x={pillW / 2 + 6} y={pillH / 2 + 4.5} textAnchor="middle" fontFamily="Manrope,Helvetica" fontWeight="600" fontSize="11.5" fill="#40424d">{n.label}</text>
                  <rect x={pillW + gap} y="0" width={iconBoxSize} height={pillH} rx="6" fill="white" stroke="#e8eaf0" strokeWidth="1.2" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.07))" }} />
                  <g transform={`translate(${pillW + gap + iconBoxSize / 2 - 7}, ${pillH / 2 - 7})`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92a2bb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Mobile: simple label list */}
        <div className="lg:hidden w-full flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#2537ff] flex items-center justify-center shadow-[0_0_0_10px_rgba(37,55,255,0.10)]">
              <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
                <rect x="1" y="1" width="9" height="9" rx="2" fill="white" />
                <rect x="16" y="1" width="9" height="9" rx="2" fill="white" />
                <rect x="1" y="16" width="9" height="9" rx="2" fill="white" />
                <rect x="16" y="16" width="9" height="9" rx="2" fill="white" />
              </svg>
            </div>
            <p className="font-['Manrope'] font-bold text-[#292d32] text-[13px]">All Agent Connect</p>
            <p className="font-['Manrope'] font-medium text-[#92a2bb] text-[12px] -mt-2">Private agent network</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LEFT_NODES.map((n) => (
              <div key={n.label} className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-full border border-[#2537ff] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#2537ff] shrink-0" />
                <span className="font-['Manrope'] font-semibold text-[#40424d] text-[12px]">{n.label}</span>
              </div>
            ))}
            {RIGHT_NODES.map((n) => (
              <div key={n.label} className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-full border border-[#1bc572] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#1bc572] shrink-0" />
                <span className="font-['Manrope'] font-semibold text-[#40424d] text-[12px]">{n.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResultsHub;
