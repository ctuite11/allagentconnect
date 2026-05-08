/**
 * Shared buyer dashboard presentation — used by `/client/dashboard` and agent BuyerAccount mirror.
 * Same layout/tokens as the buyer-facing dashboard; parents supply data and navigation handlers.
 */
import type { ReactNode } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageSquare, UserPlus, Mail, MapPin, Bed, Bath, Maximize, UserX, Phone } from "lucide-react";
import { isDcmlsHost } from "@/lib/host";
import { PendingInvitesCard } from "@/components/PendingInvitesCard";
import {
  buyerDashboardHotFavTile as unifiedHotFavCardClass,
  buyerDashboardHotFavTileBody as unifiedHotFavBody,
  buyerDashboardHotSheetMediaWrap as unifiedHotFavMediaWrap,
  buyerMarketListingTileBody as listingPreviewBody,
  buyerMarketListingTileMediaWrap as listingPreviewMediaWrap,
  buyerOutlineSecondary as outlineSecondaryClass,
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
  buyerPageStack,
} from "@/lib/buyerUi";
import { DashboardListingImage } from "@/components/buyer/DashboardListingImage";
import { BuyerHotSheetPreviewCard } from "@/components/buyer/BuyerHotSheetPreviewCard";
import {
  resolveListedByAttribution,
  type ListedByAgentProfile,
  type ListedBySource,
} from "@/lib/listingListedBy";

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
  /** Logged-in buyer or CRM client — used for header mailto. */
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
}

const buyerHeaderSoftBtn =
  "h-9 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-none transition-colors hover:bg-zinc-50";

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
  showBuyerSelfServiceChrome = true,
  setAddFriendOpen,
  setShowEndDialog,
  topBanner,
  onStatTileNavigate,
  dashboardPaths,
  buyerPresenceOnline = false,
  mirrorManagementActions,
  crmBuyerId = null,
}: ClientDashboardViewProps) {
  const goMessages = onMessagesPrimary ?? (() => navigate("/messages"));
  const goMessagesIcon = onMessagesIcon ?? goMessages;

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
        <div className={buyerPageStack}>
          <section className={`${aacCardShell} p-5 md:p-6`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex min-w-0 items-center gap-3">
                  <h1 className="text-2xl font-semibold text-zinc-950">{buyerDisplayName.trim()}</h1>
                  {variant === "agent" ? (
                    <span className="inline-block max-w-full rounded-md border-2 border-red-500 bg-red-50 px-2 py-1 text-[11px] font-bold leading-snug text-red-700">
                      HOT SHEETS HEADER TEST — ClientDashboardView · /success-hub/buyers/:buyerId
                    </span>
                  ) : null}
                  {buyerPresenceOnline ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm text-neutral-500">Online</span>
                    </div>
                  ) : null}
                </div>
                {variant === "agent" && (buyerEmail?.trim() || buyerPhoneFmt) ? (
                  <div className="flex flex-col gap-1.5 text-xs text-zinc-500">
                    {buyerEmail?.trim() ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                        <a
                          href={`mailto:${encodeURIComponent(buyerEmail.trim())}`}
                          className="min-w-0 truncate text-zinc-600 hover:text-zinc-900 hover:underline"
                        >
                          {buyerEmail.trim()}
                        </a>
                      </span>
                    ) : null}
                    {buyerPhoneFmt ? (
                      <span className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                        <a
                          href={buyerPhoneFmt.telHref}
                          className="text-zinc-600 hover:text-zinc-900 hover:underline"
                        >
                          {buyerPhoneFmt.display}
                        </a>
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {buyerEmail?.trim() ? (
                    <Button variant="outline" size="sm" type="button" className={buyerHeaderSoftBtn} asChild>
                      <a href={`mailto:${encodeURIComponent(buyerEmail.trim())}`}>
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                      </a>
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" type="button" className={buyerHeaderSoftBtn} onClick={goMessages}>
                    <MessageSquare className="mr-2 h-4 w-4" />
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
                      <UserPlus className="mr-2 h-4 w-4" />
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
                    className={`absolute right-0 top-2 z-10 h-9 w-9 shrink-0 rounded-full bg-white lg:top-0 ${outlineSecondaryClass}`}
                    aria-label={unreadCount > 0 ? `Open messages, ${unreadCount} unread` : "Open messages"}
                    onClick={goMessagesIcon}
                  >
                    <MessageSquare className="h-4 w-4 text-gray-700" />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    ) : null}
                  </Button>
                  <div className="flex flex-col items-center gap-2 pr-11 lg:pr-12">
                    <div className="flex max-w-full items-start gap-3">
                      <Avatar className="h-16 w-16 shrink-0 ring-1 ring-gray-200">
                        <AvatarImage src={agent.headshot_url || ""} />
                        <AvatarFallback className="text-sm font-medium text-gray-600">
                          {agent.first_name[0]}
                          {agent.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 max-w-[min(14rem,calc(100vw-8rem))] space-y-0.5 sm:max-w-[15rem]">
                        <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                          {agentPresenceOnline ? (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-[#50C878]"
                              title="Recently active"
                              aria-label="Recently active"
                            />
                          ) : null}
                          <span>
                            {agent.first_name} {agent.last_name}
                          </span>
                        </p>
                        {agent.company ? <p className="text-xs text-gray-500">{agent.company}</p> : null}
                        {agentPhoneFmt ? (
                          <a href={agentPhoneFmt.telHref} className="block text-sm text-gray-800 hover:underline">
                            {agentPhoneFmt.display}
                          </a>
                        ) : null}
                        <a
                          href={`mailto:${agent.email}`}
                          className="block break-all text-xs leading-snug text-gray-600 hover:underline"
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
                        className={`h-9 shrink-0 whitespace-nowrap rounded-md px-3 text-xs sm:text-sm ${outlineSecondaryClass}`}
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
                          className="h-9 shrink-0 whitespace-nowrap rounded-md border border-red-200/80 bg-white px-2.5 text-xs text-red-700 shadow-sm transition-shadow duration-200 hover:bg-red-50 hover:shadow-sm sm:px-3 sm:text-sm"
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

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, subtle }) => (
              <div
                key={label}
                role="button"
                tabIndex={0}
                onClick={() => statNavigate(label)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  statNavigate(label);
                }}
                className={`${aacCardInteractive} p-5 md:p-6`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-4 w-4 text-[hsl(160_84%_39%)]" />
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-gray-900">{value}</div>
                <div className="mt-1 text-sm font-medium text-gray-500">{label}</div>
                {subtle ? <div className="mt-2 text-xs text-gray-400">{subtle}</div> : null}
              </div>
            ))}
          </section>

          <section className="space-y-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className={`${aacCardShell} overflow-visible`}>
                <div className="rounded-none bg-transparent">
                  <CardHeader className={previewSectionHeaderClass}>
                    <div className={previewSectionHeaderRowClass}>
                      <div className={previewSectionTitleWrapClass}>
                        <CardTitle className={dashSectionTitleClass}>Hot Sheets</CardTitle>
                        <CardDescription className={`${dashSectionDescClass} mt-0 p-0`}>
                          Alerts for saved searches.
                        </CardDescription>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(paths.hotSheetsViewAll)}
                        className={dashboardPreviewViewAllCtaClass}
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
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <p className={`max-w-md ${dashSectionDescClass}`}>
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
                        <CardTitle className={dashSectionTitleClass}>Favorites</CardTitle>
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
                                </div>
                                <div className={unifiedHotFavBody}>
                                  <p className={dashTileTitleClass}>
                                    {listing.price ? `$${listing.price.toLocaleString()}` : "—"}
                                  </p>
                                  <p className={`flex min-w-0 items-center gap-1 ${dashTileAddressClass}`}>
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#50C878]" aria-hidden strokeWidth={2} />
                                    <span className="min-w-0 truncate">{listing.address}</span>
                                  </p>
                                  <p className={`flex min-w-0 items-center gap-1 truncate ${dashTileSecondaryClass}`}>
                                    <span className="min-w-0 truncate">
                                      {listing.city}, {listing.state}
                                    </span>
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <p className={`max-w-sm ${dashSectionDescClass}`}>No favorites yet.</p>
                        {variant === "buyer" || !crmBuyerId ? (
                          <button
                            type="button"
                            onClick={() => navigate(paths.favoritesEmptySearch)}
                            className="text-sm font-medium text-[#0E56F5] hover:underline"
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
                      <CardTitle className={dashSectionTitleClass}>Market activity</CardTitle>
                      <CardDescription className={`${dashSectionDescClass} mt-0 p-0`}>
                        New listings on Direct Connect MLS.
                      </CardDescription>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(paths.marketSearch)}
                      className={dashboardPreviewViewAllCtaClass}
                    >
                      Search
                    </button>
                  </div>
                </CardHeader>
                <CardContent className={previewSectionMarketContentClass}>
                  {latestListingsPreview.length > 0 ? (
                    <div className="overflow-visible">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {latestListingsPreview.map((listing) => {
                          const photos = listing.photos ?? [];
                          const listedBy = resolveListedByAttribution(
                            listing as ListedBySource,
                            (listing.agent_profile as ListedByAgentProfile) ?? null,
                          );
                          return (
                            <article
                              key={listing.id}
                              role="button"
                              tabIndex={0}
                              className={`${dashboardPreviewTileInteractive} flex flex-col`}
                              onClick={() => navigate(`/property/${listing.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  navigate(`/property/${listing.id}`);
                                }
                              }}
                            >
                              <div className={listingPreviewMediaWrap}>
                                <DashboardListingImage
                                  photoUrl={getPrimaryPhotoUrl(photos)}
                                  alt={listing.address}
                                  imageClassName="absolute inset-0 h-full w-full object-cover"
                                />
                              </div>
                              <div className={listingPreviewBody}>
                                <p className={dashTileTitleClass}>
                                  {listing.price ? `$${listing.price.toLocaleString()}` : "—"}
                                </p>
                                <p className={`flex min-w-0 items-center gap-1 ${dashTileAddressClass}`}>
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#50C878]" aria-hidden strokeWidth={2} />
                                  <span className="min-w-0 truncate">{listing.address}</span>
                                </p>
                                <p className={`flex min-w-0 items-center gap-1 truncate ${dashTileSecondaryClass}`}>
                                  <span className="min-w-0 truncate">
                                    {listing.city}, {listing.state}
                                  </span>
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-neutral-900">
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
                    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                      <p className={dashSectionDescClass}>No listings to show yet.</p>
                      <button
                        type="button"
                        onClick={() => navigate(paths.marketSearch)}
                        className={dashboardPreviewViewAllCtaClass}
                      >
                        Search →
                      </button>
                    </div>
                  )}
                  {isDcmlsHost() ? (
                    <p className={`mt-4 text-center ${dashSectionDescClass}`}>
                      Listings shown may include homes published on{" "}
                      <a
                        href="https://directconnectmls.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-500 underline-offset-2 hover:underline"
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
