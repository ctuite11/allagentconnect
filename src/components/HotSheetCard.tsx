import { Button } from "@/components/ui/button";
import { Share2, Trash2, MessageSquare, Send, Pencil, Play } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface HotSheetCardProps {
  id: string;
  name: string;
  criteria: any;
  clients: any[];
  onShowResults: (id: string) => void;
  onEdit: (id: string) => void;
  onShare: (id: string) => void;
  onSendUpdate: (id: string) => void;
  onComments: (id: string) => void;
  onDelete: (id: string) => void;
}

export const HotSheetCard = ({
  id,
  name,
  criteria,
  clients,
  onShowResults,
  onEdit,
  onShare,
  onSendUpdate,
  onComments,
  onDelete,
}: HotSheetCardProps) => {
  const primaryClient = clients[0];

  const clientName = primaryClient
    ? [primaryClient.first_name, primaryClient.last_name].filter(Boolean).join(" ")
    : ([criteria?.clientFirstName, criteria?.clientLastName].filter(Boolean).join(" ") || null);

  const clientEmail = primaryClient?.email || criteria?.clientEmail || null;
  const clientPhone = primaryClient?.phone || criteria?.clientPhone || null;

  const handleCardClick = () => {
    onShowResults(id);
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white border border-neutral-200 rounded-2xl p-5 md:p-5 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all cursor-pointer"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-neutral-800 truncate mb-1">
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
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3" onClick={stopPropagation}>
          {/* Primary Buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => onShowResults(id)}
            >
              <Play className="h-4 w-4 mr-1.5" />
              Show Results
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(id)}
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          </div>

          {/* Icon Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onShare(id)}
              title="Share"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onSendUpdate(id)}
              title="Send Update"
            >
              <Send className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onComments(id)}
              title="Comments"
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDelete(id)}
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
