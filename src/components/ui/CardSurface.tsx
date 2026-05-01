import React from "react";
import { cn } from "@/lib/utils";

interface CardSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function CardSurface({ className, interactive, ...props }: CardSurfaceProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-none",
        interactive &&
          "transition-colors duration-200 hover:border-zinc-200 focus-within:border-zinc-200",
        className
      )}
      {...props}
    />
  );
}
