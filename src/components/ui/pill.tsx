import * as React from "react";
import { cn } from "@/lib/utils";

type PillVariant = "primary" | "neutral" | "success" | "warning" | "danger" | "outline";
type PillSize = "sm" | "md";

interface PillProps {
  label: string;
  variant?: PillVariant;
  active?: boolean;
  disabled?: boolean;
  size?: PillSize;
  iconLeft?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const variantStyles: Record<PillVariant, { default: string; active: string; disabled: string }> = {
  primary: {
    default: "bg-primary/10 text-primary",
    active: "bg-primary text-primary-foreground",
    disabled: "bg-muted text-muted-foreground cursor-not-allowed opacity-70",
  },
  neutral: {
    default: "bg-muted text-muted-foreground",
    active: "bg-muted/60 text-foreground",
    disabled: "bg-muted text-muted-foreground cursor-not-allowed opacity-70",
  },
  success: {
    default: "bg-accent/10 text-accent",
    active: "bg-accent text-accent-foreground",
    disabled: "bg-muted text-muted-foreground cursor-not-allowed opacity-70",
  },
  warning: {
    default: "bg-warning/12 text-warning",
    active: "bg-warning text-warning-foreground",
    disabled: "bg-muted text-muted-foreground cursor-not-allowed opacity-70",
  },
  danger: {
    default: "bg-destructive/10 text-destructive",
    active: "bg-destructive text-destructive-foreground",
    disabled: "bg-muted text-muted-foreground cursor-not-allowed opacity-70",
  },
  outline: {
    default: "bg-transparent border border-primary text-primary",
    active: "bg-primary/10 border border-primary text-primary",
    disabled: "bg-transparent border border-muted text-muted-foreground cursor-not-allowed opacity-70",
  },
};

const hoverStyles: Record<PillVariant, string> = {
  primary: "hover:bg-primary/16",
  neutral: "hover:bg-muted/80",
  success: "hover:bg-accent/17",
  warning: "hover:bg-warning/20",
  danger: "hover:bg-destructive/17",
  outline: "hover:bg-primary/5",
};

const sizeStyles: Record<PillSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-[13px]",
};

export const Pill = React.forwardRef<HTMLButtonElement, PillProps>(
  (
    {
      label,
      variant = "primary",
      active = false,
      disabled = false,
      size = "md",
      iconLeft,
      onClick,
      className,
    },
    ref
  ) => {
    const isClickable = !!onClick && !disabled;

    const getStateStyle = () => {
      if (disabled) return variantStyles[variant].disabled;
      if (active) return variantStyles[variant].active;
      return variantStyles[variant].default;
    };

    const baseStyles =
      "inline-flex items-center gap-1.5 rounded-full font-medium leading-tight transition-colors";

    const focusStyles = isClickable
      ? "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1"
      : "";

    if (isClickable) {
      return (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            baseStyles,
            sizeStyles[size],
            getStateStyle(),
            !disabled && hoverStyles[variant],
            focusStyles,
            className
          )}
        >
          {iconLeft && <span className="flex-shrink-0">{iconLeft}</span>}
          <span>{label}</span>
        </button>
      );
    }

    return (
      <span
        className={cn(
          baseStyles,
          sizeStyles[size],
          getStateStyle(),
          className
        )}
      >
        {iconLeft && <span className="flex-shrink-0">{iconLeft}</span>}
        <span>{label}</span>
      </span>
    );
  }
);

Pill.displayName = "Pill";
