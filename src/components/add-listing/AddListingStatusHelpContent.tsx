import { ADD_LISTING_STATUS_INTRO } from "@/lib/addListingStatusHelp";
import { cn } from "@/lib/utils";

type AddListingStatusHelpContentProps = {
  className?: string;
  /** Popover uses compact padding; modal uses roomier spacing. */
  variant?: "popover" | "modal";
};

export function AddListingStatusHelpContent({
  className,
  variant = "popover",
}: AddListingStatusHelpContentProps) {
  const isModal = variant === "modal";

  return (
    <div className={cn(isModal ? "space-y-5" : "space-y-0", className)}>
      {!isModal ? (
        <div className="border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">{ADD_LISTING_STATUS_INTRO.title}</p>
          <p className="mt-0.5 text-xs leading-snug text-neutral-500">{ADD_LISTING_STATUS_INTRO.body}</p>
        </div>
      ) : null}

      <div
        className={cn(
          isModal ? "space-y-4" : "max-h-[min(60vh,20rem)] space-y-3 overflow-y-auto px-4 py-3",
        )}
      >
        {isModal ? (
          <p className="text-[13px] leading-relaxed text-zinc-600 sm:text-sm">{ADD_LISTING_STATUS_INTRO.body}</p>
        ) : null}

        <ul className={cn("space-y-2.5", isModal && "space-y-3")}>
          {ADD_LISTING_STATUS_INTRO.bullets.map(({ label, description }) => (
            <li
              key={label}
              className={cn(
                "text-[13px] leading-snug text-zinc-700",
                isModal && "flex items-start gap-2.5",
              )}
            >
              {isModal ? (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              ) : null}
              <span>
                <span className="font-semibold text-neutral-900">{label}</span>
                {" — "}
                {description}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={cn(
          "border-t border-neutral-100 bg-neutral-50/80",
          isModal ? "space-y-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4" : "px-4 py-3",
        )}
      >
        <p
          className={cn(
            "font-semibold text-neutral-900",
            isModal ? "text-[13px] sm:text-sm" : "text-[11px] uppercase tracking-wide text-neutral-500",
          )}
        >
          {ADD_LISTING_STATUS_INTRO.automaticHeading}
        </p>
        <ul className={cn("space-y-1.5 text-neutral-600", isModal ? "mt-2 space-y-2 text-[13px]" : "mt-1.5 text-[11px]")}>
          {ADD_LISTING_STATUS_INTRO.automaticNotes.map((note) => (
            <li key={note} className="flex gap-1.5 leading-snug">
              <span className="shrink-0 text-emerald-600" aria-hidden>
                •
              </span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
