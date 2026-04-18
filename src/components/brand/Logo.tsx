import React from "react";
import AACMonogram from "@/components/ui/AACMonogram";

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

// Primary brand colors
const ACC_BLUE = "#0E56F5"; // Royal Blue - Brand primary
const CONNECT_GREEN = "#16A34A"; // Wordmark "Connect" color

export const Logo: React.FC<LogoProps> = ({
  variant = "primary",
  className = "",
  size = "md",
}) => {
  const isIcon = variant === "icon";

  if (isIcon) {
    // Icon-only mark — APPROVED command-style AAC monogram (canonical)
    // The legacy house-mark has been deprecated and archived.
    return (
      <AACMonogram
        className={`${sizeClasses[size]} w-auto ${className}`}
        // AACMonogram uses currentColor; wrap with brand color
        // eslint-disable-next-line react/forbid-dom-props
        // @ts-expect-error style allowed at runtime
        style={{ color: ACC_BLUE }}
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
      <text
        x="0"
        y="32"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.01em"
      >
        <tspan fill={ACC_BLUE}>All Agent </tspan>
        <tspan fill={CONNECT_GREEN}>Connect</tspan>
      </text>
    </svg>
  );
};

// Email-safe version using inline styles (no external fonts required) - text only
export const LogoEmailSafe: React.FC<{ reversed?: boolean }> = ({ reversed = false }) => {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "20px",
        fontWeight: 700,
        letterSpacing: "-0.01em",
      }}
    >
      <span style={{ color: ACC_BLUE }}>All </span>
      <span style={{ color: ACC_BLUE }}>Agent </span>
      <span style={{ color: "#16A34A" }}>Connect</span>
    </p>
  );
};

export default Logo;
