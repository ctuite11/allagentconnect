import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import {
  FilterPreferenceCard,
  getPriceRangeSummary,
  PriceRangeFields,
  type PriceRangeFieldValue,
} from "@/components/filters";

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

const getRawValue = (value: string) => value.replace(/,/g, "");

const formatNumberWithCommas = (value: string) => {
  if (!value) return "";
  const numericValue = value.replace(/,/g, "");
  const num = parseFloat(numericValue);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

const PriceRangePreferences = ({ agentId, onFiltersUpdated, onDataChange }: PriceRangePreferencesProps) => {
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<PriceRangeFieldValue>({
    minPrice: "",
    maxPrice: "",
    hasNoMin: false,
    hasNoMax: false,
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [agentId]);

  const notifyChange = useCallback(() => {
    const minPriceValue = fields.minPrice.trim() ? parseFloat(getRawValue(fields.minPrice)) : null;
    const maxPriceValue = fields.maxPrice.trim() ? parseFloat(getRawValue(fields.maxPrice)) : null;

    const hasFilter =
      fields.hasNoMin || fields.hasNoMax || minPriceValue !== null || maxPriceValue !== null;
    const isAllPriceRanges = fields.hasNoMin && fields.hasNoMax;
    onFiltersUpdated?.(hasFilter && !isAllPriceRanges);

    onDataChange?.({
      minPrice: fields.hasNoMin ? null : minPriceValue,
      maxPrice: fields.hasNoMax ? null : maxPriceValue,
      hasNoMin: fields.hasNoMin,
      hasNoMax: fields.hasNoMax,
    });
  }, [fields, onFiltersUpdated, onDataChange]);

  useEffect(() => {
    if (!loading) {
      notifyChange();
    }
  }, [fields, loading, notifyChange]);

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
        setFields({
          minPrice: minVal ? formatNumberWithCommas(minVal) : "",
          maxPrice: maxVal ? formatNumberWithCommas(maxVal) : "",
          hasNoMin: (data as any).has_no_min ?? false,
          hasNoMax: (data as any).has_no_max ?? false,
        });
      }
    } catch (error) {
      console.error("Error fetching price preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <AacMonogramLoader variant="inline" hideMessage className="min-h-0 gap-0 py-0" />
        </CardContent>
      </Card>
    );
  }

  const summary = getPriceRangeSummary(fields);

  return (
    <FilterPreferenceCard
      icon={DollarSign}
      title="Price Range"
      description="Receive alerts that match your preferred pricing."
      summary={summary}
      emptySummary="No price range set"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <PriceRangeFields value={fields} onChange={setFields} idPrefix="comms-price" />
    </FilterPreferenceCard>
  );
};

export default PriceRangePreferences;
