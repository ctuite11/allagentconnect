import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FilterCheckboxOption = {
  value: string;
  label: string;
};

interface FilterCheckboxGridProps {
  options: readonly FilterCheckboxOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
  columns?: 1 | 2;
  showSelectAll?: boolean;
  className?: string;
}

/**
 * Compact multi-select checkbox grid matching Communications Center
 * Property Type preference styling.
 */
export function FilterCheckboxGrid({
  options,
  selected,
  onChange,
  idPrefix,
  columns = 2,
  showSelectAll = true,
  className,
}: FilterCheckboxGridProps) {
  const allSelected = options.length > 0 && selected.length === options.length;

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  const selectAll = () => {
    onChange(allSelected ? [] : options.map((opt) => opt.value));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-xs text-neutral-600">
        {selected.length} of {options.length} selected
      </span>

      <div
        className={cn(
          "grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3",
          columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
        )}
      >
        {showSelectAll ? (
          <div
            className={cn(
              "col-span-1 -mx-2 mb-2 flex items-center space-x-2 rounded-lg border-b border-neutral-200 px-2 py-1.5 pb-2 transition-colors hover:bg-neutral-50/80",
              columns === 2 && "md:col-span-2",
              allSelected && "bg-neutral-50",
            )}
          >
            <Checkbox
              id={`${idPrefix}-select-all`}
              checked={allSelected}
              onCheckedChange={selectAll}
            />
            <Label
              htmlFor={`${idPrefix}-select-all`}
              className={cn(
                "flex-1 cursor-pointer text-sm",
                allSelected ? "font-medium text-neutral-900" : "text-neutral-600",
              )}
            >
              Select all
            </Label>
          </div>
        ) : null}

        {options.map((option) => {
          const isChecked = selected.includes(option.value);
          return (
            <div
              key={option.value}
              className={cn(
                "-mx-2 flex items-center space-x-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50/80",
                isChecked && "bg-neutral-50",
              )}
            >
              <Checkbox
                id={`${idPrefix}-${option.value}`}
                checked={isChecked}
                onCheckedChange={() => toggle(option.value)}
              />
              <Label
                htmlFor={`${idPrefix}-${option.value}`}
                className={cn(
                  "flex-1 cursor-pointer text-sm",
                  isChecked ? "font-medium text-neutral-900" : "text-neutral-600",
                )}
              >
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
