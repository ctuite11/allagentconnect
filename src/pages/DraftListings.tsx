import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { formatDistanceToNow, differenceInDays } from "date-fns";

import PageShell from "@/components/layout/PageShell";
import { CardSurface } from "@/components/ui/CardSurface";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Grid, List as ListIcon, Plus, Pencil, Trash2, FileText, X, AlertTriangle } from "lucide-react";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { LISTING_TYPE_LABELS } from "@/constants/status";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
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

interface DraftListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  status: string;
  listing_type?: string | null;
  photos: any;
  updated_at: string;
  created_at: string;
  unit_number?: string | null;
  listing_stats?: {
    view_count: number;
    save_count: number;
    share_count: number;
    contact_count: number;
    showing_request_count: number;
  };
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAddressWithUnit(listing: DraftListing): string {
  const baseAddress = toTitleCase(listing.address || "");
  const unit = listing.unit_number;
  const city = toTitleCase(listing.city || "");

  if (unit && unit.trim()) {
    return `${baseAddress} #${unit.replace(/^#/, "")}, ${city}`;
  }
  return `${baseAddress}, ${city}`;
}

function getThumbnailUrl(listing: DraftListing) {
  if (!listing.photos) return null;
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  if (photos.length === 0) return null;
  const firstPhoto = photos[0];
  if (typeof firstPhoto === "string") return firstPhoto;
  return firstPhoto?.url || null;
}

function getDraftAgeBadge(updatedAt: string): { label: string; className: string } | null {
  const days = differenceInDays(new Date(), new Date(updatedAt));
  if (days >= 90) return { label: "Old Draft", className: "bg-red-50 text-red-700" };
  if (days >= 30) return { label: "Stale Draft", className: "bg-yellow-50 text-yellow-700" };
  return null;
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function DraftListings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthRole();
  const [listings, setListings] = useState<DraftListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("list");
  const [listingToDelete, setListingToDelete] = useState<DraftListing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterStale, setFilterStale] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchDrafts();
  }, [user]);

  const fetchDrafts = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select(
        `*, listing_stats (view_count, save_count, share_count, contact_count, showing_request_count)`
      )
      .eq("agent_id", user.id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching drafts:", error);
      toast.error("Failed to load drafts");
    } else {
      setListings((data as DraftListing[]) || []);
    }
    setLoading(false);
  };

  const filteredListings = useMemo(() => {
    if (!filterStale) return listings;
    return listings.filter(
      (l) => differenceInDays(new Date(), new Date(l.updated_at)) >= 30
    );
  }, [listings, filterStale]);

  const oldDraftCount = useMemo(
    () => listings.filter((l) => differenceInDays(new Date(), new Date(l.updated_at)) >= 90).length,
    [listings]
  );

  const handleDelete = async () => {
    if (!listingToDelete || listingToDelete.status !== "draft") return;
    setIsDeleting(true);
    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", listingToDelete.id)
      .eq("status", "draft");

    if (error) {
      toast.error("Failed to delete draft");
      console.error("Delete draft error:", error);
    } else {
      toast.success("Draft deleted");
      setListings((prev) => prev.filter((l) => l.id !== listingToDelete.id));
    }
    setIsDeleting(false);
    setListingToDelete(null);
  };

  if (authLoading || loading) {
    return <LoadingScreen message="Loading drafts..." />;
  }

  const renderAgeBadge = (updatedAt: string) => {
    const badge = getDraftAgeBadge(updatedAt);
    if (!badge) return null;
    return (
      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="Drafts"
        subtitle="Manage your saved drafts."
        backTo="/agent/listings"
      />

      {/* Action Row */}
      <div className="mb-4 flex items-center gap-3">
        <Button
          onClick={() => navigate("/agent/listings/new")}
          className="gap-2 bg-black hover:bg-zinc-900 text-emerald-400 hover:text-emerald-300 font-display font-medium tracking-wide"
        >
          <Plus className="h-4 w-4" />
          New Listing
        </Button>

        {/* Stale filter toggle */}
        <div className="inline-flex items-center border border-zinc-200 rounded-lg p-0.5 bg-white">
          <button
            onClick={() => setFilterStale(false)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              !filterStale
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStale(true)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              filterStale
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            Stale
          </button>
        </div>

        {/* View toggle */}
        <div className="ml-auto inline-flex items-center border border-zinc-200 rounded-lg p-0.5 bg-white">
          <button
            onClick={() => setView("grid")}
            className={`p-1.5 rounded-md transition-colors ${
              view === "grid"
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-1.5 rounded-md transition-colors ${
              view === "list"
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            <ListIcon size={16} />
          </button>
        </div>
      </div>

      {/* Old drafts cleanup banner */}
      {oldDraftCount > 0 && !bannerDismissed && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1">
            You have {oldDraftCount} {oldDraftCount === 1 ? "draft" : "drafts"} older than 90 days. Consider deleting the ones you don't need.
          </span>
          <button
            onClick={() => setFilterStale(true)}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap"
          >
            Show Old Drafts
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-amber-500 hover:text-amber-700 transition"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!listingToDelete}
        onOpenChange={(open) => !open && setListingToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the draft listing. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty State */}
      {filteredListings.length === 0 && !loading && (
        <div className="text-center py-16">
          <FileText className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm mb-4">
            {filterStale ? "No stale drafts found." : "No drafts yet."}
          </p>
          {!filterStale && (
            <Button
              variant="outline"
              onClick={() => navigate("/agent/listings/new")}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New Listing
            </Button>
          )}
          {filterStale && (
            <Button
              variant="outline"
              onClick={() => setFilterStale(false)}
              className="gap-2"
            >
              Show All Drafts
            </Button>
          )}
        </div>
      )}

      {/* GRID VIEW */}
      {view === "grid" && filteredListings.length > 0 && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            return (
              <CardSurface key={l.id} interactive className="cursor-pointer">
                <div
                  className="w-full h-48 bg-zinc-100 overflow-hidden"
                  onClick={() => navigate(`/agent/listings/edit/${l.id}`)}
                >
                  <img
                    src={thumbnail || "/placeholder.svg"}
                    alt={l.address}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="font-semibold text-base text-zinc-900">
                    {formatAddressWithUnit(l)}
                  </div>
                  <div className="text-zinc-500 text-sm mt-0.5">
                    {l.state} {l.zip_code}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <ListingStatusBadge status="draft" size="sm" />
                    {l.listing_type && (
                      <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        {LISTING_TYPE_LABELS[l.listing_type] || l.listing_type}
                      </span>
                    )}
                    {renderAgeBadge(l.updated_at)}
                  </div>
                  {l.price > 0 && (
                    <div className="text-zinc-600 text-sm mt-2 font-medium">
                      ${l.price.toLocaleString()}
                    </div>
                  )}
                  <div className="text-xs text-zinc-400 mt-1">
                    Updated {formatRelativeTime(l.updated_at)}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <button
                      className="text-zinc-600 hover:text-emerald-700 transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/agent/listings/edit/${l.id}`);
                      }}
                    >
                      Edit
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="text-red-500 hover:text-red-700 transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        setListingToDelete(l);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </CardSurface>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && filteredListings.length > 0 && (
        <div className="mt-2 space-y-4">
          {filteredListings.map((l) => {
            const thumbnail = getThumbnailUrl(l);
            return (
              <CardSurface key={l.id} className="relative p-4">
                {/* Action links */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <button
                      className="hover:text-emerald-700 transition flex items-center gap-1"
                      onClick={() => navigate(`/agent/listings/edit/${l.id}`)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Draft
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      className="hover:text-red-600 transition flex items-center gap-1 text-red-500"
                      onClick={() => setListingToDelete(l)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status badges – top-right */}
                <div className="absolute top-4 right-4 text-right space-y-0.5">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    <ListingStatusBadge status="draft" size="sm" />
                    {l.listing_type && (
                      <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        {LISTING_TYPE_LABELS[l.listing_type] || l.listing_type}
                      </span>
                    )}
                    {renderAgeBadge(l.updated_at)}
                  </div>
                  <div className="text-xs text-zinc-500 leading-tight pt-1">
                    Updated: {formatRelativeTime(l.updated_at)}
                  </div>
                </div>

                {/* Content row */}
                <div className="flex items-start gap-4">
                  <div
                    className="w-[140px] h-[100px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 cursor-pointer"
                    onClick={() => navigate(`/agent/listings/edit/${l.id}`)}
                  >
                    <img
                      src={thumbnail || "/placeholder.svg"}
                      alt={l.address}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div
                      className="font-semibold text-base text-zinc-900 cursor-pointer hover:text-emerald-700 transition"
                      onClick={() => navigate(`/agent/listings/edit/${l.id}`)}
                    >
                      {formatAddressWithUnit(l)}
                    </div>
                    <div className="text-zinc-500 text-sm">
                      {l.state} {l.zip_code}
                    </div>
                    {l.price > 0 && (
                      <div className="text-zinc-700 text-lg font-semibold mt-1">
                        ${l.price.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </CardSurface>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
