import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

interface BuyerClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  client_type: string | null;
  agent_id: string;
  agent_user_id: string | null;
  notes: string | null;
}

interface HotSheetWithMatches {
  id: string;
  name: string;
  criteria: any;
  updated_at: string;
  matchCount: number;
  topListings: any[];
}

interface BuyerConversation {
  id: string;
  listing_id: string | null;
  last_message_at: string;
  listing_address?: string;
  listing_city?: string;
}

interface ActivityItem {
  id: string;
  comment: string;
  sender_role: string;
  listing_id: string | null;
  created_at: string;
  hot_sheet_id: string;
  hot_sheet_name?: string;
  /** Short address line when listing_id is set */
  listing_label?: string;
}

export interface BuyerDashboardData {
  client: BuyerClient | null;
  hotSheets: HotSheetWithMatches[];
  favorites: any[];
  activity: ActivityItem[];
  conversations: BuyerConversation[];
  stats: {
    hotSheetCount: number;
    favoritesCount: number;
    messagesCount: number;
  };
  loading: boolean;
  refresh: () => void;
}

export function useBuyerDashboard(buyerId: string | undefined): BuyerDashboardData {
  const [client, setClient] = useState<BuyerClient | null>(null);
  const [hotSheets, setHotSheets] = useState<HotSheetWithMatches[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [conversations, setConversations] = useState<BuyerConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!buyerId) return;

    const load = async () => {
      setLoading(true);
      try {
        // 1. Client record
        const { data: clientData, error: clientErr } = await supabase
          .from("clients")
          .select("id,first_name,last_name,email,phone,client_type,agent_id,agent_user_id,notes")
          .eq("id", buyerId)
          .maybeSingle();

        if (clientErr) throw clientErr;
        setClient(clientData);
        if (!clientData) { setLoading(false); return; }

        // 2. Linked hot sheets
        const { data: hscData } = await supabase
          .from("hot_sheet_clients")
          .select("hot_sheet_id")
          .eq("client_id", buyerId);

        const hsIds = (hscData ?? []).map((r: any) => r.hot_sheet_id);

        let hsWithMatches: HotSheetWithMatches[] = [];

        if (hsIds.length > 0) {
          const { data: hsData } = await supabase
            .from("hot_sheets")
            .select("id,name,criteria,updated_at")
            .in("id", hsIds)
            .order("updated_at", { ascending: false });

          hsWithMatches = await Promise.all(
            (hsData ?? []).map(async (hs: any) => {
              let topListings: any[] = [];
              let matchCount = 0;

              if (hs.criteria) {
                try {
                  const query = buildListingsQuery(supabase, hs.criteria);
                  const { data: matchData } = await query.limit(4);
                  topListings = matchData ?? [];
                  matchCount = topListings.length;
                } catch {
                  // criteria might be malformed
                }
              }

              return {
                id: hs.id,
                name: hs.name,
                criteria: hs.criteria,
                updated_at: hs.updated_at,
                matchCount,
                topListings,
              };
            })
          );
        }

        setHotSheets(hsWithMatches);

        // 3. Favorites from hot_sheet_favorites
        if (hsIds.length > 0) {
          const { data: favData } = await supabase
            .from("hot_sheet_favorites")
            .select("id,listing_id,hot_sheet_id")
            .in("hot_sheet_id", hsIds);

          if (favData && favData.length > 0) {
            const listingIds = [...new Set(favData.map((f: any) => f.listing_id))];
            const { data: listingsData } = await supabase
              .from("listings")
              .select("*")
              .in("id", listingIds);

            setFavorites(listingsData ?? []);
          } else {
            setFavorites([]);
          }

          // 4. Activity / comments
          const { data: commentsData } = await supabase
            .from("hot_sheet_comments")
            .select("id,comment,sender_role,listing_id,created_at,hot_sheet_id")
            .in("hot_sheet_id", hsIds)
            .order("created_at", { ascending: false })
            .limit(50);

          const raw = commentsData ?? [];
          const actHsIds = [...new Set(raw.map((r) => r.hot_sheet_id).filter(Boolean))] as string[];
          const actListingIds = [
            ...new Set(raw.map((r) => r.listing_id).filter(Boolean)),
          ] as string[];

          let hsNameById: Record<string, string> = {};
          if (actHsIds.length > 0) {
            const { data: hsRows } = await supabase
              .from("hot_sheets")
              .select("id,name")
              .in("id", actHsIds);
            (hsRows ?? []).forEach((h: { id: string; name: string }) => {
              hsNameById[h.id] = h.name;
            });
          }

          let listingLabelById: Record<string, string> = {};
          if (actListingIds.length > 0) {
            const { data: listRows } = await supabase
              .from("listings")
              .select("id,address,city")
              .in("id", actListingIds);
            (listRows ?? []).forEach((l: { id: string; address: string; city: string }) => {
              listingLabelById[l.id] = [l.address, l.city].filter(Boolean).join(", ");
            });
          }

          setActivity(
            raw.map((c) => ({
              ...c,
              hot_sheet_name: hsNameById[c.hot_sheet_id],
              listing_label: c.listing_id ? listingLabelById[c.listing_id] : undefined,
            }))
          );
        } else {
          setFavorites([]);
          setActivity([]);
        }

        // 5. Buyer conversations (if buyer is on platform)
        if (clientData.agent_user_id) {
          const { data: session } = await supabase.auth.getSession();
          const currentUserId = session?.session?.user?.id;

          if (currentUserId) {
            const { data: convos } = await supabase
              .from("conversations")
              .select("id,listing_id,last_message_at")
              .or(
                `and(agent_a_id.eq.${currentUserId},agent_b_id.eq.${clientData.agent_user_id}),and(agent_a_id.eq.${clientData.agent_user_id},agent_b_id.eq.${currentUserId})`
              )
              .order("last_message_at", { ascending: false });

            if (convos && convos.length > 0) {
              // Enrich listing-specific conversations with address
              const listingIds = convos
                .filter((c) => c.listing_id)
                .map((c) => c.listing_id!);

              let listingMap: Record<string, { address: string; city: string }> = {};
              if (listingIds.length > 0) {
                const { data: listings } = await supabase
                  .from("listings")
                  .select("id,address,city")
                  .in("id", listingIds);

                (listings ?? []).forEach((l: any) => {
                  listingMap[l.id] = { address: l.address, city: l.city };
                });
              }

              setConversations(
                convos.map((c) => ({
                  id: c.id,
                  listing_id: c.listing_id,
                  last_message_at: c.last_message_at,
                  listing_address: c.listing_id ? listingMap[c.listing_id]?.address : undefined,
                  listing_city: c.listing_id ? listingMap[c.listing_id]?.city : undefined,
                }))
              );
            } else {
              setConversations([]);
            }
          } else {
            setConversations([]);
          }
        } else {
          setConversations([]);
        }
      } catch (err) {
        console.error("Error loading buyer dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [buyerId, refreshKey]);

  return {
    client,
    hotSheets,
    favorites,
    activity,
    conversations,
    stats: {
      hotSheetCount: hotSheets.length,
      favoritesCount: favorites.length,
      messagesCount: conversations.length,
    },
    loading,
    refresh,
  };
}
