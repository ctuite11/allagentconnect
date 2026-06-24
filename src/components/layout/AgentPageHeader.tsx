import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { aacBackLinkClass } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { agentPageSubtitleClass, agentPageTitleClass } from "@/lib/agentUi";
import { cn } from "@/lib/utils";

export type AgentPageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Subtle emerald underline beneath the title (AAC accent). */
  titleAccent?: "underline";
  /** When set, shows standard Back control above the title. */
  backTo?: string;
  actions?: ReactNode;
  className?: string;
  /** Pass false when parent shell already applied top padding. */
  withTopPadding?: boolean;
};

/**
 * Title + subtitle rhythm aligned with buyer dashboard / Hot Sheets.
 * When `backTo` is set, uses {@link AacPageIntro} spacing (Back → title → content).
 */
export function AgentPageHeader({
  title,
  subtitle,
  titleAccent,
  backTo,
  actions,
  className,
  withTopPadding = false,
}: AgentPageHeaderProps) {
  const navigate = useNavigate();

  if (backTo) {
    return (
      <AacPageIntro
        withTopPadding={withTopPadding}
        className={className}
        title={title}
        subtitle={subtitle}
        actions={actions}
        back={
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className={aacBackLinkClass}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            Back
          </button>
        }
      />
    );
  }

  return (
    <header className={cn("mb-5 md:mb-6", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className={agentPageTitleClass}>{title}</h1>
          {titleAccent === "underline" ? (
            <div className="h-0.5 w-10 rounded-full bg-emerald-600/75" aria-hidden />
          ) : null}
          {subtitle ? <p className={agentPageSubtitleClass}>{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-0.5">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
