import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  agentPageBackNavSpacingClass,
  agentPageIntroSpacingClass,
  agentPageSubtitleClass,
  agentPageTitleClass,
  agentPageTopPaddingClass,
} from "@/lib/agentUi";

export type AacPageIntroProps = {
  /** Typically `<AacBackLink />` or `<AacBackButton />`. */
  back?: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  /** Include standard top inset (use on first block in page shell). Default true. */
  withTopPadding?: boolean;
};

/**
 * Standard AAC page chrome: top inset → Back → title → subtitle.
 *
 * Spacing (agentUi tokens):
 * - `pt-5` — page top inset below app header
 * - `mb-4` — Back → title
 * - `space-y-1` — title → subtitle
 * - `mb-5 md:mb-6` — intro block → page content
 */
export function AacPageIntro({
  back,
  title,
  subtitle,
  actions,
  className,
  titleClassName,
  withTopPadding = true,
}: AacPageIntroProps) {
  const hasTitleBlock = Boolean(title || subtitle);

  return (
    <header
      className={cn(
        agentPageIntroSpacingClass,
        withTopPadding && agentPageTopPaddingClass,
        className,
      )}
    >
      {back ? <div className={agentPageBackNavSpacingClass}>{back}</div> : null}
      {(hasTitleBlock || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {hasTitleBlock ? (
            <div className="min-w-0 space-y-1">
              {title ? (
                <h1 className={cn(agentPageTitleClass, titleClassName)}>{title}</h1>
              ) : null}
              {subtitle ? <p className={agentPageSubtitleClass}>{subtitle}</p> : null}
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
