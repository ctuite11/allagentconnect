import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentProfile {
  first_name: string;
  last_name: string;
  headshot_url: string | null;
  company: string | null;
  title: string | null;
}

interface SnapshotMetrics {
  pendingInvites: number;
  activeHotSheets: number;
  activeBuyers: number;
  unreadMessages: number;
}

interface NeedsAttentionItem {
  id: string;
  type: "invite" | "message" | "hotsheet" | "listing";
  label: string;
  sub: string;
  path: string;
  count?: number;
}

interface ListingSummary {
  id: string;
  address: string;
  city: string;
  state: string;
  status: string;
  photos: string[] | null;
  price: number | null;
  view_count: number;
  showing_request_count: number;
}

interface HotSheetSummary {
  id: string;
  name: string;
  buyerCount: number;
  pendingInvites: number;
  lastUpdated: string;
}

interface BuyerSummary {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  status: "active" | "pending";
  hotSheetCount: number;
  lastActivity: string | null;
  hasUnread: boolean;
}

interface ConversationPreview {
  conversation_id: string;
  last_message_preview: string | null;
  last_message_at: string;
  is_unread: boolean;
  other_user_id: string | null;
  other_name: string | null;
}

interface ActivityEvent {
  id: string;
  description: string;
  timestamp: string;
  icon: "invite" | "match" | "message" | "listing";
}

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
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);

  // Section data
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [metrics, setMetrics] = useState<SnapshotMetrics>({
    pendingInvites: 0,
    activeHotSheets: 0,
    activeBuyers: 0,
    unreadMessages: 0,
  });
  const [attentionItems, setAttentionItems] = useState<NeedsAttentionItem[]>([]);
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [hotSheets, setHotSheets] = useState<HotSheetSummary[]>([]);
  const [buyers, setBuyers] = useState<BuyerSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const nav = (path: string) => navigate(path);

  // ── Data loader ────────────────────────────────────────────────────────────

  const loadAll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setAgentId(user.id);

      await Promise.all([
        loadProfile(user.id),
        loadMetricsAndAttention(user.id),
        loadListings(user.id),
        loadHotSheets(user.id),
        loadBuyers(user.id),
        loadConversations(user.id),
        loadActivity(user.id),
      ]);
    } catch (err) {
      console.error("Success Hub load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name, headshot_url, company, title")
      .eq("id", uid)
      .single();
    if (data) setProfile(data as AgentProfile);
  };

  const loadMetricsAndAttention = async (uid: string) => {
    const items: NeedsAttentionItem[] = [];

    // Pending invites (share_tokens not yet accepted)
    const { count: pendingInvites } = await supabase
      .from("share_tokens")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", uid)
      .is("accepted_at", null);

    if ((pendingInvites || 0) > 0) {
      items.push({
        id: "pending-invites",
        type: "invite",
        label: "Pending buyer invites",
        sub: `${pendingInvites} buyer${pendingInvites! > 1 ? "s" : ""} haven't accepted yet`,
        path: "/hot-sheets",
        count: pendingInvites || 0,
      });
    }

    // Active hot sheets count
    const { count: activeHS } = await supabase
      .from("hot_sheets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("is_active", true);

    // Active buyers (via client_agent_relationships)
    const { count: activeBuyers } = await supabase
      .from("client_agent_relationships")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", uid)
      .eq("status", "active");

    // Unread messages (conversation_inbox)
    const { count: unreadMessages } = await supabase
      .from("conversation_inbox")
      .select("*", { count: "exact", head: true })
      .eq("is_unread", true);

    if ((unreadMessages || 0) > 0) {
      items.push({
        id: "unread-messages",
        type: "message",
        label: "Unread messages",
        sub: `${unreadMessages} conversation${unreadMessages! > 1 ? "s" : ""} waiting`,
        path: "/communications",
        count: unreadMessages || 0,
      });
    }

    setMetrics({
      pendingInvites: pendingInvites || 0,
      activeHotSheets: activeHS || 0,
      activeBuyers: activeBuyers || 0,
      unreadMessages: unreadMessages || 0,
    });
    setAttentionItems(items);
  };

  const loadListings = async (uid: string) => {
    const { data } = await supabase
      .from("listings")
      .select(`
        id, address, city, state, status, photos, price,
        listing_stats (view_count, showing_request_count)
      `)
      .eq("agent_id", uid)
      .in("status", ["active", "pending", "coming_soon", "off_market"])
      .order("created_at", { ascending: false })
      .limit(6);

    if (data) {
      setListings(
        data.map((l: any) => ({
          id: l.id,
          address: l.address,
          city: l.city,
          state: l.state,
          status: l.status,
          photos: l.photos,
          price: l.price,
          view_count: l.listing_stats?.[0]?.view_count ?? l.listing_stats?.view_count ?? 0,
          showing_request_count:
            l.listing_stats?.[0]?.showing_request_count ??
            l.listing_stats?.showing_request_count ??
            0,
        }))
      );
    }
  };

  const loadHotSheets = async (uid: string) => {
    const { data: hsData } = await supabase
      .from("hot_sheets")
      .select("id, name, updated_at")
      .eq("user_id", uid)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (!hsData || hsData.length === 0) {
      setHotSheets([]);
      return;
    }

    const hsIds = hsData.map((h) => h.id);

    // Count buyers per hot sheet
    const { data: clientRows } = await supabase
      .from("hot_sheet_clients")
      .select("hot_sheet_id, client_id")
      .in("hot_sheet_id", hsIds);

    // Count pending invites per hot sheet
    const { data: tokenRows } = await supabase
      .from("share_tokens")
      .select("payload, accepted_at")
      .eq("agent_id", uid)
      .is("accepted_at", null);

    const pendingByHs = new Map<string, number>();
    (tokenRows || []).forEach((t: any) => {
      const hsId = String(t.payload?.hot_sheet_id ?? "");
      if (hsId) pendingByHs.set(hsId, (pendingByHs.get(hsId) ?? 0) + 1);
    });

    const buyersByHs = new Map<string, number>();
    (clientRows || []).forEach((r: any) => {
      buyersByHs.set(r.hot_sheet_id, (buyersByHs.get(r.hot_sheet_id) ?? 0) + 1);
    });

    setHotSheets(
      hsData.map((hs) => ({
        id: hs.id,
        name: hs.name,
        buyerCount: buyersByHs.get(hs.id) ?? 0,
        pendingInvites: pendingByHs.get(hs.id) ?? 0,
        lastUpdated: hs.updated_at,
      }))
    );
  };

  const loadBuyers = async (uid: string) => {
    const { data: relationships } = await supabase
      .from("client_agent_relationships")
      .select("client_id, status, created_at")
      .eq("agent_id", uid)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!relationships || relationships.length === 0) {
      // Fallback: load from clients table
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, created_at")
        .eq("agent_id", uid)
        .order("created_at", { ascending: false })
        .limit(8);

      if (clientsData) {
        setBuyers(
          clientsData.map((c) => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email,
            status: "active" as const,
            hotSheetCount: 0,
            lastActivity: c.created_at,
            hasUnread: false,
          }))
        );
      }
      return;
    }

    const clientIds = relationships.map((r) => r.client_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", clientIds);

    // Count hot sheets per buyer
    const { data: hscRows } = await supabase
      .from("hot_sheet_clients")
      .select("client_id, hot_sheet_id")
      .in("client_id", clientIds);

    const hsByClient = new Map<string, number>();
    (hscRows || []).forEach((r: any) => {
      hsByClient.set(r.client_id, (hsByClient.get(r.client_id) ?? 0) + 1);
    });

    // Pending invites per buyer
    const { data: pendingTokens } = await supabase
      .from("share_tokens")
      .select("payload, accepted_at")
      .eq("agent_id", uid)
      .is("accepted_at", null);

    const pendingClientEmails = new Set(
      (pendingTokens || []).map((t: any) =>
        String(t.payload?.client_email ?? "").toLowerCase()
      )
    );

    setBuyers(
      relationships.map((rel) => {
        const prof = profiles?.find((p) => p.id === rel.client_id);
        const isPending = prof?.email
          ? pendingClientEmails.has(prof.email.toLowerCase())
          : false;
        return {
          id: rel.client_id,
          first_name: prof?.first_name ?? null,
          last_name: prof?.last_name ?? null,
          email: prof?.email ?? "",
          status: (rel.status === "active" && !isPending ? "active" : "pending") as
            | "active"
            | "pending",
          hotSheetCount: hsByClient.get(rel.client_id) ?? 0,
          lastActivity: rel.created_at,
          hasUnread: false,
        };
      })
    );
  };

  const loadConversations = async (_uid: string) => {
    const { data } = await supabase
      .from("conversation_inbox")
      .select(
        "conversation_id, last_message_preview, last_message_at, is_unread, other_user_id"
      )
      .order("last_message_at", { ascending: false })
      .limit(3);

    if (!data) { setConversations([]); return; }

    // Fetch other-user names
    const otherIds = [...new Set(data.map((d: any) => d.other_user_id).filter(Boolean))];
    let nameMap = new Map<string, string>();
    if (otherIds.length > 0) {
      const { data: agentNames } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name")
        .in("id", otherIds);
      (agentNames || []).forEach((a: any) => {
        nameMap.set(a.id, `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim());
      });
    }

    setConversations(
      data.map((d: any) => ({
        conversation_id: d.conversation_id,
        last_message_preview: d.last_message_preview,
        last_message_at: d.last_message_at,
        is_unread: d.is_unread,
        other_user_id: d.other_user_id,
        other_name: d.other_user_id ? (nameMap.get(d.other_user_id) || "Agent") : "Agent",
      }))
    );
  };

  const loadActivity = async (uid: string) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const events: ActivityEvent[] = [];

    // Accepted invites
    const { data: acceptedInvites } = await supabase
      .from("share_tokens")
      .select("accepted_at, payload")
      .eq("agent_id", uid)
      .not("accepted_at", "is", null)
      .gte("accepted_at", thirtyDaysAgo.toISOString())
      .order("accepted_at", { ascending: false })
      .limit(5);

    (acceptedInvites || []).forEach((inv: any) => {
      const hsName = inv.payload?.hotsheet_name ?? inv.payload?.hot_sheet_name ?? "a Hot Sheet";
      const clientName = inv.payload?.client_name ?? inv.payload?.client_email ?? "A buyer";
      events.push({
        id: `inv-${inv.accepted_at}`,
        description: `${clientName} accepted invite to '${hsName}'`,
        timestamp: inv.accepted_at,
        icon: "invite",
      });
    });

    // Recent clients added
    const { data: recentClients } = await supabase
      .from("clients")
      .select("first_name, last_name, created_at")
      .eq("agent_id", uid)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    (recentClients || []).forEach((c: any) => {
      events.push({
        id: `client-${c.created_at}`,
        description: `${c.first_name ?? ""} ${c.last_name ?? ""} added as a contact`.trim(),
        timestamp: c.created_at,
        icon: "invite",
      });
    });

    // Recent messages
    const { data: recentMsgs } = await supabase
      .from("conversation_messages")
      .select("created_at, body, recipient_agent_id")
      .eq("recipient_agent_id", uid)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(3);

    (recentMsgs || []).forEach((m: any) => {
      events.push({
        id: `msg-${m.created_at}`,
        description: `New message received`,
        timestamp: m.created_at,
        icon: "message",
      });
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivity(events.slice(0, 8));
  };

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

  const ActivityIcon = ({ type }: { type: ActivityEvent["icon"] }) => {
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
              value={metrics.pendingInvites}
              path="/hot-sheets"
              highlight
              onClick={nav}
            />
            <MetricChip
              icon={FileStack}
              label="Active Hot Sheets"
              value={metrics.activeHotSheets}
              path="/hot-sheets"
              onClick={nav}
            />
            <MetricChip
              icon={Users}
              label="Active Buyers"
              value={metrics.activeBuyers}
              path="/my-clients"
              onClick={nav}
            />
            <MetricChip
              icon={MessageSquare}
              label="Unread Messages"
              value={metrics.unreadMessages}
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
                        {hs.pendingInvites > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {hs.pendingInvites} pending
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
