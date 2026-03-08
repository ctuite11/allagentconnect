import React from "react";
import { cn } from "@/lib/utils";

interface CardSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function CardSurface({ className, interactive, ...props }: CardSurfaceProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden",
        interactive && "will-change-transform transition-all duration-200 hover:shadow-lg hover:-translate-y-[1px] focus-within:shadow-lg",
        className
      )}
      {...props}
    />
  );
}
