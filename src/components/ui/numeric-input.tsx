import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Wheel/trackpad-safe numeric field. Renders a text input (browsers never change text values on
 * scroll) with a numeric mobile keyboard. Typing and paste keep only digits (plus one "." when
 * `decimal`), so parent onChange handlers and save-time validation see the same values as before.
 * A local draft keeps in-progress text like "2." visible when the parent stores a Number.
 */
export function sanitizeNumericInput(raw: string, decimal: boolean): string {
  if (!decimal) return raw.replace(/\D/g, "");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "inputMode"> & { decimal?: boolean };

export const NumericInput = React.forwardRef<HTMLInputElement, Props>(
  ({ decimal = false, onChange, value, step: _step, min: _min, max: _max, ...rest }, ref) => {
    const external = value === undefined || value === null ? "" : String(value);
    const [draft, setDraft] = React.useState(external);
    const shown = draft !== "" && external !== "" && Number(draft) === Number(external) ? draft : external;
    return (
      <Input
        ref={ref}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        autoComplete="off"
        {...rest}
        value={value === undefined ? undefined : shown}
        onChange={(e) => {
          const clean = sanitizeNumericInput(e.target.value, decimal);
          if (clean !== e.target.value) e.target.value = clean;
          setDraft(clean);
          onChange?.(e);
        }}
      />
    );
  },
);
NumericInput.displayName = "NumericInput";
