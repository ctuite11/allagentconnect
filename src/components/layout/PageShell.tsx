import React from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * AAC page wrapper (agent shell content):
 * - consistent horizontal gutters + vertical padding
 * - no min-h-screen (avoids extra scroll / gray bands in AppShell)
 * - default white canvas; callers may override via className
 */
export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main className={cn("bg-[#FFFFFF] pt-6 px-6 pb-6", className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}

export default PageShell;
