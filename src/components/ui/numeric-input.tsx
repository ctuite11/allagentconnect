import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Wheel/trackpad-safe numeric field. Renders a text input (browsers never change text values on
 * scroll) with a numeric mobile keyboard. Typing and paste keep only digits (plus one "." when
 * `decimal`), so parent onChange handlers and save-time validation see the same strings as before.
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
  ({ decimal = false, onChange, step: _step, min: _min, max: _max, ...rest }, ref) => (
    <Input
      ref={ref}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete="off"
      {...rest}
      onChange={(e) => {
        const clean = sanitizeNumericInput(e.target.value, decimal);
        if (clean !== e.target.value) e.target.value = clean;
        onChange?.(e);
      }}
    />
  ),
);
NumericInput.displayName = "NumericInput";
