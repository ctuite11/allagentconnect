import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListingAgentEmailContact } from "@/components/listing/ListingAgentEmailContact";
import type { ListingAgentContact } from "@/lib/listingAgentContact";

type ListingCardAttributionStripProps = {
  brokerageName?: string | null;
  contact?: ListingAgentContact | null;
  defaultSubject?: string;
  className?: string;
};

/** Single-row brokerage (left) + listing-agent email (right) for compact result cards. */
export function ListingCardAttributionStrip({
  brokerageName,
  contact,
  defaultSubject,
  className,
}: ListingCardAttributionStripProps) {
  const brokerage = brokerageName?.trim() || null;
  if (!brokerage && !contact) return null;

  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {brokerage ? (
          <>
            <Building2 className="h-3 w-3 shrink-0 text-neutral-400" strokeWidth={1.75} aria-hidden />
            <span
              className="truncate text-[11px] font-normal leading-none text-neutral-500"
              title={brokerage}
            >
              {brokerage}
            </span>
          </>
        ) : null}
      </div>
      {contact ? (
        <div className="shrink-0">
          <ListingAgentEmailContact
            contact={contact}
            defaultSubject={defaultSubject}
            className="leading-none"
          />
        </div>
      ) : null}
    </div>
  );
}
