import React from "react";
import logoHouseLeaf from "@/assets/aac-logo-house-leaf.png";

interface LogoProps {
  variant?: "primary" | "reversed" | "icon" | "email";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-10",
  xl: "h-12",
};

// Primary colors - LOGO ASSET COLORS
const ACC_BLUE = "#0E56F5"; // Royal Blue - Brand primary
const SLATE_400 = "#94A3B8"; // Matches "Connect" text color

export const Logo: React.FC<LogoProps> = ({ 
  variant = "primary", 
  className = "",
  size = "md"
}) => {
  const isIcon = variant === "icon";

  if (isIcon) {
    return (
      <img
        src={logoHouseLeaf}
        alt="All Agent Connect"
        className={`${sizeClasses[size]} w-auto ${className}`}
      />
    );
  }

  // Full wordmark logo (icon + text)
  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label="All Agent Connect">
      <img
        src={logoHouseLeaf}
        alt=""
        className={sizeClasses[size]}
      />
      <span className="font-semibold text-lg tracking-tight whitespace-nowrap">
        <span style={{ color: ACC_BLUE }}>All Agent </span>
        <span style={{ color: SLATE_400 }}>Connect</span>
      </span>
    </div>
  );
};

// Email-safe version using inline styles (no external fonts required)
export const LogoEmailSafe: React.FC<{ reversed?: boolean }> = ({ reversed = false }) => {
  const accentColor = ACC_BLUE;
  
  return (
    <table cellPadding="0" cellSpacing="0" border={0} style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
            <img
              src="https://allagentconnect.com/brand/aac-logo-house-leaf.png"
              alt="All Agent Connect"
              width="32"
              height="32"
              style={{ display: 'block' }}
            />
          </td>
          <td style={{ 
            verticalAlign: 'middle',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.01em'
          }}>
            <span style={{ color: accentColor }}>All Agent </span>
            <span style={{ color: '#94A3B8' }}>Connect</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default Logo;
