import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CompletionMode = "quarter" | "month";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function yearOptions(span = 12): number[] {
  const start = new Date().getFullYear() - 1;
  return Array.from({ length: span + 2 }, (_, i) => start + i);
}

export function ExpectedCompletionFields({
  mode,
  onModeChange,
  year,
  quarter,
  month,
  onYearChange,
  onQuarterChange,
  onMonthChange,
  disabled,
}: {
  mode: CompletionMode;
  onModeChange: (mode: CompletionMode) => void;
  year: number | null;
  quarter: number | null;
  month: number | null;
  onYearChange: (year: number | null) => void;
  onQuarterChange: (quarter: number | null) => void;
  onMonthChange: (month: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-zinc-900">Expected completion</Label>
        <p className="mt-1 text-xs text-zinc-500">
          Choose either quarter + year or month + year — not both.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
        {(
          [
            { id: "quarter" as const, label: "Quarter + Year" },
            { id: "month" as const, label: "Month + Year" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              onModeChange(opt.id);
              if (opt.id === "quarter") onMonthChange(null);
              else onQuarterChange(null);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === opt.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900",
              disabled && "opacity-60",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {mode === "quarter" ? (
          <div className="space-y-1.5">
            <Label>Quarter</Label>
            <Select
              value={quarter ? String(quarter) : undefined}
              disabled={disabled}
              onValueChange={(v) => onQuarterChange(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select quarter" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((q) => (
                  <SelectItem key={q} value={String(q)}>
                    Q{q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Select
              value={month ? String(month) : undefined}
              disabled={disabled}
              onValueChange={(v) => onMonthChange(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Year</Label>
          <Select
            value={year ? String(year) : undefined}
            disabled={disabled}
            onValueChange={(v) => onYearChange(v ? Number(v) : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions().map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export function inferCompletionMode(parts: {
  expected_completion_quarter?: number | null;
  expected_completion_month?: number | null;
}): CompletionMode {
  if (parts.expected_completion_quarter) return "quarter";
  if (parts.expected_completion_month) return "month";
  return "quarter";
}
