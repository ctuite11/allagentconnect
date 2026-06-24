import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddListingStatusHelpContent } from "@/components/add-listing/AddListingStatusHelpContent";
import { cn } from "@/lib/utils";

type AddListingStatusHelpProps = {
  className?: string;
};

export function AddListingStatusHelp({ className }: AddListingStatusHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Understanding listing statuses"
          className={cn(
            "inline-flex shrink-0 rounded-md p-0.5 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40",
            className,
          )}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(92vw,24rem)] border-neutral-200 bg-white p-0 shadow-md"
      >
        <AddListingStatusHelpContent variant="popover" />
      </PopoverContent>
    </Popover>
  );
}
