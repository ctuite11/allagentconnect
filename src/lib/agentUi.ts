/**
 * Agent AAC UI — same visual language as `buyerUi` for pages inside `AppShell`.
 * Use these instead of ad-hoc zinc classes so agent surfaces match Buyer Dashboard / Hot Sheets / Messages.
 */

export {
  buyerPageMain,
  buyerPageStack,
  buyerPreviewCardInteractive as agentPreviewCard,
  buyerSectionTitle as agentSectionTitle,
  buyerSectionDesc as agentSectionDesc,
  buyerPrimaryCta as agentPrimaryCta,
  buyerOutlineSecondary as agentOutlineSecondary,
} from "./buyerUi";

/** Section surface on agent AAC pages: white canvas, hairline border, no shadow */
export const agentSectionCard =
  "bg-white rounded-2xl border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] duration-150 hover:border-zinc-300/90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]";

/** Page title — compact AAC tool-first scale */
export const agentPageTitleClass =
  "text-xl font-semibold tracking-tight text-zinc-900";

/** Subtitle under page title */
export const agentPageSubtitleClass =
  "text-sm leading-snug text-neutral-500";

export { aacBackLinkClass, aacBackIconButtonClass } from "@/components/layout/AacBackLink";
