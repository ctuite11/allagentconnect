import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { aacBackLinkClass } from "@/components/layout/AacBackLink";
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
    <div className={cn("mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4", className)}>
      <div className="min-w-0 space-y-1">
        {backTo ? (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className={cn(aacBackLinkClass, "-ml-1 mb-0.5")}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            Back
          </button>
        ) : null}
        <h1 className={agentPageTitleClass}>{title}</h1>
        {subtitle ? <p className={agentPageSubtitleClass}>{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-0.5">{actions}</div>
      ) : null}
    </div>
  );
}
