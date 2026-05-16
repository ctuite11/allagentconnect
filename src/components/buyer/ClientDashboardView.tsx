/**
 * Shared buyer dashboard presentation — used by `/client/dashboard` and agent BuyerAccount mirror.
 * Same layout/tokens as the buyer-facing dashboard; parents supply data and navigation handlers.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, UserPlus, Mail, MapPin, Bed, Bath, Maximize, UserX, Phone, Flame, Heart, Check, LineChart } from "lucide-react";
import { isDcmlsHost } from "@/lib/host";
import { PendingInvitesCard } from "@/components/PendingInvitesCard";
import FavoriteButton from "@/components/FavoriteButton";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import {
  buyerDashboardHotFavTile as unifiedHotFavCardClass,
  buyerDashboardHotFavTileBody as unifiedHotFavBody,
  buyerDashboardHotSheetMediaWrap as unifiedHotFavMediaWrap,
  buyerMarketListingTileBody as listingPreviewBody,
  buyerMarketListingTileMediaWrap as listingPreviewMediaWrap,
  buyerPreviewCardInteractive as dashboardPreviewTileInteractive,
  buyerPreviewGrid as previewGridClass,
  buyerPreviewSectionContent as previewSectionContentClass,
  buyerPreviewSectionHeader as previewSectionHeaderClass,
  buyerPreviewSectionHeaderRow as previewSectionHeaderRowClass,
  buyerDashboardPreviewViewAllCta as dashboardPreviewViewAllCtaClass,
  buyerPreviewSectionMarketContent as previewSectionMarketContentClass,
  buyerPreviewSectionTitleWrap as previewSectionTitleWrapClass,
  buyerSectionCard as aacCardShell,
  buyerSectionDesc as dashSectionDescClass,
  buyerSectionTitle as dashSectionTitleClass,
  buyerStatCardInteractive as aacCardInteractive,
  buyerTileAddress as dashTileAddressClass,
  buyerTileSecondary as dashTileSecondaryClass,
  buyerTileTitle as dashTileTitleClass,
  buyerPageMain,
  buyerPageShell,
} from "@/lib/buyerUi";
import { DashboardListingImage } from "@/components/buyer/DashboardListingImage";
import { BuyerHotSheetPreviewCard } from "@/components/buyer/BuyerHotSheetPreviewCard";
import {
  resolveListedByAttribution,
  type ListedByAgentProfile,
  type ListedBySource,
} from "@/lib/listingListedBy";
import { formatListingIdLabel, LISTING_ID_NAV_CLASS } from "@/lib/listingIdDisplay";
import { clientDashboardStatIconClass } from "@/lib/navIconColors";

export interface ClientDashboardAgentInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  headshot_url: string | null;
}

export interface ClientDashboardFavoriteRow {
  id: string;
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    price: number;
    bedrooms: number | null;
    bathrooms: number | null;
    photos: unknown;
  };
}

export interface ClientDashboardMarketListing {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: unknown;
  created_at: string;
  listing_number?: string | null;
  agent_id?: string | null;
  agent_profile?: ListedByAgentProfile;
}

export interface ClientDashboardHotSheet {
  id: string;
  name: string;
  criteria: Record<string, unknown> | null;
  created_at: string;
  last_sent_at?: string | null;
  is_active: boolean;
  user_id?: string | null;
}

export type ClientDashboardVariant = "buyer" | "agent";

export interface ClientDashboardViewProps {
  variant: ClientDashboardVariant;
  navigate: NavigateFunction;
  /** Full name (first + last) for the header title. */
  buyerDisplayName: string;
  /** Logged-in buyer or CRM client email (display; agent mirror uses in-app messaging, not mailto). */
  buyerEmail: string | null;
  /** CRM / mirror — buyer phone line under name (optional). */
  buyerPhoneFmt?: { display: string; telHref: string } | null;
  agent: ClientDashboardAgentInfo | null;
  agentPresenceOnline: boolean;
  agentPhoneFmt: { display: string; telHref: string } | null;
  unreadCount: number;
  stats: Array<{ label: string; value: string; icon: LucideIcon; subtle: string | null }>;
  hotSheets: ClientDashboardHotSheet[];
  hotSheetPreviewPhotosById: Record<string, string[]>;
  hotSheetPreviewMatchCountsById: Record<string, number>;
  favorites: ClientDashboardFavoriteRow[];
  latestListingsPreview: ClientDashboardMarketListing[];
  getHotSheetCardPath: (sheetId: string) => string;
  /** Optional — agent opens thread with buyer instead of generic inbox */
  onMessagesPrimary?: () => void;
  onMessagesIcon?: () => void;
  /** Agent mirror — opens `SingleClientEmailDialog` when the buyer email row is clicked; no mailto. */
  onEmailPrimary?: () => void;
  showBuyerSelfServiceChrome?: boolean;
  setAddFriendOpen?: (open: boolean) => void;
  setShowEndDialog?: (open: boolean) => void;
  topBanner?: ReactNode;
  /** When set (e.g. agent mirror), overrides stat-tile navigation targets. */
  onStatTileNavigate?: (label: string) => void;
  /** Override “View all” / section links while keeping the same UI. */
  dashboardPaths?: {
    hotSheetsViewAll: string;
    favoritesViewAll: string;
    marketSearch: string;
    favoritesEmptySearch: string;
  };
  /** Buyer auth user presence — green dot beside name (e.g. agent mirror). */
  buyerPresenceOnline?: boolean;
  /** Extra outline actions in the header row (e.g. Edit / Remove buyer on agent mirror). */
  mirrorManagementActions?: ReactNode;
  /** CRM `clients.id` for agent mirror — used for favorites deep links and mirror-only copy. */
  crmBuyerId?: string | null;
  /** Buyer self-service — opens parent delete confirmation (ignored for agent variant). */
  onRequestDeleteHotSheet?: (sheetId: string) => void;
}

const buyerHeaderSoftBtn =
  "h-8 rounded-full border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50/90 sm:h-9 sm:px-4";

/** Success Hub agent mirror — same typographic hierarchy as buyer (neutral headings). */
const agentMirrorHeroShell = "rounded-2xl border-0 bg-white p-4 shadow-none md:p-5 lg:p-6";
const agentMirrorSectionTitle = "text-[15px] font-semibold text-neutral-950";
const agentMirrorHeaderIcon = "text-neutral-400";
const agentMirrorStatValue =
  "mt-2 text-lg font-semibold tracking-tight text-neutral-900 tabular-nums sm:text-xl";

function getPrimaryPhotoUrl(photos: unknown): string {
  if (!photos) return "/placeholder.svg";

  const normalize = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [trimmed];
    }
    return [];
  };

  const normalizedPhotos = normalize(photos);
  const firstPhoto = normalizedPhotos[0];

  if (typeof firstPhoto === "string" && firstPhoto.trim()) return firstPhoto;
  if (
    firstPhoto &&
    typeof firstPhoto === "object" &&
    "url" in firstPhoto &&
    typeof (firstPhoto as { url?: unknown }).url === "string" &&
    (firstPhoto as { url: string }).url.trim()
  ) {
    return (firstPhoto as { url: string }).url;
  }

  return "/placeholder.svg";
}

export function ClientDashboardView({
  variant,
  navigate,
  buyerDisplayName,
  buyerEmail,
  buyerPhoneFmt = null,
  agent,
  agentPresenceOnline,
  agentPhoneFmt,
  unreadCount,
  stats,
  hotSheets,
  hotSheetPreviewPhotosById,
  hotSheetPreviewMatchCountsById,
  favorites,
  latestListingsPreview,
  getHotSheetCardPath,
  onMessagesPrimary,
  onMessagesIcon,
  onEmailPrimary,
  showBuyerSelfServiceChrome = true,
  setAddFriendOpen,
  setShowEndDialog,
  topBanner,
  onStatTileNavigate,
  dashboardPaths,
  buyerPresenceOnline = false,
  mirrorManagementActions,
  crmBuyerId = null,
  onRequestDeleteHotSheet,
}: ClientDashboardViewProps) {
  const goMessages = onMessagesPrimary ?? (() => navigate("/messages"));
  const goMessagesIcon = onMessagesIcon ?? goMessages;

  // Buyer-only: select market activity listings for bulk share. Agent mirror is unaffected.
  const [selectedMarketIds, setSelectedMarketIds] = useState<Set<string>>(() => new Set());
  const visibleMarketIds = useMemo(
    () => new Set((latestListingsPreview ?? []).map((l) => l.id)),
    [latestListingsPreview],
  );
  useEffect(() => {
    setSelectedMarketIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleMarketIds.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [visibleMarketIds]);
  const toggleMarketSelection = (id: string) => {
    setSelectedMarketIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearMarketSelection = () => setSelectedMarketIds(new Set());

  const paths = {
    hotSheetsViewAll: dashboardPaths?.hotSheetsViewAll ?? "/hot-sheets",
    favoritesViewAll: dashboardPaths?.favoritesViewAll ?? "/favorites",
    marketSearch: dashboardPaths?.marketSearch ?? "/client/search",
    favoritesEmptySearch: dashboardPaths?.favoritesEmptySearch ?? "/client/search",
  };

  const favoritesPreviewRows = favorites.filter(
    (fav) =>
      fav != null &&
      fav.listing != null &&
      typeof fav.listing === "object" &&
      fav.listing.id != null &&
      String(fav.listing.id).length > 0,
  );

  const statNavigate = (label: string) => {
    if (onStatTileNavigate) {
      onStatTileNavigate(label);
      return;
    }
    if (label === "Favorites") navigate("/favorites");
    if (label === "New Matches") navigate("/client/search");
    if (label === "Unread Messages") navigate("/messages");
    if (label === "Hot Sheets") navigate("/hot-sheets");
  };

  return (
    <div className={buyerPageShell}>
      {topBanner}
      <main className={buyerPageMain}>
        <div className="space-y-6 md:space-y-7">
          <section
            className={
              variant === "agent" ? agentMirrorHeroShell : `${aacCardShell} p-4 md:p-5 lg:p-6`
            }
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
              <div className="min-w-0 flex-1 space-y-2.5 sm:space-y-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                    {buyerDisplayName.trim()}
                  </h1>
                  {buyerPresenceOnline ? (
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"
                        title="Online"
                      />
                      <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                        Online
                      </span>
                    </div>
                  ) : null}
                </div>
                {variant === "agent" && (buyerEmail?.trim() || buyerPhoneFmt) ? (
                  <div className="flex flex-col gap-1.5 text-xs text-neutral-600">
                    {buyerEmail?.trim() ? (
                      onEmailPrimary ? (
                        <button
                          type="button"
                          onClick={() => onEmailPrimary()}
                          className="-mx-1 flex min-w-0 max-w-full items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 text-left text-xs text-neutral-600 transition-colors hover:bg-neutral-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
                          title="Send email through All Agent Connect (opens composer — not an external mail app)"
                          aria-label={`Send email to ${buyerEmail.trim()}`}
                        >
                          <Mail
                            className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]"
                            aria-hidden
                            strokeWidth={2}
                          />
                          <span className="min-w-0 truncate text-neutral-700">{buyerEmail.trim()}</span>
                        </button>
                      ) : (
                        <span className="flex min-w-0 items-center gap-2" title="Buyer email">
                          <Mail
                            className={`h-3.5 w-3.5 shrink-0 ${agentMirrorHeaderIcon}`}
                            aria-hidden
                            strokeWidth={2}
                          />
                          <span className="min-w-0 truncate text-neutral-700">{buyerEmail.trim()}</span>
                        </span>
                      )
                    ) : null}
                    {buyerPhoneFmt ? (
                      <span className="flex items-center gap-2" title="Buyer phone">
                        <Phone
                          className={`h-3.5 w-3.5 shrink-0 ${variant === "agent" ? agentMirrorHeaderIcon : "text-neutral-400"}`}
                          aria-hidden
                          strokeWidth={2}
                        />
                        <a
                          href={buyerPhoneFmt.telHref}
                          className={
                            variant === "agent"
                              ? "text-neutral-700 transition-colors hover:text-[#0E56F5] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                              : "text-neutral-700 transition-colors hover:text-neutral-900 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                          }
                        >
                          {buyerPhoneFmt.display}
                        </a>
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {buyerEmail?.trim() && variant !== "agent" ? (
                    <Button variant="outline" size="sm" type="button" className={buyerHeaderSoftBtn} asChild>
                      <a
                        href={`mailto:${encodeURIComponent(buyerEmail.trim())}`}
                        title="Send email"
                      >
                        <Mail
                          className="mr-1.5 h-3.5 w-3.5 text-neutral-600 sm:mr-2 sm:h-4 sm:w-4"
                          aria-hidden
                          strokeWidth={2}
                        />
                        Email
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className={buyerHeaderSoftBtn}
                    title={variant === "agent" ? "Open messages with this buyer" : undefined}
                    onClick={goMessages}
                  >
                    <MessageSquare
                      className={`mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4 ${
                        variant === "agent" ? "text-[#0E56F5]" : "text-neutral-600"
                      }`}
                      aria-hidden
                      strokeWidth={2}
                    />
                    Message
                  </Button>
                  {showBuyerSelfServiceChrome ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className={buyerHeaderSoftBtn}
                      onClick={() => setAddFriendOpen?.(true)}
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" aria-hidden />
                      Add a Friend
                    </Button>
                  ) : null}
                  {mirrorManagementActions}
                </div>
              </div>
              {variant === "buyer" && agent ? (
                <div className="relative w-full shrink-0 pt-2 lg:ms-auto lg:w-fit lg:max-w-[22rem] lg:pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={`absolute right-0 top-2 z-10 h-8 w-8 shrink-0 rounded-full border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/90 focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2 lg:top-0 lg:h-9 lg:w-9`}
                    aria-label={unreadCount > 0 ? `Open messages, ${unreadCount} unread` : "Open messages"}
                    onClick={goMessagesIcon}
                  >
                    <MessageSquare className="h-[15px] w-[15px] text-neutral-700 sm:h-4 sm:w-4" aria-hidden />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border border-white bg-neutral-900 px-0.5 text-[9px] font-semibold leading-none text-white shadow-sm">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    ) : null}
                  </Button>
                  <div className="flex flex-col items-center gap-2 pr-10 sm:pr-11 lg:pr-12">
                    <div className="flex max-w-full items-start gap-3">
                      <Avatar className="h-[60px] w-[60px] shrink-0 border border-neutral-200 ring-0 sm:h-16 sm:w-16">
                        <AvatarImage src={agent.headshot_url || ""} />
                        <AvatarFallback className="text-sm font-medium text-neutral-600">
                          {agent.first_name[0]}
                          {agent.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 max-w-[min(14rem,calc(100vw-8rem))] space-y-0.5 sm:max-w-[15rem]">
                        <p className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900 sm:text-sm">
                          <span>
                            {agent.first_name} {agent.last_name}
                          </span>
                          {agentPresenceOnline ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5">
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"
                                title="Online"
                              />
                              <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                                Online
                              </span>
                            </span>
                          ) : null}
                        </p>
                        {agent.company ? <p className="text-[11px] text-neutral-500 sm:text-xs">{agent.company}</p> : null}
                        {agentPhoneFmt ? (
                          <a href={agentPhoneFmt.telHref} className="block text-[13px] text-neutral-800 hover:underline">
                            {agentPhoneFmt.display}
                          </a>
                        ) : null}
                        <a
                          href={`mailto:${agent.email}`}
                          className="block break-all text-[11px] leading-snug text-neutral-600 hover:underline sm:text-xs"
                        >
                          {agent.email}
                        </a>
                      </div>
                    </div>
                    <div className="flex w-full max-w-[19rem] shrink-0 flex-row flex-nowrap items-center justify-center gap-2 sm:gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 whitespace-nowrap rounded-full border-neutral-200 bg-white px-2.5 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/90 sm:h-9 sm:px-3 sm:text-[13px]"
                        onClick={() => {
                          window.location.href = `mailto:${agent.email}`;
                        }}
                      >
                        <Mail className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
                        Email
                      </Button>
                      {showBuyerSelfServiceChrome ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 whitespace-nowrap rounded-full border border-red-200/90 bg-white px-2.5 text-[11px] font-medium text-red-800 transition-colors duration-200 hover:bg-red-50/90 sm:h-9 sm:px-3 sm:text-[12px]"
                          onClick={() => setShowEndDialog?.(true)}
                        >
                          <UserX className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
                          End relationship
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, subtle }) => (
              <div
                key={label}
                role="button"
                tabIndex={0}
                title={variant === "agent" ? `Open ${label}` : undefined}
                onClick={() => statNavigate(label)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  statNavigate(label);
                }}
                className={`${aacCardInteractive} p-4 md:p-5`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${clientDashboardStatIconClass(label)}`}
                    aria-hidden
                    strokeWidth={2}
                  />
                </div>
                <div
                  className={
                    variant === "agent"
                      ? agentMirrorStatValue
                      : "mt-2 text-lg font-semibold tracking-tight text-neutral-900 tabular-nums sm:text-xl"
                  }
                >
                  {value}
                </div>
                <div className="mt-0.5 text-[13px] font-medium text-neutral-600">{label}</div>
                {subtle ? <div className="mt-2 text-[11px] leading-snug text-neutral-400">{subtle}</div> : null}
              </div>
            ))}
          </section>

          <section className="space-y-6 md:space-y-7">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
              <div className={`${aacCardShell} overflow-visible`}>
                <div className="rounded-none bg-transparent">
                  <CardHeader className={previewSectionHeaderClass}>
                    <div className={previewSectionHeaderRowClass}>
                      <div className={previewSectionTitleWrapClass}>
                        <CardTitle
                          className={`${
                            variant === "agent" ? agentMirrorSectionTitle : dashSectionTitleClass
                          } inline-flex items-center gap-2`}
                        >
                          <Flame className="h-4 w-4 shrink-0 text-red-600" aria-hidden strokeWidth={2} />
                          Hot Sheets
                        </CardTitle>
                        <CardDescription className={`${dashSectionDescClass} mt-0 p-0`}>
                          Alerts for saved searches.
                        </CardDescription>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(paths.hotSheetsViewAll)}
                        className={dashboardPreviewViewAllCtaClass}
                        title={variant === "agent" ? "View all hot sheets" : undefined}
                      >
                        View all →
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className={previewSectionContentClass}>
                    {hotSheets.length > 0 ? (
                      <div className={previewGridClass}>
                        {hotSheets.slice(0, 3).map((sheet) => {
                          const viewPath = getHotSheetCardPath(sheet.id);
                          return (
                            <BuyerHotSheetPreviewCard
                              key={sheet.id}
                              photoUrls={hotSheetPreviewPhotosById[sheet.id] || []}
                              title={sheet.name}
                              subtitle={`${hotSheetPreviewMatchCountsById[sheet.id] ?? 0} matches`}
                              onClick={() => navigate(viewPath)}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                navigate(viewPath);
                              }}
                              onDeleteClick={
                                variant === "buyer" && onRequestDeleteHotSheet
                                  ? () => onRequestDeleteHotSheet(sheet.id)
                                  : undefined
                              }
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center">
                        <p className={`${dashSectionDescClass}`}>
                          No hot sheets yet. Create one from Hot Sheets for alerts, or ask your agent to share one.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </div>
              </div>

              <div className={`${aacCardShell} overflow-hidden`}>
                <div className="rounded-none bg-transparent">
                  <CardHeader className={previewSectionHeaderClass}>
                    <div className={previewSectionHeaderRowClass}>
                      <div className={previewSectionTitleWrapClass}>
                        <CardTitle
                          className={`${
                            variant === "agent" ? agentMirrorSectionTitle : dashSectionTitleClass
                          } inline-flex items-center gap-2`}
                        >
                          <Heart
                            className="h-4 w-4 shrink-0 text-[#FF2D55]"
                            aria-hidden
                            strokeWidth={2}
                          />
                          Favorites
                        </CardTitle>
                        <CardDescription className={`${dashSectionDescClass} mt-0 p-0`}>
                          {variant === "agent" && crmBuyerId ? (
                            favorites.length > 0 ? (
                              <>
                                {favorites.length} favorite{favorites.length === 1 ? "" : "s"}
                              </>
                            ) : (
                              <>MLS favorites for this buyer.</>
                            )
                          ) : (
                            <>Homes you saved.</>
                          )}
                        </CardDescription>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(paths.favoritesViewAll)}
                        className={dashboardPreviewViewAllCtaClass}
                        title={variant === "agent" ? "View all favorites" : undefined}
                      >
                        View all →
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className={previewSectionContentClass}>
                    {favorites.length > 0 ? (
                      <div className="grid grid-cols-3 gap-4">
                        {favoritesPreviewRows.slice(0, 3).map((fav) => {
                            const listing = fav.listing;
                            const photos = listing.photos ?? [];
                            const favPhotoUrl = getPrimaryPhotoUrl(photos);
                            return (
                              <button
                                key={fav.id}
                                type="button"
                                className={unifiedHotFavCardClass}
                                onClick={() => navigate(`/property/${listing.id}`)}
                              >
                                <div className={unifiedHotFavMediaWrap}>
                                  <DashboardListingImage
                                    photoUrl={favPhotoUrl}
                                    alt=""
                                    imageClassName="absolute inset-0 h-full w-full object-cover"
                                  />
                                  <div
                                    className="pointer-events-none absolute right-2 top-2 z-10"
                                    aria-hidden
                                  >
                                    <Heart
                                      className="h-[22px] w-[22px] fill-[#FF2D55] stroke-white [stroke-width:2.25px] [paint-order:stroke_fill]"
                                      strokeWidth={2.25}
                                    />
                                  </div>
                                </div>
                                <div className={unifiedHotFavBody}>
                                  <p className={dashTileTitleClass}>
                                    {listing.price ? `$${listing.price.toLocaleString()}` : "—"}
                                  </p>
                                  <p className={`flex min-w-0 items-start gap-1 ${dashTileAddressClass}`}>
                                    <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-[#50C878]" aria-hidden strokeWidth={2} />
                                    <span className="min-w-0 break-words">{listing.address}</span>
                                  </p>
                                  <p className={`flex min-w-0 items-start gap-1 ${dashTileSecondaryClass}`}>
                                    <span className="min-w-0 break-words">
                                      {listing.city}, {listing.state}
                                    </span>
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center">
                        <p className={`${dashSectionDescClass}`}>No favorites yet.</p>
                        {variant === "buyer" || !crmBuyerId ? (
                          <button
                            type="button"
                            onClick={() => navigate(paths.favoritesEmptySearch)}
                            className={`${dashboardPreviewViewAllCtaClass} font-medium`}
                          >
                            Search →
                          </button>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </div>
              </div>
            </div>

            <div className={`${aacCardShell} overflow-visible`}>
              <div className="rounded-none bg-transparent">
                <CardHeader className={previewSectionHeaderClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={previewSectionTitleWrapClass}>
                      <CardTitle className={`${variant === "agent" ? agentMirrorSectionTitle : dashSectionTitleClass} flex items-center gap-2`}>
                        <LineChart className="h-4 w-4 shrink-0 text-[#22C55E]" aria-hidden strokeWidth={2} />
                        Market activity
                      </CardTitle>
                      <CardDescription className={`${dashSectionDescClass} mt-0 p-0`}>
                        New listings on Direct Connect MLS.
                      </CardDescription>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(paths.marketSearch)}
                      className={dashboardPreviewViewAllCtaClass}
                      title={variant === "agent" ? "Search listings" : undefined}
                    >
                      Search
                    </button>
                  </div>
                </CardHeader>
                <CardContent className={previewSectionMarketContentClass}>
                  {latestListingsPreview.length > 0 ? (
                    <div className="overflow-visible">
                      {variant === "buyer" && selectedMarketIds.size > 0 ? (
                        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                          <BulkShareListingsDialog
                            listingIds={[...selectedMarketIds]}
                            listingCount={selectedMarketIds.size}
                            triggerVariant="outline"
                            triggerClassName="h-7 gap-0 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90 [&_svg]:mr-1 [&_svg]:!h-3 [&_svg]:!w-3 [&_svg]:text-neutral-600"
                            triggerLabel={`Share selected (${selectedMarketIds.size})`}
                            onSuccessfulShare={clearMarketSelection}
                          />
                          <button
                            type="button"
                            onClick={clearMarketSelection}
                            className="h-7 shrink-0 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {latestListingsPreview.map((listing) => {
                          const photos = listing.photos ?? [];
                          const listingIdLabel = formatListingIdLabel(listing);
                          const listedBy = resolveListedByAttribution(
                            listing as ListedBySource,
                            (listing.agent_profile as ListedByAgentProfile) ?? null,
                          );
                          const isSelected = variant === "buyer" && selectedMarketIds.has(listing.id);
                          return (
                            <article
                              key={listing.id}
                              role="button"
                              tabIndex={0}
                              className={`${dashboardPreviewTileInteractive} flex flex-col ${
                                isSelected ? "ring-2 ring-[#22C55E] ring-offset-1" : ""
                              }`}
                              onClick={() => navigate(`/property/${listing.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  navigate(`/property/${listing.id}`);
                                }
                              }}
                            >
                              <div className={`${listingPreviewMediaWrap} relative`}>
                                <DashboardListingImage
                                  photoUrl={getPrimaryPhotoUrl(photos)}
                                  alt={listing.address}
                                  imageClassName="absolute inset-0 h-full w-full object-cover"
                                />
                                {variant === "buyer" ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleMarketSelection(listing.id);
                                      }}
                                      aria-label={isSelected ? "Deselect listing" : "Select listing"}
                                      aria-pressed={isSelected}
                                      className={`absolute top-2 left-2 z-20 inline-flex h-6 w-6 items-center justify-center rounded-[4px] border transition-all ${
                                        isSelected
                                          ? "border-[#22C55E] bg-[#22C55E] text-white shadow"
                                          : "border-white/80 bg-white/80 text-transparent hover:bg-white"
                                      }`}
                                    >
                                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                                    </button>
                                    <div
                                      className="absolute top-2 right-2 z-20"
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                    >
                                      <FavoriteButton listingId={listing.id} size="icon" photoIcon />
                                    </div>
                                  </>
                                ) : null}
                              </div>
                              <div className={listingPreviewBody}>
                                <div className="mb-0 flex items-start justify-between gap-2">
                                  <p className={dashTileTitleClass}>
                                    {listing.price ? `$${listing.price.toLocaleString()}` : "—"}
                                  </p>
                                  {listingIdLabel ? (
                                    <span
                                      className={`${LISTING_ID_NAV_CLASS} shrink-0 text-right text-[12px] leading-snug tabular-nums`}
                                    >
                                      {listingIdLabel}
                                    </span>
                                  ) : null}
                                </div>
                                <p className={`flex min-w-0 items-start gap-1 ${dashTileAddressClass}`}>
                                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#50C878]" aria-hidden strokeWidth={2} />
                                  <span className="min-w-0 break-words">{listing.address}</span>
                                </p>
                                <p className={`flex min-w-0 items-start gap-1 ${dashTileSecondaryClass}`}>
                                  <span className="min-w-0 break-words">
                                    {listing.city}, {listing.state}
                                  </span>
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-neutral-900">
                                  {listing.bedrooms ? (
                                    <div className="flex items-center gap-1">
                                      <Bed className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden />
                                      <span className="font-medium">{listing.bedrooms}</span>
                                    </div>
                                  ) : null}
                                  {listing.bathrooms ? (
                                    <div className="flex items-center gap-1">
                                      <Bath className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden />
                                      <span className="font-medium">{listing.bathrooms}</span>
                                    </div>
                                  ) : null}
                                  {listing.square_feet ? (
                                    <div className="flex items-center gap-1">
                                      <Maximize className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden />
                                      <span className="font-medium">{listing.square_feet.toLocaleString()}</span>
                                    </div>
                                  ) : null}
                                </div>
                                {listedBy ? (
                                  <p
                                    className="mt-1.5 truncate text-[11px] font-normal leading-snug text-neutral-500"
                                    title={`Listed by: ${listedBy}`}
                                  >
                                    Listed by: {listedBy}
                                  </p>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center">
                      <p className={dashSectionDescClass}>No listings to show yet.</p>
                      <button type="button" onClick={() => navigate(paths.marketSearch)} className={dashboardPreviewViewAllCtaClass}>
                        Search →
                      </button>
                    </div>
                  )}
                  {isDcmlsHost() ? (
                    <p className={`mt-4 text-center text-[12px] leading-snug text-neutral-500`}>
                      Listings shown may include homes published on{" "}
                      <a
                        href="https://directconnectmls.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-neutral-600 underline-offset-2 hover:underline"
                      >
                        directconnectmls.com
                      </a>
                      .
                    </p>
                  ) : null}
                </CardContent>
              </div>
            </div>
          </section>

          {variant === "buyer" ? (
            <section>
              <PendingInvitesCard />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
