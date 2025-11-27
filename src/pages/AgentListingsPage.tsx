import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutGrid,
  List as ListIcon,
  Pencil,
  ImageIcon,
  Eye,
  CalendarDays,
  DollarSign,
  Share2,
} from "lucide-react";
import { PriceDialog } from "@/components/PriceDialog";
import { OpenHouseDialog } from "@/components/OpenHouseDialog";

type ListingStatus =
  | "on_market"
  | "under_agreement"
  | "sold_rented"
  | "withdrawn"
  | "expired"
  | "canceled"
  | "offline_partial";

type ViewMode = "table" | "grid";

export interface AgentListing {
  id: string;
  mlsNumber?: string | null;
  thumbnailUrl?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  category: "for_sale" | "for_rent";
  status: ListingStatus;
  listPrice: number;
  monthlyRent?: number | null;
  dom?: number | null;
  listDate?: string | null;
  expDate?: string | null;
}

interface AgentListingsPageProps {
  listings: AgentListing[];
}

export default function AgentListingsPage({ listings }: AgentListingsPageProps) {
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">(
    "on_market",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<
    "list_date_desc" | "price_desc" | "price_asc" | "dom_desc"
  >("list_date_desc");
  const [priceDialogListing, setPriceDialogListing] = useState<AgentListing | null>(null);
  const [openHouseListing, setOpenHouseListing] = useState<AgentListing | null>(null);

  const filtered = listings
    .filter((listing) => {
      const matchesStatus =
        statusFilter === "all" ? true : listing.status === statusFilter;

      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        listing.addressLine1.toLowerCase().includes(term) ||
        listing.city.toLowerCase().includes(term) ||
        (listing.mlsNumber || "").toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      switch (sort) {
        case "price_desc":
          return b.listPrice - a.listPrice;
        case "price_asc":
          return a.listPrice - b.listPrice;
        case "dom_desc":
          return (b.dom || 0) - (a.dom || 0);
        case "list_date_desc":
        default: {
          const da = a.listDate ? new Date(a.listDate).getTime() : 0;
          const db = b.listDate ? new Date(b.listDate).getTime() : 0;
          return db - da;
        }
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Listings</h1>
          <p className="text-sm text-muted-foreground">
            Power view of all your listings across sale and rental.
          </p>
        </div>

        <div className="hidden rounded-full border bg-muted p-1 md:flex">
          <Button
            type="button"
            variant={viewMode === "table" ? "default" : "ghost"}
            size="icon"
            className="rounded-full"
            onClick={() => setViewMode("table")}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="icon"
            className="rounded-full"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant={statusFilter === tab.value ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="Search by address or MLS #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={sort}
            onValueChange={(val) =>
              setSort(
                val as
                  | "list_date_desc"
                  | "price_desc"
                  | "price_asc"
                  | "dom_desc",
              )
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list_date_desc">
                List Date (newest)
              </SelectItem>
              <SelectItem value="price_desc">Price (high → low)</SelectItem>
              <SelectItem value="price_asc">Price (low → high)</SelectItem>
              <SelectItem value="dom_desc">DOM (high → low)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            type="button"
            variant={viewMode === "table" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("table")}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <ListingsTable 
          listings={filtered} 
          onPrice={(listing) => setPriceDialogListing(listing)}
          onOpenHouse={(listing) => setOpenHouseListing(listing)}
        />
      ) : (
        <ListingsGrid listings={filtered} />
      )}

      <PriceDialog
        open={!!priceDialogListing}
        onOpenChange={(open) => !open && setPriceDialogListing(null)}
        listing={priceDialogListing}
        onSaved={() => {/* refetch or refresh listings */}}
      />
      <OpenHouseDialog
        open={!!openHouseListing}
        onOpenChange={(open) => !open && setOpenHouseListing(null)}
        listing={openHouseListing}
        onSaved={() => {/* optional refresh */}}
      />
    </div>
  );
}

const statusTabs: { label: string; value: ListingStatus | "all" }[] = [
  { label: "On Market", value: "on_market" },
  { label: "Under Agreement", value: "under_agreement" },
  { label: "Sold / Rented", value: "sold_rented" },
  { label: "Withdrawn", value: "withdrawn" },
  { label: "Expired", value: "expired" },
  { label: "Canceled", value: "canceled" },
  { label: "Offline / Partial", value: "offline_partial" },
];

function ListingsTable({ 
  listings,
  onPrice,
  onOpenHouse,
}: { 
  listings: AgentListing[];
  onPrice: (listing: AgentListing) => void;
  onOpenHouse: (listing: AgentListing) => void;
}) {
  if (!listings.length) {
    return (
      <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
        No listings found for this filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2">
              <Checkbox aria-label="Select all" />
            </th>
            <th className="w-24 px-3 py-2 text-left">Photo</th>
            <th className="px-3 py-2 text-left">Property</th>
            <th className="px-3 py-2 text-left">Status / DOM</th>
            <th className="px-3 py-2 text-left">Pricing</th>
            <th className="px-3 py-2 text-left">Dates</th>
            <th className="w-60 px-3 py-2 text-right">Quick Actions</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <ListingRow 
              key={listing.id} 
              listing={listing}
              onPrice={onPrice}
              onOpenHouse={onOpenHouse}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListingRow({ 
  listing,
  onPrice,
  onOpenHouse,
}: { 
  listing: AgentListing;
  onPrice: (listing: AgentListing) => void;
  onOpenHouse: (listing: AgentListing) => void;
}) {
  const expSoon =
    listing.expDate &&
    new Date(listing.expDate).getTime() - Date.now() <
      7 * 24 * 60 * 60 * 1000;

  const handleEdit = () => {
    console.log("Edit listing", listing.id);
    // TODO: navigate to edit page
  };

  const handlePhotos = () => {
    console.log("Manage photos for listing", listing.id);
    // TODO: navigate to photos page
  };

  const handleOpenHouse = () => {
    onOpenHouse(listing);
  };

  const handlePrice = () => {
    onPrice(listing);
  };

  const handlePreview = () => {
    console.log("Preview listing", listing.id);
    // TODO: open public listing page
  };

  const handleShare = () => {
    console.log("Share listing", listing.id);
    // TODO: open share dialog
  };

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      <td className="px-3 py-3 align-top">
        <Checkbox aria-label="Select listing" />
      </td>

      <td className="px-3 py-3 align-top">
        <div className="h-16 w-24 overflow-hidden rounded-md bg-muted">
          {listing.thumbnailUrl ? (
            <img 
              src={listing.thumbnailUrl} 
              alt={listing.addressLine1}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
      </td>

      {/* NOTE: Code was cut off in the original paste. Awaiting complete version from user. */}
      <td className="px-3 py-3 align-top">
        <div className="space-y-1">
          <div className="font-medium">{listing.addressLine1}</div>
          <div className="text-xs text-muted-foreground">
            {listing.city}, {listing.state} {listing.zip}
          </div>
          <div className="text-xs text-muted-foreground">
            {listing.propertyType}
          </div>
          {listing.mlsNumber && (
            <div className="text-xs text-muted-foreground">
              MLS# {listing.mlsNumber}
            </div>
          )}
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <div className="space-y-1">
          <Badge variant="outline">{listing.status.replace(/_/g, " ")}</Badge>
          {listing.dom !== null && (
            <div className="text-xs text-muted-foreground">
              {listing.dom} DOM
            </div>
          )}
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <div className="space-y-1">
          <div className="font-medium">
            ${listing.listPrice.toLocaleString()}
          </div>
          {listing.monthlyRent && (
            <div className="text-xs text-muted-foreground">
              ${listing.monthlyRent.toLocaleString()}/mo
            </div>
          )}
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <div className="space-y-1 text-xs text-muted-foreground">
          {listing.listDate && (
            <div>Listed: {new Date(listing.listDate).toLocaleDateString()}</div>
          )}
          {listing.expDate && (
            <div className={expSoon ? "text-destructive font-medium" : ""}>
              Exp: {new Date(listing.expDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleEdit}
            title="Edit Listing"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePrice}
            title="Change Price"
          >
            <DollarSign className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleOpenHouse}
            title="Add Open House"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePhotos}
            title="Manage Photos"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePreview}
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleShare}
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ListingsGrid({ listings }: { listings: AgentListing[] }) {
  if (!listings.length) {
    return (
      <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
        No listings found for this filter.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing) => (
        <div key={listing.id} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
            {listing.thumbnailUrl ? (
              <img 
                src={listing.thumbnailUrl} 
                alt={listing.addressLine1}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="font-medium">{listing.addressLine1}</div>
            <div className="text-sm text-muted-foreground">
              {listing.city}, {listing.state} {listing.zip}
            </div>
            <div className="text-lg font-semibold">
              ${listing.listPrice.toLocaleString()}
            </div>
            <Badge variant="outline">{listing.status.replace(/_/g, " ")}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
