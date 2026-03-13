import React from "react";

interface AACMonogramProps {
  size?: number;
  className?: string;
}

/**
 * AAC brand monogram — network graph icon.
 * Uses currentColor so the parent controls the color via Tailwind / CSS.
 */
export default function AACMonogram({ size = 64, className = "" }: AACMonogramProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter id="aacNodeGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#aacNodeGlow)">
        {/* Outer square edges */}
        <line x1="11" y1="11" x2="33" y2="11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="11" y1="33" x2="33" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="11" y1="11" x2="11" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="33" y1="11" x2="33" y2="33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Center spokes */}
        <line x1="22" y1="22" x2="11" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.65" />
        <line x1="22" y1="22" x2="33" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.65" />
        <line x1="22" y1="22" x2="11" y2="33" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.65" />
        <line x1="22" y1="22" x2="33" y2="33" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.65" />
        {/* Corner nodes */}
        <circle cx="11" cy="11" r="4.5" fill="currentColor" />
        <circle cx="33" cy="11" r="4.5" fill="currentColor" />
        <circle cx="11" cy="33" r="4.5" fill="currentColor" />
        <circle cx="33" cy="33" r="4.5" fill="currentColor" />
        {/* Center hub node */}
        <circle cx="22" cy="22" r="5.5" fill="currentColor" />
      </g>
    </svg>
  );
}
