/**
 * Layout tokens for agent map/results workspace pages inside AppShell.
 * Full-width (no max-w cap) so collapsed sidebar space flows into map + results.
 */

/** Page shell: use full AppShell main column width. */
export const agentWorkspacePageContainer = "mx-auto w-full min-w-0 px-4 sm:px-5 lg:px-6";

/**
 * Desktop map + results split. Map column (first) gets a larger flex share (1.1 : 0.9).
 * Height tuned for AppShell + workspace page intro/toolbars.
 */
export const agentWorkspaceMapResultsGrid =
  "mt-3 flex h-auto min-h-0 flex-col-reverse gap-3 sm:mt-4 sm:gap-4 lg:grid lg:h-[calc(100dvh-7.25rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:flex-none";

/** Slightly taller chrome offset (e.g. hot sheet review with extra header rows). */
export const agentWorkspaceMapResultsGridTall =
  "mt-3 flex h-auto min-h-0 flex-col-reverse gap-3 sm:mt-4 sm:gap-4 lg:grid lg:h-[calc(100dvh-7.8rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:flex-none";

/** Same as tall grid but flush to the workspace summary row above (no top margin). */
export const agentWorkspaceMapResultsGridTallFlush =
  "flex h-auto min-h-0 flex-col-reverse gap-3 sm:gap-4 lg:grid lg:h-[calc(100dvh-7.8rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:flex-none";

/** Compact header — hot sheet review workspace (minimal chrome above map). */
export const agentWorkspaceMapResultsGridCompact =
  "flex h-auto min-h-0 flex-col-reverse gap-2 sm:gap-3 lg:grid lg:h-[calc(100dvh-8.75rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:flex-none";

export const agentWorkspaceMapPanel =
  "h-[48dvh] min-h-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:h-[52dvh] lg:sticky lg:top-[5.5rem] lg:h-full lg:min-h-0 lg:self-start";

export const agentWorkspaceResultsPanel =
  "flex h-auto min-h-0 max-lg:min-h-[48vh] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:h-full lg:min-h-0";
