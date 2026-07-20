import type { ReactNode } from "react";
import { useAgentContentShellInset } from "@/components/layout/AgentContentInsetContext";
import { cn } from "@/lib/utils";
import {
  agentPageBackNavSpacingClass,
  agentPageIntroSpacingClass,
  agentPageSubtitleClass,
  agentPageTitleClass,
  agentPageTopPaddingClass,
} from "@/lib/agentUi";
import { AacTitleAccent } from "@/components/layout/AacTitleAccent";

export type AacPageIntroProps = {
  /** Typically `<AacBackLink />` or `<AacBackButton />`. */
  back?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Rendered directly under the subtitle (e.g. primary page CTA). */
  afterSubtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  /** Include standard top inset (use on first block in page shell). Default true. */
  withTopPadding?: boolean;
  /** Hide the emerald accent bar beneath the title. */
  hideTitleAccent?: boolean;
};

/**
 * Standard AAC page chrome: top inset → Back → title → subtitle.
 *
 * Spacing (agentUi tokens):
 * - `pt-8` — page top inset below app chrome (matches former `buyerPageMain` top rhythm)
 * - `mb-4` — Back → title
 * - `space-y-1` — title → subtitle
 * - `mb-5 md:mb-6` — intro block → page content
 */
export function AacPageIntro({
  back,
  title,
  subtitle,
  afterSubtitle,
  actions,
  className,
  titleClassName,
  withTopPadding = true,
  hideTitleAccent = false,
}: AacPageIntroProps) {
  const shellProvidesTopInset = useAgentContentShellInset();
  const hasTitleBlock = Boolean(title || subtitle);
  const applyIntroTopPadding = withTopPadding && !shellProvidesTopInset;

  return (
    <header
      className={cn(
        agentPageIntroSpacingClass,
        className,
        applyIntroTopPadding && agentPageTopPaddingClass,
      )}
    >
      {back ? <div className={agentPageBackNavSpacingClass}>{back}</div> : null}
      {(hasTitleBlock || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {hasTitleBlock ? (
            <div className="min-w-0 space-y-1">
              {title ? (
                <>
                  <h1 className={cn(agentPageTitleClass, titleClassName)}>{title}</h1>
                  {hideTitleAccent ? null : <AacTitleAccent />}
                </>
              ) : null}
              {subtitle ? <p className={agentPageSubtitleClass}>{subtitle}</p> : null}
              {afterSubtitle ? <div className="pt-3">{afterSubtitle}</div> : null}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-0.5">{actions}</div>
          ) : null}
        </div>
      )}
    </header>
  );
}
