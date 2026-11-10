import { useEffect, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { privacyRpc, type SharedAgent, type SharedListing, type SharedHotSheet } from "@/lib/privacyApi";
import { PrivateFileLink, PrivateImage, PrivateMediaScope } from "@/components/PrivateImage";
import { UnavailableShareLink } from "@/components/UnavailableShareLink";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Seo } from "@/components/Seo";
import { Card, CardContent } from "@/components/ui/card";
import { formatListingPriceDisplay } from "@/lib/formatListingPriceDisplay";
import { useAuthRole } from "@/hooks/useAuthRole";

export default function SecureSharedListing() {
  const { token, id } = useParams<{ token?: string; id?: string }>();
  const location = useLocation();
  const { user, role } = useAuthRole();
  const params = new URLSearchParams(location.search);
  const sheetId = params.get("sheet") ?? undefined;
  const listingId = id ?? params.get("listing") ?? undefined;
  const hotSheet = params.get("kind") === "hotsheet" || Boolean(sheetId);
  const sourceKey = `${token ?? ""}|${sheetId ?? ""}|${listingId ?? ""}|${hotSheet}|${user?.id ?? ""}|${role ?? ""}`;
  const [state, setState] = useState<{ key: string; listing?: SharedListing; agent?: SharedAgent; memberSheet?: string }>();
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        let result: { listing?: SharedListing; agent?: SharedAgent; memberSheet?: string } | null;
        if (id) {
          result = await privacyRpc("get_buyer_listing", { p_listing_id: id, p_hot_sheet_id: sheetId ?? null });
        } else if (hotSheet) {
          const sheet = await privacyRpc<SharedHotSheet | null>("get_shared_hot_sheet", { p_token: token ?? null, p_hot_sheet_id: sheetId ?? null });
          result = sheet ? { listing: sheet.listings.find(row => row.id === listingId), agent: sheet.agent } : null;
          if (sheet && listingId && user && role === "buyer") {
            // Token possession does not establish membership. Verify the signed-in
            // recipient before entering the full buyer workspace for this sheet.
            const member = await privacyRpc<{ listing: SharedListing; agent: SharedAgent } | null>("get_buyer_listing", {
              p_listing_id: listingId, p_hot_sheet_id: sheet.hot_sheet.id,
            }).catch(() => null);
            if (member?.listing.id === listingId && member.agent.id === sheet.agent.id) {
              result = { ...member, memberSheet: sheet.hot_sheet.id };
            }
          }
        } else {
          result = await privacyRpc("get_shared_listing", { p_token: token });
        }
        if (!cancelled) setState({ key: sourceKey, ...result });
      } catch { if (!cancelled) setState({ key: sourceKey }); }
    };
    void load();
    // Recheck authorization while open, including revocation and seller opt-out.
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [sourceKey, token, sheetId, listingId, hotSheet]);
  if (!state || state.key !== sourceKey) return <LoadingScreen />;
  if (!state.listing || !state.agent) return <UnavailableShareLink token={token} />;
  if (state.memberSheet) {
    const returnTo = `/client/hot-sheets/${state.memberSheet}`;
    const query = new URLSearchParams({ sheet: state.memberSheet, returnTo });
    return <Navigate to={`/client/shared-property/${state.listing.id}?${query}`} state={{ from: returnTo }} replace />;
  }
  const { listing, agent } = state;
  return <PrivateMediaScope token={token} hotSheetId={sheetId}>
    <Seo title="Private shared listing" description="Secure access through All Agent Connect." noindex />
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div><h1 className="text-2xl font-semibold">{listing.address}{listing.unit_number ? `, ${listing.unit_number}` : ""}</h1>
        <p>{listing.city}, {listing.state}</p><p className="mt-2 text-xl font-semibold">{formatListingPriceDisplay(listing)}</p></div>
      <p>{[listing.bedrooms != null ? `${listing.bedrooms} bedrooms` : "", listing.bathrooms != null ? `${listing.bathrooms} bathrooms` : "", listing.square_feet ? `${listing.square_feet.toLocaleString()} sq ft` : ""].filter(Boolean).join(" · ")}</p>
      <div className="grid gap-4 sm:grid-cols-2">{listing.photos.map((photo, index) => <PrivateImage key={photo.url} src={photo.url} alt={`Property photo ${index + 1}`} className="aspect-video w-full rounded-xl object-cover" />)}</div>
      {listing.description && <p className="whitespace-pre-wrap">{listing.description}</p>}
      {listing.floor_plans.length > 0 && <section><h2 className="mb-3 text-xl font-semibold">Floor plans</h2>
        <div className="grid gap-4 sm:grid-cols-2">{listing.floor_plans.map((plan, index) => <PrivateFileLink key={plan.url} href={plan.url} storageBucket="listing-floorplans" target="_blank">Open floor plan {index + 1}</PrivateFileLink>)}</div></section>}
      <Card><CardContent className="space-y-2 p-6"><p className="text-sm text-muted-foreground">Your Agent · Shared by</p>
        <p className="font-semibold">{agent.first_name} {agent.last_name}</p><p>{agent.company}</p>
        {agent.phone && <p><a href={`tel:${agent.phone}`}>{agent.phone}</a></p>}
        {agent.email && <p><a href={`mailto:${agent.email}`}>{agent.email}</a></p>}
      </CardContent></Card>
    </main>
  </PrivateMediaScope>;
}
