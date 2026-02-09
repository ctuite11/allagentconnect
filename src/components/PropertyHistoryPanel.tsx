import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, History, DollarSign, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PropertyHistoryEntry {
  listing_id: string;
  listing_type: string;
  status: string;
  price: number;
  created_at: string;
  active_date: string | null;
  expiration_date: string | null;
  cancelled_at: string | null;
  property_type: string | null;
  is_relisting: boolean;
  original_listing_id: string | null;
  agent_name: string | null;
  office_name: string | null;
  status_history: { old_status: string | null; new_status: string; changed_at: string }[];
  price_history: { old_price: number; new_price: number; changed_at: string }[];
}

interface PropertyHistoryPanelProps {
  address: string;
  city: string;
  state: string;
  unitNumber?: string | null;
  attomId?: string | null;
  currentListingId: string;
}

export function PropertyHistoryPanel({
  address,
  city,
  state,
  unitNumber,
  attomId,
  currentListingId,
}: PropertyHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PropertyHistoryEntry[] | null>(null);

  useEffect(() => {
    // Only fetch when panel is first opened
    if (!open || entries !== null) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          address,
          city,
          state,
          exclude_listing_id: currentListingId,
        });
        if (unitNumber) params.set("unit_number", unitNumber);
        if (attomId) params.set("attom_id", attomId);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-property-history?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch property history (${res.status})`);
        }

        const json = await res.json();
        setEntries(json.listings || []);
      } catch (err: any) {
        console.error("Property history fetch error:", err);
        setError("Unable to load property history.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, entries, address, city, state, unitNumber, attomId, currentListingId]);

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPrice = (p: number) => `$${p.toLocaleString()}`;

  const getListingTypeLabel = (type: string) => {
    if (type === "for_rent") return "For Rent";
    if (type === "for_sale") return "For Sale";
    return type;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="bg-card border-border rounded-xl shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl">
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Property History
              </span>
              {open ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {error && (
              <p className="text-sm text-muted-foreground">{error}</p>
            )}

            {!loading && !error && entries !== null && entries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No prior listing history for this property.
              </p>
            )}

            {!loading && !error && entries !== null && entries.length > 0 && (
              <div className="space-y-4">
                {entries.map((entry, idx) => (
                  <div key={entry.listing_id}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="space-y-2">
                      {/* Header row */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {getListingTypeLabel(entry.listing_type)}
                          </span>
                          <ListingStatusBadge status={entry.status} size="sm" />
                          {entry.is_relisting && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                              Relisting
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {formatPrice(entry.price)}
                        </span>
                      </div>

                      {/* Dates row */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Created: {formatDate(entry.created_at)}</span>
                        {entry.active_date && (
                          <span>Active: {formatDate(entry.active_date)}</span>
                        )}
                        {entry.expiration_date && (
                          <span>Expires: {formatDate(entry.expiration_date)}</span>
                        )}
                        {entry.cancelled_at && (
                          <span>Cancelled: {formatDate(entry.cancelled_at)}</span>
                        )}
                      </div>

                      {/* Agent */}
                      {entry.agent_name && (
                        <p className="text-xs text-muted-foreground">
                          Agent: {entry.agent_name}
                          {entry.office_name && `, ${entry.office_name}`}
                        </p>
                      )}

                      {/* Status timeline (compact) */}
                      {entry.status_history.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground mt-1">
                          {entry.status_history.map((sh, i) => (
                            <span key={i} className="flex items-center gap-0.5">
                              {i > 0 && <ArrowRight className="w-3 h-3 flex-shrink-0" />}
                              <span className="capitalize">{sh.new_status.replace(/_/g, " ")}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Price changes */}
                      {entry.price_history.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {entry.price_history.map((ph, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                            >
                              <DollarSign className="w-3 h-3 flex-shrink-0" />
                              {formatPrice(ph.old_price)}
                              <ArrowRight className="w-3 h-3 flex-shrink-0" />
                              {formatPrice(ph.new_price)}
                              <span className="text-[10px]">
                                ({formatDate(ph.changed_at)})
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
