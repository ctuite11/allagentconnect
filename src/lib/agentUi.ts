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
  "bg-white rounded-2xl border border-zinc-100 shadow-none transition-colors duration-150";

/** Page title — compact AAC tool-first scale */
export const agentPageTitleClass =
  "text-xl font-semibold tracking-tight text-zinc-900";

/** Subtitle under page title */
export const agentPageSubtitleClass =
  "text-sm leading-snug text-neutral-500";
