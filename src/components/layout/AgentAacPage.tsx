import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buyerPageMain, buyerPageStack } from "@/lib/buyerUi";

type AgentAacPageProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Centered max-width column + vertical rhythm between sections (same as buyer `main` + stack).
 * Use under `AppShell` instead of `PageShell` for AAC agent pages that should match buyer pages.
 */
export function AgentAacPage({ children, className }: AgentAacPageProps) {
  return (
    <main className={cn(buyerPageMain, buyerPageStack, className)}>
      {children}
    </main>
  );
}
