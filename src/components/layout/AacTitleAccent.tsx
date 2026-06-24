import { aacTitleAccentBarClass } from "@/lib/agentUi";
import { cn } from "@/lib/utils";

/** Subtle emerald bar beneath AAC page and modal titles. */
export function AacTitleAccent({ className }: { className?: string }) {
  return <div className={cn(aacTitleAccentBarClass, className)} aria-hidden />;
}
