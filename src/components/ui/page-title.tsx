import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

/**
 * Centralized page title component enforcing global typography standard.
 * 
 * Standard: text-4xl font-semibold text-neutral-800 font-display
 * 
 * This ensures visual consistency across the entire application
 * matching the Success Hub established design.
 */
export function PageTitle({ children, className, icon }: PageTitleProps) {
  return (
    <h1 className={cn(
      "text-4xl font-semibold text-neutral-800 font-display",
      icon && "flex items-center gap-3",
      className
    )}>
      {icon}
      {children}
    </h1>
  );
}
