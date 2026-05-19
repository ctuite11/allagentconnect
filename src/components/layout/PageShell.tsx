import React from "react";
import { useAgentContentShellInset } from "@/components/layout/AgentContentInsetContext";
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
  const shellProvidesTopInset = useAgentContentShellInset();

  return (
    <main className={cn("bg-[#FFFFFF] px-6 pb-6", !shellProvidesTopInset && "pt-6", className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}

export default PageShell;
