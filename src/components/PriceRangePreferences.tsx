import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { z } from "zod";

interface PriceRangePreferencesProps {
  agentId: string;
}

// Validation schema with security in mind
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

const PriceRangePreferences = ({ agentId }: PriceRangePreferencesProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [errors, setErrors] = useState<{ minPrice?: string; maxPrice?: string }>({});
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, [agentId]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("min_price, max_price")
        .eq("user_id", agentId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setMinPrice((data as any).min_price ? (data as any).min_price.toString() : "");
        setMaxPrice((data as any).max_price ? (data as any).max_price.toString() : "");
      }
    } catch (error) {
      console.error("Error fetching price preferences:", error);
      toast.error("Failed to load price preferences");
    } finally {
      setLoading(false);
    }
  };

  const validateAndSave = async () => {
    // Clear previous errors
    setErrors({});

    // Validate input
    const validation = priceSchema.safeParse({
      minPrice,
      maxPrice
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
      toast.error("Please fix validation errors");
      return;
    }

    setSaving(true);
    try {
      const minPriceValue = minPrice.trim() ? parseFloat(minPrice) : null;
      const maxPriceValue = maxPrice.trim() ? parseFloat(maxPrice) : null;

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: agentId,
          min_price: minPriceValue,
          max_price: maxPriceValue,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success("Price range preferences saved successfully!");
    } catch (error) {
      console.error("Error saving price preferences:", error);
      toast.error("Failed to save price preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleMinPriceChange = (value: string) => {
    // Remove any non-digit characters except decimal point
    const sanitized = value.replace(/[^\d.]/g, '');
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
    
    // Limit to reasonable price values
    const num = parseFloat(formatted);
    if (!isNaN(num) && num > 999999999) {
      return;
    }
    
    setMinPrice(formatted);
    if (errors.minPrice) {
      setErrors(prev => ({ ...prev, minPrice: undefined }));
    }
  };

  const handleMaxPriceChange = (value: string) => {
    // Remove any non-digit characters except decimal point
    const sanitized = value.replace(/[^\d.]/g, '');
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
    
    // Limit to reasonable price values
    const num = parseFloat(formatted);
    if (!isNaN(num) && num > 999999999) {
      return;
    }
    
    setMaxPrice(formatted);
    if (errors.maxPrice) {
      setErrors(prev => ({ ...prev, maxPrice: undefined }));
    }
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
    setErrors({});
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
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min-price">Minimum Price</Label>
            <Input
              id="min-price"
              type="text"
              inputMode="decimal"
              value={minPrice}
              onChange={(e) => handleMinPriceChange(e.target.value)}
              placeholder="100000"
              className={errors.minPrice ? 'border-destructive' : ''}
              maxLength={12}
            />
            {errors.minPrice && (
              <p className="text-sm text-destructive">{errors.minPrice}</p>
            )}
            {minPrice && !errors.minPrice && (
              <p className="text-sm text-muted-foreground">{formatDisplayPrice(minPrice)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-price">Maximum Price</Label>
            <Input
              id="max-price"
              type="text"
              inputMode="decimal"
              value={maxPrice}
              onChange={(e) => handleMaxPriceChange(e.target.value)}
              placeholder="500000"
              className={errors.maxPrice ? 'border-destructive' : ''}
              maxLength={12}
            />
            {errors.maxPrice && (
              <p className="text-sm text-destructive">{errors.maxPrice}</p>
            )}
            {maxPrice && !errors.maxPrice && (
              <p className="text-sm text-muted-foreground">{formatDisplayPrice(maxPrice)}</p>
            )}
          </div>
        </div>

        {(minPrice || maxPrice) && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="font-medium">You will receive notifications for properties priced:</span>
              <br />
              {minPrice && maxPrice && (
                <span>Between {formatDisplayPrice(minPrice)} and {formatDisplayPrice(maxPrice)}</span>
              )}
              {minPrice && !maxPrice && (
                <span>{formatDisplayPrice(minPrice)} and above</span>
              )}
              {!minPrice && maxPrice && (
                <span>Up to {formatDisplayPrice(maxPrice)}</span>
              )}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={clearPriceRange}
            disabled={!minPrice && !maxPrice}
          >
            Clear Range
          </Button>
          <Button onClick={validateAndSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Price Preferences"
            )}
          </Button>
        </div>
      </CardContent>
    </CollapsibleContent>
    </Card>
    </Collapsible>
  );
};

export default PriceRangePreferences;
