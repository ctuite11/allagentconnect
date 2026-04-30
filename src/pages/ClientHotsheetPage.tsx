import { useState, useEffect, useCallback, type ComponentProps } from "react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useParams, useNavigate, useMatch } from "react-router-dom";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { ArrowLeft, UserPlus, Plus } from "lucide-react";
import { enforceClientIdentity } from "@/lib/enforceClientIdentity";
import { User } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import ListingCard from "@/components/ListingCard";
import ListingChatDrawer, { type ChatMessage } from "@/components/ListingChatDrawer";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { LISTING_STATUS_LABELS } from "@/constants/status";
import {
  buyerMarketListingTileMediaWrap,
  buyerPageMain,
  buyerPageShell,
} from "@/lib/buyerUi";

/** Row from `buildListingsQuery` with optional embed for “Listed by” */
interface HotSheetListingRow {
  id: string;
  listing_number?: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  neighborhood?: string | null;
  agent_id: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  property_type: string | null;
  photos: any;
  description?: string | null;
  status: string;
  agent_profile?: ListedByAgentProfile;
  [key: string]: unknown;
}

function mergeListingAgentProfiles<T extends { agent_id?: string | null }>(
  rows: T[],
  agentsData: { id: string; first_name: string; last_name: string; company: string | null; office_name: string | null }[],
): (T & { agent_profile?: ListedByAgentProfile })[] {
  const byId = new Map(agentsData.map((a) => [a.id, a]));
  return rows.map((l) => {
    const aid = l.agent_id;
    if (typeof aid !== "string" || !byId.has(aid)) return { ...l } as T & { agent_profile?: ListedByAgentProfile };
    const a = byId.get(aid)!;
    return {
      ...l,
      agent_profile: {
        company: a.company,
        office_name: a.office_name,
        first_name: a.first_name,
        last_name: a.last_name,
      },
    };
  });
}

const ClientHotsheetPage = () => {
  const { token, id: hotSheetIdParam } = useParams<{ token?: string; id?: string }>();
  const navigate = useNavigate();
  const buyerByIdMatch = useMatch({ path: "/client/hot-sheets/:id", end: true });
  const isBuyerHotSheetByIdRoute = Boolean(buyerByIdMatch && hotSheetIdParam);
  const contentTopClass = isBuyerHotSheetByIdRoute ? "pt-4" : "pt-20";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotSheet, setHotSheet] = useState<any>(null);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [listings, setListings] = useState<HotSheetListingRow[]>([]);
  const [tokenData, setTokenData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showEditCriteria, setShowEditCriteria] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  /** Per-listing `hot_sheet_comments` for compact card thread + drawer */
  const [listingChatByListingId, setListingChatByListingId] = useState<Record<string, ChatMessage[]>>({});
  const [listingChatOpen, setListingChatOpen] = useState(false);
  const [listingChatListingId, setListingChatListingId] = useState<string | null>(null);
  const hidePublicFooter = isBuyerHotSheetByIdRoute || Boolean(currentUser);

  const handleListingChatMessage = useCallback((msg: ChatMessage) => {
    setListingChatByListingId((prev) => {
      const lid = msg.listing_id;
      const cur = prev[lid] ?? [];
      if (cur.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [lid]: [...cur, msg] };
    });
  }, []);

  useEffect(() => {
    if (hotSheetIdParam) {
      loadBuyerHotSheetById(hotSheetIdParam);
    } else if (token) {
      validateAndLoadHotsheet();
    } else {
      setError("No hot sheet specified");
      setLoading(false);
    }
  }, [token, hotSheetIdParam]);

  // Check authentication status
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Enforce client identity after token data is loaded
  useEffect(() => {
    if (!tokenData || !tokenData.payload) return;

    const payload = tokenData.payload as any;
    const clientEmailFromToken = payload?.client_email || payload?.email || null;

    enforceClientIdentity({
      supabase,
      clientEmailFromToken,
      setCurrentUser,
      setShowLoginPrompt,
    });
  }, [tokenData]);

  // Persist invite acceptance for signed-in buyers so dashboard can reliably
  // restore shared hot sheets from accepted tokens.
  useEffect(() => {
    const markTokenAccepted = async () => {
      if (hotSheetIdParam || !token || !tokenData || !currentUser) return;

      const payload = (tokenData.payload as any) || {};
      const tokenEmail = String(payload?.client_email || payload?.email || "").toLowerCase().trim();
      const currentEmail = (currentUser.email || "").toLowerCase().trim();

      // Do not claim acceptance for a different intended recipient.
      if (tokenEmail && currentEmail && tokenEmail !== currentEmail) return;

      // Skip if already accepted by someone else.
      if (tokenData.accepted_by_user_id && tokenData.accepted_by_user_id !== currentUser.id) return;

      if (tokenData.accepted_by_user_id === currentUser.id && tokenData.accepted_at) return;

      const acceptedAt = new Date().toISOString();
      const { error } = await supabase
        .from("share_tokens")
        .update({
          accepted_at: tokenData.accepted_at || acceptedAt,
          accepted_by_user_id: currentUser.id,
        })
        .eq("token", token);

      if (error) {
        console.error("Failed to persist token acceptance", error);
        return;
      }

      setTokenData((prev: any) => ({
        ...prev,
        accepted_at: prev?.accepted_at || acceptedAt,
        accepted_by_user_id: currentUser.id,
      }));
    };

    void markTokenAccepted();
  }, [hotSheetIdParam, token, tokenData, currentUser]);

  useEffect(() => {
    const hsId = hotSheet?.id as string | undefined;
    if (!hsId || listings.length === 0) {
      setListingChatByListingId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const ids = listings.map((l) => l.id);
      const { data, error } = await supabase
        .from("hot_sheet_comments")
        .select("id, hot_sheet_id, listing_id, comment, sender_role, sender_id, created_at")
        .eq("hot_sheet_id", hsId)
        .in("listing_id", ids)
        .order("created_at", { ascending: true });
      if (error || cancelled) return;
      const map: Record<string, ChatMessage[]> = {};
      for (const row of data ?? []) {
        const lid = row.listing_id;
        if (!lid) continue;
        if (!map[lid]) map[lid] = [];
        map[lid].push(row as ChatMessage);
      }
      if (!cancelled) setListingChatByListingId(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [hotSheet?.id, listings]);

  const loadBuyerHotSheetById = async (hotSheetId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        toast.error("Please sign in to view this hot sheet.");
        navigate("/auth", { replace: true });
        return;
      }

      const { data: linkRow, error: linkError } = await supabase
        .from("hot_sheet_clients")
        .select("hot_sheet_id")
        .eq("hot_sheet_id", hotSheetId)
        .maybeSingle();

      if (linkError) {
        throw linkError;
      }
      if (!linkRow) {
        throw new Error("You do not have access to this hot sheet.");
      }

      const { data: hotSheetData, error: hotSheetError } = await supabase
        .from("hot_sheets")
        .select("*")
        .eq("id", hotSheetId)
        .single();

      if (hotSheetError || !hotSheetData) {
        throw hotSheetError || new Error("Saved search not found");
      }

      if (hotSheetData.user_id) {
        document.cookie = `primary_agent_id=${hotSheetData.user_id}; path=/; max-age=${
          60 * 60 * 24 * 365
        }`;
        localStorage.setItem("primary_agent_id", hotSheetData.user_id);
      }
      if (hotSheetData.client_id) {
        localStorage.setItem("client_id", hotSheetData.client_id);
      }

      setHotSheet(hotSheetData);

      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", hotSheetData.user_id)
        .single();

      if (agentError) {
        throw agentError;
      }

      setAgentProfile(agentData);
      setAgent(agentData);

      const loadedCriteria = (hotSheetData.criteria as any) || {};
      const query = buildListingsQuery(supabase, loadedCriteria).limit(200);
      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) {
        throw listingsError;
      }

      const rawListings = listingsData || [];
      const agentIds = Array.from(
        new Set(rawListings.map((l: { agent_id?: string | null }) => l.agent_id).filter((id): id is string => Boolean(id))),
      );
      let hydrated: HotSheetListingRow[] = rawListings as HotSheetListingRow[];
      if (agentIds.length > 0) {
        const { data: agentsData, error: agentsError } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, company, office_name")
          .in("id", agentIds);
        if (!agentsError && agentsData?.length) {
          hydrated = mergeListingAgentProfiles(rawListings as { agent_id?: string }[], agentsData);
        }
      }
      setListings(hydrated);

      setLoading(false);
    } catch (err: any) {
      console.error("Client hotsheet by id load error", err);
      setLoading(false);
      toast.error("We couldn't open this hot sheet.");
      navigate("/hot-sheets", { replace: true });
    }
  };

  const validateAndLoadHotsheet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        throw new Error("Missing token in URL params");
      }

      // 1) Validate token from share_tokens table
      const { data: tokenData, error: tokenError } = await supabase
        .from("share_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError) {
        throw tokenError;
      }

      if (!tokenData) {
        throw new Error("Share token not found");
      }

      console.log("Client hotsheet share token", tokenData);
      
      // Store token data for identity enforcement
      setTokenData(tokenData);

      // Check if token is expired (only if expires_at is set and in the past)
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        throw new Error("Share token expired");
      }

      // 2) Parse payload - assume it contains hot_sheet_id and optional client_id
      let payload: any = tokenData.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (parseError) {
          throw new Error("Invalid payload JSON on share token");
        }
      }

      console.log("Client hotsheet payload", payload);

      const hotSheetId =
        payload?.hot_sheet_id || payload?.hotSheetId || payload?.hotsheetId;

      if (!hotSheetId) {
        throw new Error("No hot_sheet_id found in share token payload");
      }

      // 3) Set agent + client context (cookie / localStorage)
      if (tokenData.agent_id) {
        document.cookie = `primary_agent_id=${tokenData.agent_id}; path=/; max-age=${
          60 * 60 * 24 * 365
        }; SameSite=Lax`;
        localStorage.setItem("primary_agent_id", tokenData.agent_id);
      }

      if (payload.client_id) {
        localStorage.setItem("client_id", payload.client_id);
      }

      // 4) Fetch agent profile
      if (tokenData.agent_id) {
        const { data: agentData, error: agentError } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", tokenData.agent_id)
          .single();

        if (agentError) {
          throw agentError;
        }

        setAgentProfile(agentData);
        setAgent(agentData);
      }

      // 5) Fetch hot sheet details
      const { data: hotSheetData, error: hotSheetError } = await supabase
        .from("hot_sheets")
        .select("*")
        .eq("id", hotSheetId)
        .single();

      if (hotSheetError || !hotSheetData) {
        throw hotSheetError || new Error("Saved search not found");
      }

      console.log("Client hotsheet hotSheet", hotSheetData);
      setHotSheet(hotSheetData);

      // 6) Fetch matching listings using hot sheet criteria
      const loadedCriteria = (hotSheetData.criteria as any) || {};
      const query = buildListingsQuery(supabase, loadedCriteria).limit(200);
      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) {
        throw listingsError;
      }

      console.log("Client hotsheet listings", listingsData);
      const rawListings = listingsData || [];
      const agentIds = Array.from(
        new Set(rawListings.map((l: { agent_id?: string | null }) => l.agent_id).filter((id): id is string => Boolean(id))),
      );
      let hydrated: HotSheetListingRow[] = rawListings as HotSheetListingRow[];
      if (agentIds.length > 0) {
        const { data: agentsData, error: agentsError } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, company, office_name")
          .in("id", agentIds);
        if (!agentsError && agentsData?.length) {
          hydrated = mergeListingAgentProfiles(rawListings as { agent_id?: string }[], agentsData);
        }
      }
      setListings(hydrated);

      // ✅ SUCCESS – stop loading
      setLoading(false);
    } catch (err: any) {
      console.error("Client hotsheet load error", err);

      const reason =
        err?.message ||
        err?.error_description ||
        err?.hint ||
        (typeof err === "string" ? err : JSON.stringify(err));

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        toast.error("We could not open this specific shared hot sheet. Taking you to your dashboard.");
        navigate("/client/dashboard", { replace: true });
        return;
      }

      setError(
        `We could not load this saved search. (${reason}) Please contact your agent or try the link again.`
      );
      setLoading(false);
    }
  };

  const handleUpdateCriteria = async (
    _hotSheetId?: string,
    updatedHotSheet?: { id: string; name: string; criteria: Record<string, unknown> | null }
  ) => {
    if (updatedHotSheet) {
      setHotSheet((prev: any) =>
        prev
          ? {
              ...prev,
              name: updatedHotSheet.name,
              criteria: updatedHotSheet.criteria,
            }
          : prev
      );
      return;
    }

    if (hotSheetIdParam) {
      await loadBuyerHotSheetById(hotSheetIdParam);
    } else {
      await validateAndLoadHotsheet();
    }
  };

  const handleSetupLogin = () => {
    // Close the login prompt
    setShowLoginPrompt(false);
    
    // Extract client email from token payload
    const payload = tokenData?.payload as any;
    const clientEmail = payload?.client_email || payload?.email || "";
    const clientId = payload?.client_id || "";
    
    // Build query params
    const params = new URLSearchParams();
    params.set("invitation_token", token!);
    if (clientEmail) params.set("email", clientEmail);
    if (agentProfile?.id) params.set("agent_id", agentProfile.id);
    if (clientId) params.set("client_id", clientId);
    
    // Navigate to client invitation setup page
    navigate(`/client-invite?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className={`flex min-h-screen flex-col bg-white ${contentTopClass}`}>
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-muted-foreground text-lg">Loading your saved search...</p>
        </main>
        {!hidePublicFooter && <Footer />}
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className={`flex min-h-screen flex-col bg-white ${contentTopClass}`}>
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full p-6 text-center">
            <h1 className="text-xl font-semibold mb-2">We hit a snag</h1>
            <p className="text-muted-foreground mb-4">
              We could not load this saved search. Please contact your agent or try the link again.
            </p>
            <Button onClick={() => navigate("/")}>Back to home</Button>
          </Card>
        </main>
        {!hidePublicFooter && <Footer />}
      </div>
    );
  }

  const criteria = hotSheet?.criteria || {};

  // Show luxury onboarding modal for anonymous users BEFORE rendering main content
  if (showLoginPrompt && !currentUser && agentProfile) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[600px]" hideCloseButton>
            <DialogHeader>
              {/* Agent Header Section */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="relative h-12 w-12 rounded-full overflow-hidden border border-neutral-200 bg-white flex items-center justify-center">
                  {agentProfile.headshot_url ? (
                    <img 
                      src={agentProfile.headshot_url} 
                      alt={agentProfile.first_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-muted-foreground">
                      {agentProfile.first_name?.charAt(0)}{agentProfile.last_name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">You're setting up your access with</p>
                  <p className="font-semibold text-foreground">{agentProfile.first_name} {agentProfile.last_name}</p>
                </div>
              </div>
              
              <DialogTitle className="text-2xl">
                Secure Your Access to All Agent Connect
              </DialogTitle>
              <DialogDescription className="pt-4 space-y-4 text-base leading-relaxed">
                <p className="text-foreground/90">
                  {agentProfile.first_name} has curated a personalized collection of homes for you. 
                  To continue exploring your saved search, please set up your All Agent Connect login.
                </p>
                <div className="pt-2">
                  <p className="font-medium text-foreground/90 mb-3">Creating your login ensures you can:</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-foreground/80">View your homes anytime</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-foreground/80">Save and organize your saved homes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-foreground/80">Message {agentProfile.first_name} directly</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-foreground/80">Access your search securely from any device</span>
                    </li>
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="pt-4">
              <Button
                onClick={handleSetupLogin}
                className="w-full h-11"
                size="lg"
              >
                Set Up My Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${buyerPageShell} ${contentTopClass}`}>
      <main className={`flex-1 ${buyerPageMain}`}>
        <div>
          {/* Back to Account */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(isBuyerHotSheetByIdRoute ? "/hot-sheets" : "/client/dashboard")}
          >
            <ArrowLeft className="w-4 h-4" />
            {isBuyerHotSheetByIdRoute ? "Back to Hot Sheets" : "Back to Your Account"}
          </Button>

          {/* Search criteria + header (hot sheet name + create) */}
          <Card className="mb-6">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-base font-medium text-foreground">
                  Hot Sheet Name:{" "}
                  <span className="text-[#0E56F5]">{hotSheet?.name || "Untitled hot sheet"}</span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 sm:self-start"
                  onClick={() => navigate("/client/hotsheets/new")}
                >
                  <Plus className="w-4 h-4" />
                  Create New Hot Sheet
                </Button>
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold">Search Criteria</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowAddFriend(true)}
                  >
                    <UserPlus className="w-4 h-4" />
                    Add a Friend
                  </Button>
                  <Button
                    onClick={() => {
                      if (!hotSheet?.user_id) {
                        toast.error("This hot sheet cannot be edited right now");
                        return;
                      }
                      setShowEditCriteria(true);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={!hotSheet?.user_id}
                  >
                    Edit Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {criteria.state && (
                  <div>
                    <span className="text-muted-foreground">State:</span>{" "}
                    <span className="font-semibold">{criteria.state}</span>
                  </div>
                )}
                {criteria.selectedCountyId && criteria.selectedCountyId !== "all" && (
                  <div>
                    <span className="text-muted-foreground">County:</span>{" "}
                    <span className="font-semibold">{criteria.selectedCountyId}</span>
                  </div>
                )}
                {criteria.county && criteria.county !== "all" && !criteria.selectedCountyId && (
                  <div>
                    <span className="text-muted-foreground">County:</span>{" "}
                    <span className="font-semibold">{criteria.county}</span>
                  </div>
                )}
                {criteria.minPrice && (
                  <div>
                    <span className="text-muted-foreground">Min Price:</span>{" "}
                    <span className="font-semibold">${parseFloat(criteria.minPrice).toLocaleString()}</span>
                  </div>
                )}
                {criteria.maxPrice && (
                  <div>
                    <span className="text-muted-foreground">Max Price:</span>{" "}
                    <span className="font-semibold">${parseFloat(criteria.maxPrice).toLocaleString()}</span>
                  </div>
                )}
                {criteria.bedrooms && (
                  <div>
                    <span className="text-muted-foreground">Min Beds:</span>{" "}
                    <span className="font-semibold">{criteria.bedrooms}</span>
                  </div>
                )}
                {criteria.bathrooms && (
                  <div>
                    <span className="text-muted-foreground">Min Baths:</span>{" "}
                    <span className="font-semibold">{criteria.bathrooms}</span>
                  </div>
                )}
                {criteria.minSqft && (
                  <div>
                    <span className="text-muted-foreground">Min SqFt:</span>{" "}
                    <span className="font-semibold">{parseFloat(criteria.minSqft).toLocaleString()}</span>
                  </div>
                )}
                {criteria.maxSqft && (
                  <div>
                    <span className="text-muted-foreground">Max SqFt:</span>{" "}
                    <span className="font-semibold">{parseFloat(criteria.maxSqft).toLocaleString()}</span>
                  </div>
                )}
                {criteria.zipCode && (
                  <div>
                    <span className="text-muted-foreground">Zip Code:</span>{" "}
                    <span className="font-semibold">{criteria.zipCode}</span>
                  </div>
                )}
                {criteria.propertyTypes && criteria.propertyTypes.length > 0 && (
                  <div className="col-span-2 md:col-span-4">
                    <span className="text-muted-foreground">Property Types:</span>{" "}
                    <span className="font-semibold">
                      {criteria.propertyTypes.map((t: string) => t.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())).join(", ")}
                    </span>
                  </div>
                )}
                {criteria.statuses && criteria.statuses.length > 0 && (
                  <div className="col-span-2 md:col-span-4">
                    <span className="text-muted-foreground">Statuses:</span>{" "}
                    <span className="font-semibold">
                      {criteria.statuses.map((s: string) => LISTING_STATUS_LABELS[s] || s.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())).join(", ")}
                    </span>
                  </div>
                )}
                {(criteria.cities && criteria.cities.length > 0) && (
                  <div className="col-span-2 md:col-span-4">
                    <span className="text-muted-foreground">Towns/Cities:</span>{" "}
                    <span className="font-semibold">{criteria.cities.join(", ")}</span>
                  </div>
                )}
                {criteria.neighborhoods && criteria.neighborhoods.length > 0 && (
                  <div className="col-span-2 md:col-span-4">
                    <span className="text-muted-foreground">Neighborhoods:</span>{" "}
                    <span className="font-semibold">{criteria.neighborhoods.join(", ")}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Friend Dialog */}
          <AddFriendDialog open={showAddFriend} onOpenChange={setShowAddFriend} />

          {hotSheet?.user_id && (
            <CreateHotSheetDialog
              key={hotSheet.id}
              open={showEditCriteria}
              onOpenChange={setShowEditCriteria}
              userId={hotSheet.user_id}
              hotSheetId={hotSheet.id}
              editMode
              onSuccess={handleUpdateCriteria}
            />
          )}

          {/* Listings Count */}
          <div className="mb-4">
            <p className="text-lg font-semibold">
              {listings.length} {listings.length === 1 ? "Home" : "Homes"} Found
            </p>
            {isBuyerHotSheetByIdRoute && (
              <p className="mt-1 text-sm text-muted-foreground">
                Results update as new listings match your saved criteria.
              </p>
            )}
          </div>

          {/* Listings Grid */}
          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-2 max-w-md mx-auto">
                <p className="text-foreground font-medium">No matching homes on the network right now</p>
                <p className="text-sm text-muted-foreground">
                  Your hot sheet and criteria are saved. Check back soon — new listings that fit your search will show up here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing as ComponentProps<typeof ListingCard>["listing"]}
                  viewMode="compact"
                  showActions={false}
                  hideMlsMeta
                  showCompactComments
                  hotSheetId={hotSheet?.id}
                  chatMessages={listingChatByListingId[listing.id] ?? []}
                  onNewMessage={handleListingChatMessage}
                  onOpenChat={() => {
                    setListingChatListingId(listing.id);
                    setListingChatOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {listingChatListingId && hotSheet?.id ? (
        <ListingChatDrawer
          viewerPerspective="client"
          open={listingChatOpen}
          onOpenChange={(open) => {
            setListingChatOpen(open);
            if (!open) setListingChatListingId(null);
          }}
          hotSheetId={hotSheet.id}
          listingId={listingChatListingId}
          listingAddress={(() => {
            const row = listings.find((l) => l.id === listingChatListingId);
            return row ? `${row.address}, ${row.city}` : "";
          })()}
          messages={listingChatByListingId[listingChatListingId] ?? []}
          onNewMessage={handleListingChatMessage}
        />
      ) : null}

      {!hidePublicFooter && <Footer />}
    </div>
  );
};

export default ClientHotsheetPage;
