import * as React from "react";
import { cn } from "@/lib/utils";

export type PillVariant = "primary" | "neutral" | "success" | "warning" | "danger" | "outline";
export type PillSize = "sm" | "md";

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
    default: "bg-primary-soft text-primary",
    active: "bg-primary text-primary-foreground",
    disabled: "bg-neutral-soft text-neutral-text cursor-not-allowed opacity-70",
  },
  neutral: {
    default: "bg-neutral-soft text-neutral-text",
    active: "bg-muted text-foreground",
    disabled: "bg-neutral-soft text-neutral-text cursor-not-allowed opacity-70",
  },
  success: {
    default: "bg-success-soft text-neon-green",
    active: "bg-neon-green text-primary-foreground",
    disabled: "bg-neutral-soft text-neutral-text cursor-not-allowed opacity-70",
  },
  warning: {
    default: "bg-warning-soft text-warning",
    active: "bg-warning text-warning-foreground",
    disabled: "bg-neutral-soft text-neutral-text cursor-not-allowed opacity-70",
  },
  danger: {
    default: "bg-danger-soft text-destructive",
    active: "bg-destructive text-destructive-foreground",
    disabled: "bg-neutral-soft text-neutral-text cursor-not-allowed opacity-70",
  },
  outline: {
    default: "bg-transparent border border-primary text-primary hover:bg-primary-soft",
    active: "bg-primary text-primary-foreground border border-primary",
    disabled: "bg-transparent border border-neutral-soft text-neutral-text cursor-not-allowed opacity-70",
  },
};

const hoverStyles: Record<PillVariant, string> = {
  primary: "hover:brightness-105",
  neutral: "hover:bg-muted",
  success: "hover:brightness-105",
  warning: "hover:brightness-105",
  danger: "hover:brightness-105",
  outline: "",
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
      "inline-flex items-center justify-center gap-1.5 rounded-full font-medium leading-tight transition-colors duration-150";

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
          {iconLeft && <span className="flex items-center">{iconLeft}</span>}
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
        {iconLeft && <span className="flex items-center">{iconLeft}</span>}
        <span>{label}</span>
      </span>
    );
  }
);

Pill.displayName = "Pill";
