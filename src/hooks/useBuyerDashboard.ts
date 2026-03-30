import { useEffect, useState } from "react";
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
}

interface HotSheetWithMatches {
  id: string;
  name: string;
  criteria: any;
  updated_at: string;
  matchCount: number;
  topListings: any[];
}

interface FavoriteListing {
  id: string;
  listing: any;
}

interface ActivityItem {
  id: string;
  comment: string;
  sender_role: string;
  listing_id: string;
  created_at: string;
  hot_sheet_id: string;
}

export interface BuyerDashboardData {
  client: BuyerClient | null;
  hotSheets: HotSheetWithMatches[];
  favorites: any[];
  activity: ActivityItem[];
  stats: {
    hotSheetCount: number;
    favoritesCount: number;
    messagesCount: number;
  };
  loading: boolean;
}

export function useBuyerDashboard(buyerId: string | undefined): BuyerDashboardData {
  const [client, setClient] = useState<BuyerClient | null>(null);
  const [hotSheets, setHotSheets] = useState<HotSheetWithMatches[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [messagesCount, setMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!buyerId) return;

    const load = async () => {
      setLoading(true);
      try {
        // 1. Client record
        const { data: clientData, error: clientErr } = await supabase
          .from("clients")
          .select("id,first_name,last_name,email,phone,client_type,agent_id")
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

          // For each hot sheet, fetch top 4 matched listings
          hsWithMatches = await Promise.all(
            (hsData ?? []).map(async (hs: any) => {
              let topListings: any[] = [];
              let matchCount = 0;

              if (hs.criteria) {
                try {
                  // Get top 4 listings
                  const query = buildListingsQuery(supabase, hs.criteria);
                  const { data: matchData } = await query.limit(4);
                  topListings = matchData ?? [];
                  matchCount = topListings.length;
                  matchCount = count ?? topListings.length;
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

          setActivity(commentsData ?? []);
        } else {
          setFavorites([]);
          setActivity([]);
        }

        // 5. Messages count — attempt via conversations linked to agent
        // Only count if we can reliably map. For now, set 0 as placeholder.
        setMessagesCount(0);
      } catch (err) {
        console.error("Error loading buyer dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [buyerId]);

  return {
    client,
    hotSheets,
    favorites,
    activity,
    stats: {
      hotSheetCount: hotSheets.length,
      favoritesCount: favorites.length,
      messagesCount,
    },
    loading,
  };
}
