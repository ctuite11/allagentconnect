import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentPageSubtitleClass, agentPageTitleClass } from "@/lib/agentUi";

export type AgentPageHeaderProps = {
  title: string;
  subtitle?: string;
  /** When set, shows a buyer-style back control (Hot Sheets / Messages pattern) */
  backTo?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Title + subtitle rhythm aligned with buyer dashboard / Hot Sheets (not the larger `PageHeader` scale).
 */
export function AgentPageHeader({
  title,
  subtitle,
  backTo,
  actions,
  className,
}: AgentPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {backTo ? (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        ) : null}
        <h1 className={agentPageTitleClass}>{title}</h1>
        {subtitle ? <p className={agentPageSubtitleClass}>{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
