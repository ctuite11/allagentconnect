import { Mail, Phone } from "lucide-react";
import type { DevelopmentSalesContactRow } from "@/lib/developments/types";
import { cn } from "@/lib/utils";

export function SalesContactCard({
  contact,
  className,
}: {
  contact: DevelopmentSalesContactRow;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
        {contact.headshot_url ? (
          <img src={contact.headshot_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-400">
            {contact.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-zinc-900">{contact.name}</h3>
            {contact.is_primary ? (
              <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Primary
              </span>
            ) : null}
          </div>
          <p className="text-sm text-zinc-600">
            {[contact.title, contact.role].filter(Boolean).join(" · ") || "Sales"}
          </p>
        </div>
        {contact.bio ? <p className="text-sm leading-relaxed text-zinc-600">{contact.bio}</p> : null}
        <div className="flex flex-wrap gap-3 text-sm">
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-aac hover:underline">
              <Mail className="h-3.5 w-3.5" />
              {contact.email}
            </a>
          ) : null}
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 text-aac hover:underline">
              <Phone className="h-3.5 w-3.5" />
              {contact.phone}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
