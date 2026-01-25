import React from "react";
import aacLogoMaster from "@/assets/aac-logo-master.svg";

interface LogoProps {
  variant?: "primary" | "reversed" | "icon" | "email";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
}

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
  xl: "h-14",
  "2xl": "h-16",
  "3xl": "h-20",
  "4xl": "h-24",
  "5xl": "h-28",
};

// Primary colors - LOGO ASSET COLORS
const SLATE_900 = "#0F172A";
const ACC_BLUE = "#0E56F5"; // Royal Blue - Brand primary
const WHITE = "#FFFFFF";
const ZINC_500 = "#6B7280"; // Wordmark "Connect" color - refined gray

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
    // Icon-only mark - AAC house monogram (SVG with locked colors)
    return (
      <img
        src={aacLogoMaster}
        alt="All Agent Connect"
        className={`${sizeClasses[size]} w-auto ${className}`}
      />
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
        <tspan fill={ZINC_500}>Connect</tspan>
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
      <span style={{ color: '#6B7280' }}>Connect</span>
    </p>
  );
};

export default Logo;
