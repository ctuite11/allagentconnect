import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HotSheetInviteRequest {
  invitedEmail: string;
  inviterName: string;
  hotSheetName: string;
  hotSheetLink: string;
  hotSheetId?: string;
}

interface ListingTeaser {
  photoUrl: string;
  price: string;
  cityState: string;
  bedsBaths: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { invitedEmail, inviterName, hotSheetName, hotSheetLink, hotSheetId }: HotSheetInviteRequest = await req.json();

    let teasers: ListingTeaser[] = [];

    if (hotSheetId) {
      const { data: matchingListings } = await supabase
        .rpc("check_hot_sheet_matches", { p_hot_sheet_id: hotSheetId });

      const listingIds = (matchingListings || []).slice(0, 3).map((match: any) => match.listing_id);

      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from("listings")
          .select("price, city, state, bedrooms, bathrooms, photos")
          .in("id", listingIds);

        teasers = (listings || []).slice(0, 3).map((listing: any) => ({
          photoUrl: listing?.photos?.[0]?.url || "",
          price: listing?.price ? `$${Number(listing.price).toLocaleString()}` : "Price unavailable",
          cityState: [listing?.city, listing?.state].filter(Boolean).join(", "),
          bedsBaths: [
            listing?.bedrooms ? `${listing.bedrooms} bd` : null,
            listing?.bathrooms ? `${listing.bathrooms} ba` : null,
          ].filter(Boolean).join(" • "),
        }));
      }
    }

    console.log("[send-hot-sheet-invite] Enqueuing job for:", invitedEmail);

    const { error: insertError } = await supabase.from("email_jobs").insert({
      payload: {
        provider: "resend",
        template: "hot-sheet-invite",
        to: invitedEmail,
        subject: `${inviterName} shared a Hot Sheet with you`,
        variables: { inviterName, hotSheetName, hotSheetLink, teasers },
      },
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-hot-sheet-invite] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
