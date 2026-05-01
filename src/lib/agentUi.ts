/**
 * Agent AAC UI — same visual language as `buyerUi` for pages inside `AppShell`.
 * Use these instead of ad-hoc zinc classes so agent surfaces match Buyer Dashboard / Hot Sheets / Messages.
 */

export {
  buyerPageMain,
  buyerPageStack,
  buyerSectionCard as agentSectionCard,
  buyerPreviewCardInteractive as agentPreviewCard,
  buyerSectionTitle as agentSectionTitle,
  buyerSectionDesc as agentSectionDesc,
  buyerPrimaryCta as agentPrimaryCta,
  buyerOutlineSecondary as agentOutlineSecondary,
} from "./buyerUi";

/** Page title — matches buyer dashboard / Hot Sheets hero title scale */
export const agentPageTitleClass =
  "text-2xl font-semibold tracking-tight text-neutral-900";

/** Subtitle under page title */
export const agentPageSubtitleClass =
  "text-sm leading-snug text-neutral-500";
