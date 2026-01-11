import React from "react";
import { cn } from "@/lib/utils";

interface CardSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function CardSurface({ className, interactive, ...props }: CardSurfaceProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-zinc-200 shadow-md overflow-hidden",
        interactive && "transition-shadow hover:shadow-lg focus-within:shadow-lg",
        className
      )}
      {...props}
    />
  );
}
