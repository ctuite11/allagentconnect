import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Share2, Trash2, MessageSquare, Pencil, Play } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { formatDistanceToNow } from "date-fns";

interface HotSheetCardProps {
  id: string;
  name: string;
  criteria: any;
  clients: any[];
  lastSentAt?: string | null;
  onEdit: (id: string) => void;
  onShare: (id: string) => void;
  onComments: (id: string) => void;
  onDelete: (id: string) => void;
}

export const HotSheetCard = ({
  id,
  name,
  criteria,
  clients,
  lastSentAt,
  onEdit,
  onShare,
  onComments,
  onDelete,
}: HotSheetCardProps) => {
  const navigate = useNavigate();
  const primaryClient = clients[0];

  const clientName = primaryClient
    ? [primaryClient.first_name, primaryClient.last_name].filter(Boolean).join(" ")
    : ([criteria?.clientFirstName, criteria?.clientLastName].filter(Boolean).join(" ") || null);

  const clientEmail = primaryClient?.email || criteria?.clientEmail || null;
  const clientPhone = primaryClient?.phone || criteria?.clientPhone || null;

  const handleCardClick = () => {
    navigate(`/hot-sheets/${id}/review`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white border border-neutral-200 rounded-2xl px-5 py-3 shadow-sm hover:shadow-md hover:border-neutral-300 hover:-translate-y-[1px] transition-all cursor-pointer"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        {/* Left: Details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-neutral-800 truncate">
            {name}
          </h3>
          <p className="text-sm text-neutral-600 truncate">
            {clientName || "No contact assigned"}
          </p>
          {(clientEmail || clientPhone) && (
            <p className="text-sm text-muted-foreground truncate">
              {[clientEmail, clientPhone ? formatPhoneNumber(clientPhone) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {lastSentAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last run: {formatDistanceToNow(new Date(lastSentAt), { addSuffix: true })}
            </p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Primary & Secondary Buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); navigate(`/hot-sheets/${id}/review`); }}
            >
              <Play className="h-4 w-4 mr-1.5" />
              Show Results
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onEdit(id); }}
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          </div>

          {/* Icon Actions: Share, Message | Delete (separated) */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onShare(id); }}
              title="Share"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onComments(id); }}
              title="Comments"
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </Button>
            <div className="w-px h-5 bg-neutral-200 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
