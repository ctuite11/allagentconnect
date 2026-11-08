import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { resolveFirstListingPhotoUrl } from "@/lib/resolveListingPhotoUrl";
import { Bath, BedDouble, Pencil, Ruler, Rocket } from "lucide-react";

/**
 * Draft review / publish screen.
 *
 * Landing spot for the "Review & Publish Listing" button in the concierge
 * review email. It is read-only: publishing always requires an explicit click
 * here, and the click hands off to the normal listing editor's publish path so
 * validation, photo-order confirmation, status rules and listing alerts behave
 * exactly as they always have.
 */

interface ReviewListing {
  id: string;
  agent_id: string;
  status: string;
  address: string | null;
  unit_number: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  property_type: string | null;
  description: string | null;
  photos: unknown;
  creation_source: string | null;
  creation_request_id: string | null;
}

function formatPrice(value: number | null): string {
  if (!value || value <= 0) return "Price to be confirmed";
  return `$${Math.round(value).toLocaleString()}`;
}

export default function ListingReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ReviewListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [privatePhotoUrls, setPrivatePhotoUrls] = useState<string[]>([]);
  const [hasPendingPrivatePhotos, setHasPendingPrivatePhotos] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) return;
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!auth.user) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id, agent_id, status, address, unit_number, city, state, zip_code, price, bedrooms, bathrooms, square_feet, property_type, description, photos, creation_source, creation_request_id",
        )
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data ||
          data.agent_id !== auth.user.id ||
          data.creation_source !== "admin_concierge" ||
          !data.creation_request_id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      // Only the submitting agent can read their original private photo intake.
      // Signed photo URLs are generated only after auth + ownership checks.
      const { data: intake, error: intakeError } = await (supabase as any)
        .from("agent_concierge_requests")
        .select("agent_id, request_type, photo_paths")
        .eq("id", data.creation_request_id)
        .eq("agent_id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (intakeError || !intake || intake.agent_id !== auth.user.id ||
          intake.request_type !== "listing") {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const paths: string[] = Array.isArray(intake.photo_paths) ? intake.photo_paths : [];
      setHasPendingPrivatePhotos(paths.length > 0);
      if (paths.length) {
        const { data: signed, error: signedError } = await supabase.storage
          .from("concierge-request-photos")
          .createSignedUrls(paths, 300);
        if (cancelled) return;
        setPhotoError(Boolean(signedError || signed?.some((item) => !item.signedUrl)));
        setPrivatePhotoUrls((signed ?? []).flatMap((item) => item.signedUrl ? [item.signedUrl] : []));
      }
      // Already live? Nothing to review — send them to the listing itself.
      if (data.status !== "draft") {
        navigate(`/agent/listings/${data.id}`, { replace: true });
        return;
      }
      setListing(data as ReviewListing);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const photoUrl = useMemo(
    () => (listing ? resolveFirstListingPhotoUrl(listing.photos) ?? null : null),
    [listing],
  );

  const addressLine = useMemo(() => {
    if (!listing) return "";
    return [listing.address, listing.unit_number ? `Unit ${listing.unit_number}` : null]
      .filter(Boolean)
      .join(", ");
  }, [listing]);

  const cityLine = useMemo(() => {
    if (!listing) return "";
    return [listing.city, [listing.state, listing.zip_code].filter(Boolean).join(" ")]
      .filter((part) => part && String(part).trim())
      .join(", ");
  }, [listing]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <AacMonogramLoader />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          We couldn't find that listing
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          It may have been removed. Your listings are all in one place.
        </p>
        <Button className="mt-6" onClick={() => navigate("/agent/listings")}>
          Go to My Listings
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Helmet>
        <title>Review your listing | All Agent Connect</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header className="mb-6">
        <Badge variant="secondary" className="mb-3">
          Draft — not yet live
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Review your listing
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          AAC prepared this draft from your concierge request. Review every detail,
          and make changes before deciding whether to publish. Nothing goes live automatically.
        </p>
      </header>

      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {!hasPendingPrivatePhotos && photoUrl && (
          <img
            src={photoUrl}
            alt={addressLine || "Listing photo"}
            className="h-64 w-full object-cover sm:h-80"
            loading="lazy"
          />
        )}
        <div className="p-6">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {formatPrice(listing.price)}
          </p>
          <p className="mt-1 text-base font-medium text-foreground">{addressLine}</p>
          {cityLine && <p className="text-sm text-muted-foreground">{cityLine}</p>}

          <div className="mt-4 flex flex-wrap gap-5 text-sm text-muted-foreground">
            {!!listing.bedrooms && (
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="h-4 w-4" aria-hidden /> {listing.bedrooms} beds
              </span>
            )}
            {!!listing.bathrooms && (
              <span className="inline-flex items-center gap-1.5">
                <Bath className="h-4 w-4" aria-hidden /> {listing.bathrooms} baths
              </span>
            )}
            {!!listing.square_feet && (
              <span className="inline-flex items-center gap-1.5">
                <Ruler className="h-4 w-4" aria-hidden />{" "}
                {Math.round(listing.square_feet).toLocaleString()} sq ft
              </span>
            )}
          </div>

          {listing.description && (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {listing.description}
            </p>
          )}
        </div>
      </article>

      {hasPendingPrivatePhotos && (
        <section className="mt-5 rounded-xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900">Your submitted photos</h2>
          <p className="mt-2 text-sm text-zinc-600">
            These are private previews from your concierge request, not yet attached
            to the listing. Publishing is unavailable until AAC securely attaches them.
          </p>
          {privatePhotoUrls.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {privatePhotoUrls.map((src, i) => (
                <img key={i} src={src} alt={`Submitted property photo ${i + 1}`}
                  className="h-32 w-full rounded-lg border border-zinc-200 object-cover" />
              ))}
            </div>
          )}
          {photoError && <p role="alert" className="mt-3 text-sm text-amber-800">
            Some private photos could not be loaded. Contact AAC before reviewing.
          </p>}
        </section>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1 gap-2"
          disabled={hasPendingPrivatePhotos || photoError}
          onClick={() => setConfirmOpen(true)}>
          <Rocket className="h-4 w-4" aria-hidden />
          {hasPendingPrivatePhotos ? "Awaiting Secure Photo Transfer" : "Publish Listing"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => navigate(`/agent/listings/edit/${listing.id}`)}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit / Update Listing
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              It will go live under your name and the usual alerts to matching buyers will go out.
              You can still edit or take it off market afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                navigate(`/agent/listings/edit/${listing.id}`, { state: { autoPublish: true } })
              }
            >
              Yes, publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
