import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FilterPreferenceCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  summary?: ReactNode;
  emptySummary?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Slightly tighter padding for dense dialogs (Hot Sheet). */
  compact?: boolean;
}

/**
 * Shared collapsible filter card used by Communications Center preferences
 * and Hot Sheet criteria. Keep visual language identical across both surfaces.
 */
export function FilterPreferenceCard({
  icon: Icon,
  title,
  description,
  summary,
  emptySummary,
  open,
  onOpenChange,
  children,
  className,
  compact = false,
}: FilterPreferenceCardProps) {
  const hasSummary = summary != null && summary !== "";

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card
        className={cn(
          "rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md",
          compact ? "p-4" : "p-4 sm:p-5",
          className,
        )}
      >
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer p-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon className="h-5 w-5 shrink-0 !text-[#16A34A]" strokeWidth={2} aria-hidden />
                <CardTitle className="text-base font-semibold text-neutral-900">{title}</CardTitle>
              </div>
              {open ? (
                <ChevronUp className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={2} />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={2} />
              )}
            </div>
            {description ? (
              <CardDescription className="mt-1 text-left text-sm text-neutral-500">
                {description}
              </CardDescription>
            ) : null}
            {!open && hasSummary ? (
              <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left">
                <p className="text-sm font-medium text-neutral-900">{summary}</p>
              </div>
            ) : null}
            {!open && !hasSummary && emptySummary ? (
              <p className="mt-1 text-left text-sm text-neutral-500">{emptySummary}</p>
            ) : null}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className={cn("space-y-3 px-0 pb-0", compact ? "pt-3" : "pt-4")}>
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
