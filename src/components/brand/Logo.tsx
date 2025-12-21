import React from "react";

interface LogoProps {
  variant?: "primary" | "reversed" | "icon" | "email";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
  xl: "h-14",
};

// Primary colors
const SLATE_900 = "#0F172A";
const EMERALD_700 = "#047857";
const WHITE = "#FFFFFF";

export const Logo: React.FC<LogoProps> = ({ 
  variant = "primary", 
  className = "",
  size = "md"
}) => {
  const isReversed = variant === "reversed";
  const isIcon = variant === "icon";
  const primaryColor = isReversed ? WHITE : SLATE_900;
  const accentColor = EMERALD_700;

  if (isIcon) {
    // Icon-only mark - stylized "AAC" monogram
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${sizeClasses[size]} ${className}`}
        aria-label="AllAgentConnect"
      >
        {/* Outer ring */}
        <circle
          cx="24"
          cy="24"
          r="22"
          stroke={primaryColor}
          strokeWidth="2"
          fill="none"
        />
        {/* Inner connection nodes */}
        <circle cx="24" cy="12" r="3" fill={primaryColor} />
        <circle cx="12" cy="32" r="3" fill={primaryColor} />
        <circle cx="36" cy="32" r="3" fill={primaryColor} />
        {/* Connection lines */}
        <path
          d="M24 15 L14 30 M24 15 L34 30 M14 32 L34 32"
          stroke={primaryColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Center accent dot */}
        <circle cx="24" cy="26" r="2" fill={accentColor} />
      </svg>
    );
  }

  // Full wordmark logo
  return (
    <svg
      viewBox="0 0 280 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeClasses[size]} w-auto ${className}`}
      aria-label="AllAgentConnect"
    >
      {/* Icon mark */}
      <g>
        <circle
          cx="24"
          cy="24"
          r="22"
          stroke={primaryColor}
          strokeWidth="2"
          fill="none"
        />
        <circle cx="24" cy="12" r="3" fill={primaryColor} />
        <circle cx="12" cy="32" r="3" fill={primaryColor} />
        <circle cx="36" cy="32" r="3" fill={primaryColor} />
        <path
          d="M24 15 L14 30 M24 15 L34 30 M14 32 L34 32"
          stroke={primaryColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="24" cy="26" r="2" fill={accentColor} />
      </g>
      
      {/* Wordmark - "All Agent Connect" */}
      <text
        x="56"
        y="32"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.01em"
      >
        <tspan fill={primaryColor}>All</tspan>
        <tspan fill={accentColor}>Agent</tspan>
        <tspan fill={primaryColor}>Connect</tspan>
      </text>
    </svg>
  );
};

// Email-safe version using inline styles (no external fonts required)
export const LogoEmailSafe: React.FC<{ reversed?: boolean }> = ({ reversed = false }) => {
  const primaryColor = reversed ? WHITE : SLATE_900;
  const accentColor = EMERALD_700;
  
  return (
    <table cellPadding="0" cellSpacing="0" border={0} style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
            {/* Simple icon for email - using basic shapes */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="24"
                cy="24"
                r="22"
                stroke={primaryColor}
                strokeWidth="2"
                fill="none"
              />
              <circle cx="24" cy="12" r="3" fill={primaryColor} />
              <circle cx="12" cy="32" r="3" fill={primaryColor} />
              <circle cx="36" cy="32" r="3" fill={primaryColor} />
              <path
                d="M24 15 L14 30 M24 15 L34 30 M14 32 L34 32"
                stroke={primaryColor}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="24" cy="26" r="2" fill={accentColor} />
            </svg>
          </td>
          <td style={{ 
            verticalAlign: 'middle',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.01em'
          }}>
            <span style={{ color: primaryColor }}>All</span>
            <span style={{ color: accentColor }}>Agent</span>
            <span style={{ color: primaryColor }}>Connect</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default Logo;
