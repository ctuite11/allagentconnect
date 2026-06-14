import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mail, Phone } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export interface RecipientRow {
  id: string;
  name: string;
  brokerage: string | null;
  phone: string | null;
  email: string | null;
}

interface RecipientListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: RecipientRow[];
  loading?: boolean;
}

/** Read-only modal listing agents who will / did receive a comms broadcast. */
export function RecipientListDialog({
  open,
  onOpenChange,
  recipients,
  loading,
}: RecipientListDialogProps) {
  const count = recipients.length;
  const location = useLocation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden border border-neutral-200 bg-white p-0">
        <DialogHeader className="border-b border-neutral-200 px-6 py-5">
          <DialogTitle className="text-base font-semibold text-neutral-900">
            Recipients
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            {loading
              ? "Loading recipients…"
              : `${count} ${count === 1 ? "agent" : "agents"} will receive this message.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">Loading…</div>
          ) : count === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">
              No recipients match your criteria yet.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {recipients.map((r) => (
                <li key={r.id} className="px-6 py-4">
                  <Link
                    to={`/agent/${r.id}`}
                    state={{ from: location.pathname + location.search }}
                    onClick={() => onOpenChange(false)}
                    className="text-sm font-semibold text-neutral-900 hover:text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                  {r.brokerage && (
                    <p className="mt-0.5 text-xs text-neutral-500">{r.brokerage}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
                    {r.phone && (
                      <a
                        href={`tel:${r.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {r.phone}
                      </a>
                    )}
                    {r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary"
                      >
                        <Mail className="h-3 w-3" />
                        {r.email}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}