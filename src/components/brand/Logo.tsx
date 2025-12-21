import React from "react";

interface LogoProps {
  variant?: "primary" | "reversed" | "icon" | "email";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
  xl: "h-12",
};

// Primary colors
const SLATE_900 = "#0F172A";
const SLATE_400 = "#94A3B8";
const EMERALD_500 = "#10B981";
const WHITE = "#FFFFFF";

export const Logo: React.FC<LogoProps> = ({ 
  variant = "primary", 
  className = "",
  size = "md"
}) => {
  const isReversed = variant === "reversed";
  const isIcon = variant === "icon";
  const primaryColor = isReversed ? WHITE : SLATE_900;
  const secondaryColor = isReversed ? WHITE : SLATE_400;
  const accentColor = EMERALD_500;

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
      
      {/* Wordmark - "AllAgent" + "Connect" in silvery */}
      <text
        x="56"
        y="32"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.01em"
        fill={primaryColor}
      >
        AllAgent
      </text>
      <text
        x="145"
        y="32"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.01em"
        fill={secondaryColor}
      >
        Connect
      </text>
    </svg>
  );
};

// Email-safe version using inline styles (no external fonts required)
export const LogoEmailSafe: React.FC<{ reversed?: boolean }> = ({ reversed = false }) => {
  const primaryColor = reversed ? WHITE : SLATE_900;
  const accentColor = EMERALD_500;
  
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
            color: primaryColor,
            letterSpacing: '-0.01em'
          }}>
            AllAgentConnect
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default Logo;
