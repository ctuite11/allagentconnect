import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { agentPreviewCard } from "@/lib/agentUi";

type AgentPreviewCardProps = HTMLAttributes<HTMLDivElement>;

/** Interactive preview tile — same as buyer preview card (border, subtle hover). */
export function AgentPreviewCard({ className, ...props }: AgentPreviewCardProps) {
  return <div className={cn(agentPreviewCard, className)} {...props} />;
}
