import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageShell from "@/components/layout/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  FileStack,
  Users,
  MessageSquare,
  Clock,
  Home,
  ArrowRight,
  Bell,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  TrendingUp,
  BarChart3,
  Inbox,
} from "lucide-react";
import { useSuccessHubData, SuccessHubSummary } from "@/hooks/useSuccessHubData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending: "Pending",
  cancelled: "Cancelled",
  off_market: "Off Market",
  coming_soon: "Coming Soon",
  draft: "Draft",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-accent/10 text-accent",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
  off_market: "bg-zinc-100 text-zinc-600",
  coming_soon: "bg-blue-100 text-blue-700",
  draft: "bg-zinc-100 text-zinc-500",
};

function timeAgo(ts: string) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "";
  }
}

function initials(first: string | null, last: string | null, email: string) {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  return email[0].toUpperCase();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricChip({
  icon: Icon,
  label,
  value,
  path,
  highlight,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  path: string;
  highlight?: boolean;
  onClick: (path: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(path)}
      className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all hover:shadow-md cursor-pointer ${
        highlight && value > 0
          ? "border-amber-200 bg-amber-50"
          : "border-border bg-card hover:border-aac-card-borderHover"
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${highlight && value > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
        {highlight && value > 0 && (
          <span className="h-2 w-2 rounded-full bg-amber-400" />
        )}
      </div>
      <p className={`text-2xl font-bold tracking-tight ${highlight && value > 0 ? "text-amber-700" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

function SectionHeader({
  title,
  actionLabel,
  actionPath,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  actionPath?: string;
  onAction?: (path: string) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {actionLabel && actionPath && onAction && (
        <button
          onClick={() => onAction(actionPath)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const AllAgentConnectHome = () => {
  const navigate = useNavigate();
  const { summary, loading } = useSuccessHubData();

  const nav = (path: string) => navigate(path);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell className="pb-16">
        <div className="space-y-4 animate-pulse">
          <div className="h-24 rounded-2xl bg-muted" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted" />
            ))}
          </div>
          <div className="h-40 rounded-2xl bg-muted" />
        </div>
      </PageShell>
    );
  }

  // Convenience aliases — all null-safe with empty fallbacks
  const profile = summary?.profile ?? null;
  const metrics = summary?.metrics ?? {
    pendingInviteCount: 0,
    activeHotSheetCount: 0,
    activeBuyerCount: 0,
    unreadMessageCount: 0,
  };
  const attentionItems = summary?.attentionItems ?? [];
  const listings = summary?.listings ?? [];
  const hotSheets = summary?.hotSheets ?? [];
  const buyers = summary?.buyers ?? [];
  const conversations = summary?.conversations ?? [];
  const activity = summary?.activity ?? [];

  type ActivityIcon = SuccessHubSummary["activity"][number]["icon"];
  const ActivityIcon = ({ type }: { type: ActivityIcon }) => {
    const cls = "h-3.5 w-3.5";
    if (type === "invite") return <CheckCircle2 className={`${cls} text-accent`} />;
    if (type === "message") return <MessageSquare className={`${cls} text-primary`} />;
    if (type === "match") return <TrendingUp className={`${cls} text-amber-500`} />;
    return <Home className={`${cls} text-muted-foreground`} />;
  };

  return (
    <>
      <Helmet>
        <title>Success Hub | AllAgentConnect</title>
        <meta
          name="description"
          content="Your active workspace for managing listings, hotsheets, and communications."
        />
      </Helmet>

      <PageShell className="pb-16">
        <div className="space-y-8">

          {/* ── 1. Welcome + Agent Identity ──────────────────────────────── */}
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0 ring-2 ring-border">
              <AvatarImage src={profile?.headshot_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {profile ? initials(profile.first_name, profile.last_name, "") : <User className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}.
              </h1>
              {(profile?.company || profile?.title) && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {[profile.title, profile.company].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">
                Here's what needs your attention.
              </p>
            </div>
          </div>

          {/* ── 2. Snapshot Metrics ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricChip
              icon={Bell}
              label="Pending Invites"
              value={metrics.pendingInviteCount}
              path="/hot-sheets"
              highlight
              onClick={nav}
            />
            <MetricChip
              icon={FileStack}
              label="Active Hot Sheets"
              value={metrics.activeHotSheetCount}
              path="/hot-sheets"
              onClick={nav}
            />
            <MetricChip
              icon={Users}
              label="Active Buyers"
              value={metrics.activeBuyerCount}
              path="/my-clients"
              onClick={nav}
            />
            <MetricChip
              icon={MessageSquare}
              label="Unread Messages"
              value={metrics.unreadMessageCount}
              path="/communications"
              highlight
              onClick={nav}
            />
          </div>

          {/* ── 3. Needs Attention ───────────────────────────────────────── */}
          <div>
            <SectionHeader title="Needs Attention" />
            {attentionItems.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-5 py-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                <p className="text-sm text-muted-foreground">You're all caught up.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => nav(item.path)}
                    className="w-full flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-left hover:border-amber-300 hover:bg-amber-100 transition-all group"
                  >
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 4. My Listings ───────────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="My Listings"
              actionLabel="View all"
              actionPath="/agent/listings"
              onAction={nav}
            />
            {listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center">
                <Home className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active listings yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => nav("/agent/listings/new")}
                >
                  Add a Listing
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {listings.map((listing) => {
                  const thumb =
                    Array.isArray(listing.photos) && listing.photos.length > 0
                      ? listing.photos[0]
                      : null;
                  return (
                    <button
                      key={listing.id}
                      onClick={() => nav(`/property/${listing.id}`)}
                      className="group rounded-2xl border border-border bg-card overflow-hidden text-left hover:border-aac-card-borderHover hover:shadow-md transition-all"
                    >
                      {/* Thumbnail */}
                      <div className="h-32 bg-muted overflow-hidden relative">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={listing.address}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Home className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        {/* Status badge */}
                        <span
                          className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[listing.status] ?? "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {STATUS_LABELS[listing.status] ?? listing.status}
                        </span>
                      </div>
                      {/* Info */}
                      <div className="px-4 py-3 space-y-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {listing.address}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {listing.city}, {listing.state}
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BarChart3 className="h-3 w-3" />
                            {listing.view_count} views
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {listing.showing_request_count} showings
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 5. Hot Sheets ────────────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Hot Sheets"
              actionLabel="Manage"
              actionPath="/hot-sheets"
              onAction={nav}
            />
            {hotSheets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center">
                <FileStack className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active hot sheets.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {hotSheets.map((hs) => (
                  <button
                    key={hs.id}
                    onClick={() => nav(`/hot-sheets/${hs.id}/review`)}
                    className="w-full group rounded-2xl border border-border bg-card px-5 py-4 text-left hover:border-aac-card-borderHover hover:shadow-md transition-all flex items-center gap-4"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <FileStack className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{hs.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {hs.buyerCount} buyer{hs.buyerCount !== 1 ? "s" : ""}
                        </span>
                        {hs.pendingInviteCount > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {hs.pendingInviteCount} pending
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Updated {timeAgo(hs.lastUpdated)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 6. Buyers ────────────────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Buyers"
              actionLabel="All contacts"
              actionPath="/my-clients"
              onAction={nav}
            />
            {buyers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Add a buyer to activate this section.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {buyers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => nav("/my-clients")}
                    className="group rounded-2xl border border-border bg-card px-4 py-3.5 text-left hover:border-aac-card-borderHover hover:shadow-md transition-all flex items-center gap-3"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials(b.first_name, b.last_name, b.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {b.first_name || b.last_name
                            ? `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim()
                            : b.email}
                        </p>
                        <span
                          className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            b.status === "active"
                              ? "bg-accent/10 text-accent"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {b.status === "active" ? "Active" : "Pending"}
                        </span>
                        {b.hasUnread && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {b.hotSheetCount} hot sheet{b.hotSheetCount !== 1 ? "s" : ""}
                        </span>
                        {b.lastActivity && (
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(b.lastActivity)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 7. Messages Preview ──────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Messages"
              actionLabel="Open inbox"
              actionPath="/communications"
              onAction={nav}
            />
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.conversation_id}
                    onClick={() => nav(`/communications`)}
                    className="w-full group rounded-2xl border border-border bg-card px-5 py-3.5 text-left hover:border-aac-card-borderHover hover:shadow-md transition-all flex items-center gap-4"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {conv.other_name ? conv.other_name[0].toUpperCase() : "A"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {conv.other_name ?? "Agent"}
                        </p>
                        {conv.is_unread && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      {conv.last_message_preview && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.last_message_preview}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {timeAgo(conv.last_message_at)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 8. Recent Activity ───────────────────────────────────────── */}
          <div>
            <SectionHeader title="Recent Activity" />
            {activity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card divide-y divide-border">
                {activity.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <ActivityIcon type={ev.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{ev.description}</p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {timeAgo(ev.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </PageShell>
    </>
  );
};

export default AllAgentConnectHome;
