import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { aacBackLinkClass } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { AacTitleAccent } from "@/components/layout/AacTitleAccent";
import {
  agentPageIntroSpacingClass,
  agentPageSubtitleClass,
  agentPageTitleClass,
} from "@/lib/agentUi";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional class names for the `<h1>` title (e.g. AAC premium scale) */
  titleClassName?: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Optional class names for the subtitle paragraph */
  subtitleClassName?: string;
  /**
   * Explicit parent route to navigate to on back click.
   * If provided, shows Back control above the title (canonical AAC intro stack).
   */
  backTo?: string;
  /** Optional className for container */
  className?: string;
  /** Optional right-side actions */
  actions?: ReactNode;
  /** Optional className for the actions container */
  actionsClassName?: string;
  /** Optional icon to display before title (title-only layout; not combined with back) */
  icon?: ReactNode;
  /** @deprecated Back is always above the title when `backTo` is set. */
  compactBack?: boolean;
  /** Standard top inset when this is the first block in the page shell. */
  withTopPadding?: boolean;
}

/**
 * Page header — delegates to {@link AacPageIntro} when `backTo` is set.
 */
export function PageHeader({
  title,
  titleClassName,
  subtitle,
  subtitleClassName,
  backTo,
  className,
  actions,
  actionsClassName,
  icon,
  withTopPadding = false,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  if (backTo) {
    return (
      <AacPageIntro
        withTopPadding={withTopPadding}
        className={className}
        title={title}
        subtitle={subtitle}
        titleClassName={titleClassName}
        actions={actions}
        back={
          <button type="button" onClick={handleBack} className={aacBackLinkClass} aria-label="Go back">
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            Back
          </button>
        }
      />
    );
  }

  return (
    <header className={cn(agentPageIntroSpacingClass, className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h1
            className={cn(
              agentPageTitleClass,
              titleClassName,
              icon && "flex items-center gap-3",
            )}
          >
            {icon}
            {title}
          </h1>
          <AacTitleAccent />
          {subtitle ? (
            <p className={cn(agentPageSubtitleClass, subtitleClassName)}>{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-0.5">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
