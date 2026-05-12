import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buyerPageMain, buyerPageStack } from "@/lib/buyerUi";

type AgentAacPageProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
};

/**
 * Centered max-width column + vertical rhythm between sections (same as buyer `main` + stack).
 * Use under `AppShell` instead of `PageShell` for AAC agent pages that should match buyer pages.
 */
export function AgentAacPage({ children, className, ...rest }: AgentAacPageProps) {
  return (
    <main className={cn(buyerPageMain, buyerPageStack, "bg-white", className)} {...rest}>
      {children}
    </main>
  );
}
