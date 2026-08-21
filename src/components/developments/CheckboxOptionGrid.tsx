import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CheckboxOption = { value: string; label: string };

export function CheckboxOptionGrid({
  options,
  value,
  onChange,
  disabled,
  columnsClassName = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  options: CheckboxOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  columnsClassName?: string;
}) {
  const selected = new Set(value);

  const toggle = (optionValue: string, checked: boolean) => {
    if (checked) onChange([...value, optionValue]);
    else onChange(value.filter((v) => v !== optionValue));
  };

  return (
    <div className={cn("grid gap-2", columnsClassName)}>
      {options.map((option) => {
        const id = `opt-${option.value}`;
        const isOn = selected.has(option.value);
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
              isOn ? "border-emerald-300 bg-emerald-50/60" : "border-zinc-200 bg-white hover:border-zinc-300",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <Checkbox
              id={id}
              checked={isOn}
              disabled={disabled}
              onCheckedChange={(state) => toggle(option.value, state === true)}
              className="mt-0.5"
            />
            <span className="leading-snug text-zinc-800">
              <Label htmlFor={id} className="cursor-pointer font-medium text-zinc-900">
                {option.label}
              </Label>
            </span>
          </label>
        );
      })}
    </div>
  );
}
