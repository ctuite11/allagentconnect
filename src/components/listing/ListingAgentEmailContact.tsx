import { useState } from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailAgentDialog } from "@/components/admin/EmailAgentDialog";
import type { ListingAgentContact } from "@/lib/listingAgentContact";

type ListingAgentEmailContactProps = {
  contact: ListingAgentContact;
  defaultSubject?: string;
  className?: string;
};

/**
 * Compact list-agent email affordance for agent-only result cards.
 * Opens {@link EmailAgentDialog} → `send-bulk-email` (internal queue).
 */
export function ListingAgentEmailContact({
  contact,
  defaultSubject,
  className,
}: ListingAgentEmailContactProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-sm text-[11px] font-medium leading-tight text-neutral-800 transition-colors hover:text-neutral-950",
          className,
        )}
        aria-label={`Email ${contact.agentName}`}
      >
        <span className="min-w-0 truncate">{contact.agentName}</span>
        <Mail className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" strokeWidth={2} aria-hidden />
      </button>
      <EmailAgentDialog
        open={open}
        onOpenChange={setOpen}
        recipients={[
          {
            id: contact.agentId,
            email: contact.agentEmail,
            name: contact.agentName,
          },
        ]}
        defaultSubject={defaultSubject}
        showTemplatePicker={false}
      />
    </>
  );
}
