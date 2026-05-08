import React from "react";
import { cn } from "@/lib/utils";

interface CardSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function CardSurface({ className, interactive, ...props }: CardSurfaceProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-[1px] hover:border-zinc-300/90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-within:border-zinc-300/90",
        className
      )}
      {...props}
    />
  );
}
