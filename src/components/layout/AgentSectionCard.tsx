import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { agentSectionCard } from "@/lib/agentUi";

type AgentSectionCardProps = HTMLAttributes<HTMLDivElement>;

/** Section surface matching buyer `buyerSectionCard` (white, neutral border, light shadow). */
export function AgentSectionCard({ className, ...props }: AgentSectionCardProps) {
  return <div className={cn(agentSectionCard, className)} {...props} />;
}
