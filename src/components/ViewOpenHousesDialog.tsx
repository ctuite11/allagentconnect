import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, Trash2 } from "lucide-react";

interface OpenHouse {
  date: string;
  start_time: string;
  end_time: string;
  event_type: "in_person" | "broker_tour";
  comments?: string;
}

interface ViewOpenHousesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    mlsNumber?: string;
  } | null;
  onDeleted?: () => void;
}

export function ViewOpenHousesDialog({
  open,
  onOpenChange,
  listing,
  onDeleted,
}: ViewOpenHousesDialogProps) {
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && listing) {
      fetchOpenHouses();
    }
  }, [open, listing]);

  const fetchOpenHouses = async () => {
    if (!listing) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("open_houses")
        .eq("id", listing.id)
        .single();

      if (error) throw error;

      const houses = (data?.open_houses as any[]) || [];
      setOpenHouses(houses);
    } catch (error) {
      console.error("Error fetching open houses:", error);
      toast.error("Failed to load open houses");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (index: number) => {
    if (!listing) return;
    if (!confirm("Are you sure you want to delete this open house/broker tour?")) return;

    try {
      const updatedOpenHouses = openHouses.filter((_, i) => i !== index);

      const { error } = await supabase
        .from("listings")
        .update({ open_houses: updatedOpenHouses as any })
        .eq("id", listing.id);

      if (error) throw error;

      setOpenHouses(updatedOpenHouses);
      toast.success("Open house deleted");
      if (onDeleted) onDeleted();
    } catch (error) {
      console.error("Error deleting open house:", error);
      toast.error("Failed to delete");
    }
  };

  const formatEventType = (type: string): { label: string; emoji: string; colorClass: string } => {
    switch (type) {
      case "in_person":
        return { label: "Public Open House", emoji: "🎈", colorClass: "bg-green-100 text-green-700" };
      case "broker_tour":
        return { label: "Broker Tour", emoji: "🚗", colorClass: "bg-purple-100 text-purple-700" };
      default:
        return { label: type, emoji: "", colorClass: "bg-gray-100 text-gray-700" };
    }
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formattedAddress = listing
    ? `${listing.addressLine1}, ${listing.city}, ${listing.state} ${listing.zip}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scheduled Open Houses & Broker Tours</DialogTitle>
          {listing && (
            <DialogDescription>
              {formattedAddress}
              {listing.mlsNumber && (
                <>
                  <br />
                  MLS #: {listing.mlsNumber}
                </>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : openHouses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No open houses or broker tours scheduled yet.
            </div>
          ) : (
            openHouses.map((house, index) => (
              <div
                key={index}
                className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    {/* Event Type Badge */}
                    <div className="flex items-center gap-2">
                      {(() => {
                        const typeInfo = formatEventType(house.event_type);
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${typeInfo.colorClass}`}
                          >
                            <span>{typeInfo.emoji}</span>
                            {typeInfo.label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {new Date(house.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-foreground">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {formatTime(house.start_time)} - {formatTime(house.end_time)}
                        </span>
                      </div>
                    </div>

                    {/* Comments */}
                    {house.comments && (
                      <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                        {house.comments}
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(index)}
                    className="p-2 rounded-md hover:bg-destructive/10 text-destructive transition ml-2"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
