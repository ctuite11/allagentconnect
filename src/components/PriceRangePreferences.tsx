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
    .refine(val => val === "" || !isNaN(parseFloat(val)), {
      message: "Must be a valid number"
    })
    .refine(val => val === "" || parseFloat(val) >= 0, {
      message: "Price cannot be negative"
    })
    .refine(val => val === "" || parseFloat(val) <= 999999999, {
      message: "Price is too high"
    }),
  maxPrice: z.string()
    .transform(val => val.trim())
    .refine(val => val === "" || !isNaN(parseFloat(val)), {
      message: "Must be a valid number"
    })
    .refine(val => val === "" || parseFloat(val) >= 0, {
      message: "Price cannot be negative"
    })
    .refine(val => val === "" || parseFloat(val) <= 999999999, {
      message: "Price is too high"
    })
}).refine(data => {
  if (data.minPrice && data.maxPrice) {
    const min = parseFloat(data.minPrice);
    const max = parseFloat(data.maxPrice);
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
  const [minPriceDisplay, setMinPriceDisplay] = useState("");
  const [maxPriceDisplay, setMaxPriceDisplay] = useState("");
  const [isMinPriceFocused, setIsMinPriceFocused] = useState(false);
  const [isMaxPriceFocused, setIsMaxPriceFocused] = useState(false);
  const [hasNoMin, setHasNoMin] = useState(true);
  const [hasNoMax, setHasNoMax] = useState(true);
  const [errors, setErrors] = useState<{ minPrice?: string; maxPrice?: string }>({});
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [agentId]);

  // Notify parent of data changes (no autosave)
  const notifyChange = useCallback(() => {
    const minPriceValue = minPrice.trim() ? parseFloat(minPrice) : null;
    const maxPriceValue = maxPrice.trim() ? parseFloat(maxPrice) : null;
    
    const hasFilter = !hasNoMin || !hasNoMax || minPriceValue !== null || maxPriceValue !== null;
    onFiltersUpdated?.(hasFilter && !(hasNoMin && hasNoMax));
    
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
        setMinPrice(minVal);
        setMaxPrice(maxVal);
        setMinPriceDisplay(minVal ? formatNumberWithCommas(minVal) : "");
        setMaxPriceDisplay(maxVal ? formatNumberWithCommas(maxVal) : "");
        // Use explicit boolean columns, default to true if null
        setHasNoMin((data as any).has_no_min ?? true);
        setHasNoMax((data as any).has_no_max ?? true);
      }
    } catch (error) {
      console.error("Error fetching price preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const validatePrices = (): boolean => {
    setErrors({});
    const validation = priceSchema.safeParse({ minPrice, maxPrice });
    
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

  const formatNumberWithCommas = (value: string) => {
    if (!value) return "";
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const handleMinPriceChange = (value: string) => {
    const sanitized = value.replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
    
    const num = parseFloat(formatted);
    if (!isNaN(num) && num > 999999999) {
      return;
    }
    
    setMinPrice(formatted);
    setMinPriceDisplay(formatted);
    if (errors.minPrice) {
      setErrors(prev => ({ ...prev, minPrice: undefined }));
    }
  };

  const handleMaxPriceChange = (value: string) => {
    const sanitized = value.replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
    
    const num = parseFloat(formatted);
    if (!isNaN(num) && num > 999999999) {
      return;
    }
    
    setMaxPrice(formatted);
    setMaxPriceDisplay(formatted);
    if (errors.maxPrice) {
      setErrors(prev => ({ ...prev, maxPrice: undefined }));
    }
  };

  const handleMinPriceBlur = () => {
    setIsMinPriceFocused(false);
    if (minPrice) {
      setMinPriceDisplay(formatNumberWithCommas(minPrice));
    }
    validatePrices();
  };

  const handleMaxPriceBlur = () => {
    setIsMaxPriceFocused(false);
    if (maxPrice) {
      setMaxPriceDisplay(formatNumberWithCommas(maxPrice));
    }
    validatePrices();
  };

  const handleMinPriceFocus = () => {
    setIsMinPriceFocused(true);
    setMinPriceDisplay(minPrice);
  };

  const handleMaxPriceFocus = () => {
    setIsMaxPriceFocused(true);
    setMaxPriceDisplay(maxPrice);
  };

  const formatDisplayPrice = (price: string) => {
    if (!price) return "";
    const num = parseFloat(price);
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
    setMinPriceDisplay("");
    setMaxPriceDisplay("");
    setHasNoMin(true);
    setHasNoMax(true);
    setErrors({});
  };

  const handleNoMinChange = (checked: boolean) => {
    setHasNoMin(checked);
    if (checked) {
      setMinPrice("");
      setMinPriceDisplay("");
      setErrors(prev => ({ ...prev, minPrice: undefined }));
    }
  };

  const handleNoMaxChange = (checked: boolean) => {
    setHasNoMax(checked);
    if (checked) {
      setMaxPrice("");
      setMaxPriceDisplay("");
      setErrors(prev => ({ ...prev, maxPrice: undefined }));
    }
  };

  // Helper for summary text
  const getSummaryText = () => {
    if (hasNoMin && hasNoMax) {
      return "All price ranges";
    }
    if (!hasNoMin && !hasNoMax && minPrice && maxPrice) {
      return `$${formatNumberWithCommas(minPrice)} - $${formatNumberWithCommas(maxPrice)}`;
    }
    if (!hasNoMin && minPrice) {
      return `$${formatNumberWithCommas(minPrice)}+`;
    }
    if (!hasNoMax && maxPrice) {
      return `Up to $${formatNumberWithCommas(maxPrice)}`;
    }
    return "All price ranges";
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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-primary">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <CardTitle>Price Range</CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
            </div>
            <CardDescription className="text-left">
              Set your preferred price range for client need notifications
            </CardDescription>
            {!isOpen && (
              <p className="text-sm text-muted-foreground mt-1 text-left">
                {getSummaryText()}
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-price">Minimum Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="min-price"
                    type="text"
                    inputMode="decimal"
                    value={minPriceDisplay}
                    onChange={(e) => handleMinPriceChange(e.target.value)}
                    onFocus={handleMinPriceFocus}
                    onBlur={handleMinPriceBlur}
                    placeholder="100,000"
                    className={`pl-7 ${errors.minPrice ? 'border-destructive' : ''}`}
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
                  <label htmlFor="no-min" className="text-sm cursor-pointer">No Minimum</label>
                </div>
                {errors.minPrice && (
                  <p className="text-sm text-destructive">{errors.minPrice}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-price">Maximum Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="max-price"
                    type="text"
                    inputMode="decimal"
                    value={maxPriceDisplay}
                    onChange={(e) => handleMaxPriceChange(e.target.value)}
                    onFocus={handleMaxPriceFocus}
                    onBlur={handleMaxPriceBlur}
                    placeholder="500,000"
                    className={`pl-7 ${errors.maxPrice ? 'border-destructive' : ''}`}
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
                  <label htmlFor="no-max" className="text-sm cursor-pointer">No Maximum</label>
                </div>
                {errors.maxPrice && (
                  <p className="text-sm text-destructive">{errors.maxPrice}</p>
                )}
              </div>
            </div>

            {!hasNoMin || !hasNoMax ? (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">You will receive notifications for properties priced:</span>
                  <br />
                  {!hasNoMin && !hasNoMax && minPrice && maxPrice && (
                    <span>Between {formatDisplayPrice(minPrice)} and {formatDisplayPrice(maxPrice)}</span>
                  )}
                  {!hasNoMin && hasNoMax && minPrice && (
                    <span>{formatDisplayPrice(minPrice)} and above</span>
                  )}
                  {hasNoMin && !hasNoMax && maxPrice && (
                    <span>Up to {formatDisplayPrice(maxPrice)}</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <span className="font-medium">No price range set.</span>
                  <br />
                  <span className="text-blue-700 dark:text-blue-300">
                    You will receive notifications for all price ranges.
                  </span>
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {getSummaryText()}
                </p>
                <Button 
                  variant="outline" 
                  onClick={clearPriceRange}
                  disabled={hasNoMin && hasNoMax && !minPrice && !maxPrice}
                >
                  Clear Range
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default PriceRangePreferences;
