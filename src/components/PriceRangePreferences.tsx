import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { z } from "zod";

export interface PriceRangeData {
  minPrice: number | null;
  maxPrice: number | null;
  hasNoMin: boolean;
  hasNoMax: boolean;
}

interface PriceRangePreferencesProps {
  agentId: string;
  onFiltersUpdated?: (hasFilters: boolean) => void;
  onDataChange?: (data: PriceRangeData) => void;
}

// Validation schema
const priceSchema = z.object({
  minPrice: z.string()
    .transform(val => val.trim())
    .refine(val => val === "" || !isNaN(parseFloat(val.replace(/,/g, ''))), {
      message: "Must be a valid number"
    })
    .refine(val => val === "" || parseFloat(val.replace(/,/g, '')) >= 0, {
      message: "Price cannot be negative"
    })
    .refine(val => val === "" || parseFloat(val.replace(/,/g, '')) <= 999999999, {
      message: "Price is too high"
    }),
  maxPrice: z.string()
    .transform(val => val.trim())
    .refine(val => val === "" || !isNaN(parseFloat(val.replace(/,/g, ''))), {
      message: "Must be a valid number"
    })
    .refine(val => val === "" || parseFloat(val.replace(/,/g, '')) >= 0, {
      message: "Price cannot be negative"
    })
    .refine(val => val === "" || parseFloat(val.replace(/,/g, '')) <= 999999999, {
      message: "Price is too high"
    })
}).refine(data => {
  if (data.minPrice && data.maxPrice) {
    const min = parseFloat(data.minPrice.replace(/,/g, ''));
    const max = parseFloat(data.maxPrice.replace(/,/g, ''));
    return min <= max;
  }
  return true;
}, {
  message: "Minimum price cannot be greater than maximum price",
  path: ["maxPrice"]
});

const PriceRangePreferences = ({ agentId, onFiltersUpdated, onDataChange }: PriceRangePreferencesProps) => {
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  // Default to unchecked - fields editable immediately
  const [hasNoMin, setHasNoMin] = useState(false);
  const [hasNoMax, setHasNoMax] = useState(false);
  const [errors, setErrors] = useState<{ minPrice?: string; maxPrice?: string }>({});
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [agentId]);

  // Format number with commas as user types
  const formatNumberWithCommas = (value: string) => {
    if (!value) return "";
    // Remove existing commas, parse, and reformat
    const numericValue = value.replace(/,/g, '');
    const num = parseFloat(numericValue);
    if (isNaN(num)) return value;
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  // Get raw numeric value from formatted string
  const getRawValue = (value: string) => {
    return value.replace(/,/g, '');
  };

  // Notify parent of data changes (no autosave)
  const notifyChange = useCallback(() => {
    const minPriceValue = minPrice.trim() ? parseFloat(getRawValue(minPrice)) : null;
    const maxPriceValue = maxPrice.trim() ? parseFloat(getRawValue(maxPrice)) : null;
    
    // Has filter if either checkbox is checked OR either price is set
    const hasFilter = hasNoMin || hasNoMax || minPriceValue !== null || maxPriceValue !== null;
    // "All price ranges" = both checkboxes checked
    const isAllPriceRanges = hasNoMin && hasNoMax;
    onFiltersUpdated?.(hasFilter && !isAllPriceRanges);
    
    onDataChange?.({
      minPrice: hasNoMin ? null : minPriceValue,
      maxPrice: hasNoMax ? null : maxPriceValue,
      hasNoMin,
      hasNoMax,
    });
  }, [minPrice, maxPrice, hasNoMin, hasNoMax, onFiltersUpdated, onDataChange]);

  useEffect(() => {
    if (!loading) {
      notifyChange();
    }
  }, [minPrice, maxPrice, hasNoMin, hasNoMax, loading, notifyChange]);

  const fetchPreferences = async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("min_price, max_price, has_no_min, has_no_max")
        .eq("user_id", agentId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        const minVal = (data as any).min_price ? (data as any).min_price.toString() : "";
        const maxVal = (data as any).max_price ? (data as any).max_price.toString() : "";
        setMinPrice(minVal ? formatNumberWithCommas(minVal) : "");
        setMaxPrice(maxVal ? formatNumberWithCommas(maxVal) : "");
        // Use explicit boolean columns, default to false (not checked) if null
        setHasNoMin((data as any).has_no_min ?? false);
        setHasNoMax((data as any).has_no_max ?? false);
      }
    } catch (error) {
      console.error("Error fetching price preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const validatePrices = (): boolean => {
    setErrors({});
    const validation = priceSchema.safeParse({ 
      minPrice: getRawValue(minPrice), 
      maxPrice: getRawValue(maxPrice) 
    });
    
    if (!validation.success) {
      const fieldErrors: { minPrice?: string; maxPrice?: string } = {};
      validation.error.errors.forEach(err => {
        const field = err.path[0] as "minPrice" | "maxPrice";
        if (field) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const handleMinPriceChange = (value: string) => {
    // Remove non-numeric characters except commas
    const sanitized = value.replace(/[^\d,]/g, '');
    const numericValue = sanitized.replace(/,/g, '');
    
    const num = parseFloat(numericValue);
    if (!isNaN(num) && num > 999999999) {
      return;
    }
    
    // Format with commas as user types
    const formatted = numericValue ? formatNumberWithCommas(numericValue) : "";
    setMinPrice(formatted);
    
    // Auto-uncheck "No Minimum" when user types a value
    if (numericValue && hasNoMin) {
      setHasNoMin(false);
    }
    
    if (errors.minPrice) {
      setErrors(prev => ({ ...prev, minPrice: undefined }));
    }
  };

  const handleMaxPriceChange = (value: string) => {
    // Remove non-numeric characters except commas
    const sanitized = value.replace(/[^\d,]/g, '');
    const numericValue = sanitized.replace(/,/g, '');
    
    const num = parseFloat(numericValue);
    if (!isNaN(num) && num > 999999999) {
      return;
    }
    
    // Format with commas as user types
    const formatted = numericValue ? formatNumberWithCommas(numericValue) : "";
    setMaxPrice(formatted);
    
    // Auto-uncheck "No Maximum" when user types a value
    if (numericValue && hasNoMax) {
      setHasNoMax(false);
    }
    
    if (errors.maxPrice) {
      setErrors(prev => ({ ...prev, maxPrice: undefined }));
    }
  };

  const handleMinPriceBlur = () => {
    validatePrices();
  };

  const handleMaxPriceBlur = () => {
    validatePrices();
  };

  const formatDisplayPrice = (price: string) => {
    if (!price) return "";
    const num = parseFloat(getRawValue(price));
    if (isNaN(num)) return price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const clearPriceRange = () => {
    setMinPrice("");
    setMaxPrice("");
    setHasNoMin(false);
    setHasNoMax(false);
    setErrors({});
  };

  const handleNoMinChange = (checked: boolean) => {
    setHasNoMin(checked);
    if (checked) {
      setMinPrice("");
      setErrors(prev => ({ ...prev, minPrice: undefined }));
    }
  };

  const handleNoMaxChange = (checked: boolean) => {
    setHasNoMax(checked);
    if (checked) {
      setMaxPrice("");
      setErrors(prev => ({ ...prev, maxPrice: undefined }));
    }
  };

  // Helper for summary text
  const getSummaryText = () => {
    if (hasNoMin && hasNoMax) {
      return "No Minimum - No Maximum";
    }
    if (!hasNoMin && !hasNoMax && minPrice && maxPrice) {
      return `${formatDisplayPrice(minPrice)} - ${formatDisplayPrice(maxPrice)}`;
    }
    if (hasNoMin && !hasNoMax && maxPrice) {
      return `No Minimum - ${formatDisplayPrice(maxPrice)}`;
    }
    if (!hasNoMin && hasNoMax && minPrice) {
      return `${formatDisplayPrice(minPrice)} - No Maximum`;
    }
    if (!hasNoMin && minPrice) {
      return `${formatDisplayPrice(minPrice)}+`;
    }
    if (!hasNoMax && maxPrice) {
      return `Up to ${formatDisplayPrice(maxPrice)}`;
    }
    return "";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const isAllPriceRanges = hasNoMin && hasNoMax;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border transition-all ${isOpen ? "border-primary bg-white" : "border-neutral-200 bg-white"}`}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-neutral-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-neutral-600" />
                <CardTitle className="text-neutral-900">Price Range</CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-neutral-400" />}
            </div>
            <CardDescription className="text-left text-neutral-600">
              Set your preferred price range for client need notifications
            </CardDescription>
            {!isOpen && getSummaryText() && (
              <div className="mt-2 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-left">
                <p className="text-sm font-medium text-neutral-900">
                  {getSummaryText()}
                </p>
              </div>
            )}
            {!isOpen && !getSummaryText() && (
              <p className="text-sm text-neutral-500 mt-1 text-left">
                No price range set
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-price" className="text-neutral-800">Minimum Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                  <Input
                    id="min-price"
                    type="text"
                    inputMode="numeric"
                    value={minPrice}
                    onChange={(e) => handleMinPriceChange(e.target.value)}
                    onBlur={handleMinPriceBlur}
                    placeholder="100,000"
                    className={`pl-7 bg-white border-neutral-200 ${errors.minPrice ? 'border-destructive' : ''}`}
                    maxLength={15}
                    disabled={hasNoMin}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="no-min"
                    checked={hasNoMin}
                    onCheckedChange={(checked) => handleNoMinChange(!!checked)}
                  />
                  <label htmlFor="no-min" className={`text-sm cursor-pointer ${hasNoMin ? "font-medium text-neutral-900" : "text-neutral-600"}`}>No Minimum</label>
                </div>
                {errors.minPrice && (
                  <p className="text-sm text-destructive">{errors.minPrice}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-price" className="text-neutral-800">Maximum Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                  <Input
                    id="max-price"
                    type="text"
                    inputMode="numeric"
                    value={maxPrice}
                    onChange={(e) => handleMaxPriceChange(e.target.value)}
                    onBlur={handleMaxPriceBlur}
                    placeholder="500,000"
                    className={`pl-7 bg-white border-neutral-200 ${errors.maxPrice ? 'border-destructive' : ''}`}
                    maxLength={15}
                    disabled={hasNoMax}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="no-max"
                    checked={hasNoMax}
                    onCheckedChange={(checked) => handleNoMaxChange(!!checked)}
                  />
                  <label htmlFor="no-max" className={`text-sm cursor-pointer ${hasNoMax ? "font-medium text-neutral-900" : "text-neutral-600"}`}>No Maximum</label>
                </div>
                {errors.maxPrice && (
                  <p className="text-sm text-destructive">{errors.maxPrice}</p>
                )}
              </div>
            </div>

            {/* Summary display based on current state */}
            {(minPrice || maxPrice || hasNoMin || hasNoMax) && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
                <p className="text-sm">
                  <span className="font-medium text-neutral-800">You will receive notifications for properties priced:</span>
                  <br />
                  <span className="font-medium text-neutral-900">
                  {isAllPriceRanges && (
                    <>No Minimum - No Maximum</>
                  )}
                  {!hasNoMin && !hasNoMax && minPrice && maxPrice && (
                    <>Between {formatDisplayPrice(minPrice)} and {formatDisplayPrice(maxPrice)}</>
                  )}
                  {!hasNoMin && hasNoMax && minPrice && (
                    <>{formatDisplayPrice(minPrice)} - No Maximum</>
                  )}
                  {hasNoMin && !hasNoMax && maxPrice && (
                    <>No Minimum - {formatDisplayPrice(maxPrice)}</>
                  )}
                  {hasNoMin && !hasNoMax && !maxPrice && (
                    <>No Minimum</>
                  )}
                  {!hasNoMin && hasNoMax && !minPrice && (
                    <>No Maximum</>
                  )}
                  {!hasNoMin && !hasNoMax && minPrice && !maxPrice && (
                    <>{formatDisplayPrice(minPrice)} and above</>
                  )}
                  {!hasNoMin && !hasNoMax && !minPrice && maxPrice && (
                    <>Up to {formatDisplayPrice(maxPrice)}</>
                  )}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default PriceRangePreferences;
