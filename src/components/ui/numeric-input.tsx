import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

/**
 * Wheel/trackpad-safe numeric field. Renders a text input (browsers never change text values on
 * scroll) with a numeric mobile keyboard. Typing and paste keep only digits (plus one "." when
 * `decimal`). The field's min/max/step are kept as real validation (setCustomValidity), matching
 * what the old number input enforced; forms check them with `blockIfInvalidNumericFields`.
 */
export function sanitizeNumericInput(raw: string, decimal: boolean): string {
  if (!decimal) return raw.replace(/\D/g, "");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

type Limit = string | number | undefined;

/** Year Built bounds: optional, but if entered a four-digit year from 1600 through next year. */
export const YEAR_BUILT_MIN = 1600;
export const yearBuiltMax = () => new Date().getFullYear() + 1;

/** Same rules as a browser number input: min, max, and step (default 1) counted from min (or 0). */
export function numericValidationMessage(text: string, min: Limit, max: Limit, step: Limit): string {
  if (text.trim() === "") return "";
  const n = Number(text);
  if (!Number.isFinite(n)) return "Please enter a number.";
  const lo = min === undefined || min === "" ? undefined : Number(min);
  const hi = max === undefined || max === "" ? undefined : Number(max);
  if (lo !== undefined && n < lo) return `Value must be ${lo} or more.`;
  if (hi !== undefined && n > hi) return `Value must be ${hi} or less.`;
  if (step !== "any") {
    const s = step === undefined || step === "" ? 1 : Number(step);
    const base = lo ?? 0;
    const k = (n - base) / s;
    if (Math.abs(k - Math.round(k)) > 1e-9) {
      return s === 1 ? "Please enter a whole number." : `Please enter a value in steps of ${s}.`;
    }
  }
  return "";
}

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "inputMode"> & { decimal?: boolean };

export const NumericInput = React.forwardRef<HTMLInputElement, Props>(
  ({ decimal = false, onChange, value, step, min, max, ...rest }, ref) => {
    const external = value === undefined || value === null ? "" : String(value);
    const [draft, setDraft] = React.useState(external);
    const shown = draft !== "" && external !== "" && Number(draft) === Number(external) ? draft : external;
    const inner = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle(ref, () => inner.current as HTMLInputElement);
    const message = numericValidationMessage(value === undefined ? inner.current?.value ?? "" : shown, min, max, step);
    React.useEffect(() => {
      inner.current?.setCustomValidity(message);
    }, [message]);
    return (
      <Input
        ref={inner}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        autoComplete="off"
        data-numeric-input=""
        aria-invalid={message ? true : undefined}
        title={message || rest.title}
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

/**
 * Save/Publish guard: if any NumericInput on the page breaks its min/max/step, focus it, show its
 * message, and return true so the caller stops. Needed because these forms save via plain buttons,
 * which skip the browser's own form validation.
 */
export function blockIfInvalidNumericFields(): boolean {
  const bad = document.querySelector<HTMLInputElement>("input[data-numeric-input]:invalid");
  if (!bad) return false;
  const label = bad.id ? document.querySelector(`label[for="${CSS.escape(bad.id)}"]`)?.textContent?.trim() : "";
  toast.error(`${label ? `${label}: ` : ""}${bad.validationMessage}`);
  bad.scrollIntoView({ block: "center" });
  bad.focus({ preventScroll: true });
  return true;
}
