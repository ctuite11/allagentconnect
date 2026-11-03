import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type PriceRangeFieldValue = {
  minPrice: string;
  maxPrice: string;
  hasNoMin: boolean;
  hasNoMax: boolean;
};

interface PriceRangeFieldsProps {
  value: PriceRangeFieldValue;
  onChange: (next: PriceRangeFieldValue) => void;
  idPrefix?: string;
  className?: string;
  /** When true, show the closed-card style summary strip below the inputs. */
  showLiveSummary?: boolean;
}

const formatNumberWithCommas = (value: string) => {
  if (!value) return "";
  const numericValue = value.replace(/,/g, "");
  const num = parseFloat(numericValue);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

const getRawValue = (value: string) => value.replace(/,/g, "");

const formatDisplayPrice = (price: string) => {
  if (!price) return "";
  const num = parseFloat(getRawValue(price));
  if (isNaN(num)) return price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export function getPriceRangeSummary(value: PriceRangeFieldValue): string {
  const { minPrice, maxPrice, hasNoMin, hasNoMax } = value;
  if (hasNoMin && hasNoMax) return "No Minimum - No Maximum";
  if (!hasNoMin && !hasNoMax && minPrice && maxPrice) {
    return `${formatDisplayPrice(minPrice)} - ${formatDisplayPrice(maxPrice)}`;
  }
  if (hasNoMin && !hasNoMax && maxPrice) return `No Minimum - ${formatDisplayPrice(maxPrice)}`;
  if (!hasNoMin && hasNoMax && minPrice) return `${formatDisplayPrice(minPrice)} - No Maximum`;
  if (!hasNoMin && minPrice) return `${formatDisplayPrice(minPrice)}+`;
  if (!hasNoMax && maxPrice) return `Up to ${formatDisplayPrice(maxPrice)}`;
  return "";
}

/**
 * Controlled price-range fields matching Communications Center Price Range UI.
 * Accepts string prices (Hot Sheet FormattedInput style or comma-formatted).
 */
export function PriceRangeFields({
  value,
  onChange,
  idPrefix = "price",
  className,
  showLiveSummary = true,
}: PriceRangeFieldsProps) {
  const [errors, setErrors] = useState<{ minPrice?: string; maxPrice?: string }>({});

  const patch = (partial: Partial<PriceRangeFieldValue>) => {
    onChange({ ...value, ...partial });
  };

  const handleMinChange = (raw: string) => {
    const sanitized = raw.replace(/[^\d,]/g, "");
    const numericValue = sanitized.replace(/,/g, "");
    const num = parseFloat(numericValue);
    if (!isNaN(num) && num > 999999999) return;
    const formatted = numericValue ? formatNumberWithCommas(numericValue) : "";
    patch({
      minPrice: formatted,
      hasNoMin: numericValue ? false : value.hasNoMin,
    });
    if (errors.minPrice) setErrors((prev) => ({ ...prev, minPrice: undefined }));
  };

  const handleMaxChange = (raw: string) => {
    const sanitized = raw.replace(/[^\d,]/g, "");
    const numericValue = sanitized.replace(/,/g, "");
    const num = parseFloat(numericValue);
    if (!isNaN(num) && num > 999999999) return;
    const formatted = numericValue ? formatNumberWithCommas(numericValue) : "";
    patch({
      maxPrice: formatted,
      hasNoMax: numericValue ? false : value.hasNoMax,
    });
    if (errors.maxPrice) setErrors((prev) => ({ ...prev, maxPrice: undefined }));
  };

  const validate = () => {
    const next: { minPrice?: string; maxPrice?: string } = {};
    const minRaw = getRawValue(value.minPrice);
    const maxRaw = getRawValue(value.maxPrice);
    if (minRaw && isNaN(parseFloat(minRaw))) next.minPrice = "Must be a valid number";
    if (maxRaw && isNaN(parseFloat(maxRaw))) next.maxPrice = "Must be a valid number";
    if (minRaw && maxRaw && parseFloat(minRaw) > parseFloat(maxRaw)) {
      next.maxPrice = "Minimum price cannot be greater than maximum price";
    }
    setErrors(next);
  };

  const summary = getPriceRangeSummary(value);
  const isAllPriceRanges = value.hasNoMin && value.hasNoMax;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-min`} className="text-sm text-neutral-600">
            Minimum Price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
            <Input
              id={`${idPrefix}-min`}
              type="text"
              inputMode="numeric"
              value={value.minPrice}
              onChange={(e) => handleMinChange(e.target.value)}
              onBlur={validate}
              placeholder="100,000"
              className={cn(
                "border-neutral-200 bg-white pl-7",
                errors.minPrice && "border-destructive",
              )}
              maxLength={15}
              disabled={value.hasNoMin}
            />
          </div>
          <div className="mt-1 flex items-center space-x-1.5">
            <Checkbox
              id={`${idPrefix}-no-min`}
              checked={value.hasNoMin}
              onCheckedChange={(checked) => {
                const active = !!checked;
                patch({ hasNoMin: active, minPrice: active ? "" : value.minPrice });
                if (active) setErrors((prev) => ({ ...prev, minPrice: undefined }));
              }}
            />
            <label
              htmlFor={`${idPrefix}-no-min`}
              className={cn(
                "cursor-pointer text-sm",
                value.hasNoMin ? "font-medium text-neutral-900" : "text-neutral-600",
              )}
            >
              No Minimum
            </label>
          </div>
          {errors.minPrice ? <p className="text-sm text-destructive">{errors.minPrice}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-max`} className="text-sm text-neutral-600">
            Maximum Price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
            <Input
              id={`${idPrefix}-max`}
              type="text"
              inputMode="numeric"
              value={value.maxPrice}
              onChange={(e) => handleMaxChange(e.target.value)}
              onBlur={validate}
              placeholder="500,000"
              className={cn(
                "border-neutral-200 bg-white pl-7",
                errors.maxPrice && "border-destructive",
              )}
              maxLength={15}
              disabled={value.hasNoMax}
            />
          </div>
          <div className="mt-1 flex items-center space-x-1.5">
            <Checkbox
              id={`${idPrefix}-no-max`}
              checked={value.hasNoMax}
              onCheckedChange={(checked) => {
                const active = !!checked;
                patch({ hasNoMax: active, maxPrice: active ? "" : value.maxPrice });
                if (active) setErrors((prev) => ({ ...prev, maxPrice: undefined }));
              }}
            />
            <label
              htmlFor={`${idPrefix}-no-max`}
              className={cn(
                "cursor-pointer text-sm",
                value.hasNoMax ? "font-medium text-neutral-900" : "text-neutral-600",
              )}
            >
              No Maximum
            </label>
          </div>
          {errors.maxPrice ? <p className="text-sm text-destructive">{errors.maxPrice}</p> : null}
        </div>
      </div>

      {showLiveSummary && summary ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <p className="text-sm">
            <span className="font-medium text-neutral-600">Price range:</span>
            <br />
            <span className="font-medium text-neutral-900">
              {isAllPriceRanges ? "No Minimum - No Maximum" : summary}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
