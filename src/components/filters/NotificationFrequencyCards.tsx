import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type NotificationFrequencyOption = {
  value: string;
  label: string;
  description: string;
};

interface NotificationFrequencyCardsProps {
  value: string;
  onChange: (next: string) => void;
  options: readonly NotificationFrequencyOption[];
  title?: string;
  description?: string;
  /** Optional "Also email me a copy" row for Hot Sheet. */
  alsoEmailMe?: boolean;
  onAlsoEmailMeChange?: (next: boolean) => void;
  alsoEmailMeId?: string;
  className?: string;
}

/**
 * Shared notification-frequency card grid from Communications Center.
 * Options are passed in so Hot Sheet can keep `immediately` while Comms keeps `immediate`.
 */
export function NotificationFrequencyCards({
  value,
  onChange,
  options,
  title = "Email frequency",
  description = "Choose when matching updates are emailed.",
  alsoEmailMe,
  onAlsoEmailMeChange,
  alsoEmailMeId = "also-email-me",
  className,
}: NotificationFrequencyCardsProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md",
        className,
      )}
    >
      <CardHeader className="space-y-1 p-0">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 shrink-0 !text-[#16A34A]" strokeWidth={2} aria-hidden />
          <CardTitle className="text-base font-semibold text-neutral-900">{title}</CardTitle>
        </div>
        {description ? (
          <p className="text-[13px] leading-relaxed text-neutral-500">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="mt-4 grid grid-cols-1 gap-2 p-0 sm:grid-cols-3">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-start rounded-xl border bg-white px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-[#0E56F5] ring-1 ring-[#0E56F5]/20"
                  : "border-neutral-200 hover:border-neutral-300",
              )}
            >
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  active ? "text-[#0E56F5]" : "text-neutral-900",
                )}
              >
                {option.label}
              </span>
              <span className="mt-0.5 text-xs text-neutral-500">{option.description}</span>
            </button>
          );
        })}
      </CardContent>

      {typeof alsoEmailMe === "boolean" && onAlsoEmailMeChange ? (
        <div className="mt-4 flex items-center space-x-2 border-t border-neutral-100 pt-4">
          <Checkbox
            id={alsoEmailMeId}
            checked={alsoEmailMe}
            onCheckedChange={(checked) => onAlsoEmailMeChange(checked === true)}
          />
          <Label htmlFor={alsoEmailMeId} className="cursor-pointer text-sm text-neutral-800">
            Also email me a copy
          </Label>
        </div>
      ) : null}
    </Card>
  );
}
