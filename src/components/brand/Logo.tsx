import React from "react";

interface LogoProps {
  variant?: "primary" | "reversed" | "icon" | "email";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
  xl: "h-14",
  "2xl": "h-16",
  "3xl": "h-20",
};

// Primary colors - LOGO ASSET COLORS
const SLATE_900 = "#0F172A";
const ACC_BLUE = "#0E56F5"; // Royal Blue - Brand primary
const WHITE = "#FFFFFF";
const SLATE_400 = "#94A3B8"; // Matches "Connect" text color

export const Logo: React.FC<LogoProps> = ({ 
  variant = "primary", 
  className = "",
  size = "md"
}) => {
  const isReversed = variant === "reversed";
  const isIcon = variant === "icon";
  const primaryColor = isReversed ? WHITE : SLATE_900;
  const accentColor = ACC_BLUE; // Logo uses brand Royal Blue

  if (isIcon) {
    // Icon-only mark - stylized "AAC" monogram
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${sizeClasses[size]} ${className}`}
        aria-label="All Agent Connect"
      >
        {/* Outer ring */}
        <circle
          cx="24"
          cy="24"
          r="22"
          stroke={SLATE_900}
          strokeWidth="2"
          fill="none"
        />
        {/* Inner connection nodes */}
        <circle cx="24" cy="12" r="3" fill={accentColor} />
        <circle cx="12" cy="32" r="3" fill={accentColor} />
        <circle cx="36" cy="32" r="3" fill={accentColor} />
        {/* Connection lines */}
        <path
          d="M24 15 L14 30 M24 15 L34 30 M14 32 L34 32"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Center accent dot */}
        <circle cx="24" cy="26" r="2" fill={accentColor} />
      </svg>
    );
  }

  // Full wordmark logo - text only
  return (
    <svg
      viewBox="0 0 220 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeClasses[size]} w-auto ${className}`}
      aria-label="All Agent Connect"
    >
      {/* Wordmark - "All Agent Connect" */}
      <text
        x="0"
        y="32"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.01em"
      >
        <tspan fill={accentColor}>All Agent </tspan>
        <tspan fill={SLATE_400}>Connect</tspan>
      </text>
    </svg>
  );
};

// Email-safe version using inline styles (no external fonts required) - text only
export const LogoEmailSafe: React.FC<{ reversed?: boolean }> = ({ reversed = false }) => {
  const accentColor = ACC_BLUE; // Logo uses brand Royal Blue
  
  return (
    <p style={{ 
      margin: 0,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em'
    }}>
      <span style={{ color: accentColor }}>All </span>
      <span style={{ color: accentColor }}>Agent </span>
      <span style={{ color: '#94A3B8' }}>Connect</span>
    </p>
  );
};

export default Logo;
