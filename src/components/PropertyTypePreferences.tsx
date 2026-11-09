import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Home } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { FilterCheckboxGrid, FilterPreferenceCard } from "@/components/filters";
import { resolveCommsPropertyTypes } from "@/lib/propertyTypeDefaults";

export interface PropertyTypeData {
  propertyTypes: string[];
}

interface PropertyTypePreferencesProps {
  agentId: string;
  onFiltersUpdated?: (hasFilters: boolean) => void;
  onDataChange?: (data: PropertyTypeData) => void;
}

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condominium" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
  { value: "residential_rental", label: "Residential Rental" },
  { value: "commercial_rental", label: "Commercial Rental" },
] as const;

const PropertyTypePreferences = ({ agentId, onFiltersUpdated, onDataChange }: PropertyTypePreferencesProps) => {
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [agentId]);

  const notifyChange = useCallback(() => {
    onFiltersUpdated?.(selectedTypes.length > 0);
    onDataChange?.({ propertyTypes: selectedTypes });
  }, [selectedTypes, onFiltersUpdated, onDataChange]);

  useEffect(() => {
    if (!loading) {
      notifyChange();
    }
  }, [selectedTypes, loading, notifyChange]);

  const fetchPreferences = async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("property_types")
        .eq("user_id", agentId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setSelectedTypes(resolveCommsPropertyTypes((data as any)?.property_types));
    } catch (error) {
      console.error("Error fetching property type preferences:", error);
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

  const summaryLabels = selectedTypes
    .map((type) => PROPERTY_TYPES.find((t) => t.value === type)?.label)
    .filter(Boolean);

  return (
    <FilterPreferenceCard
      icon={Home}
      title="Property Type"
      description="Choose which property types trigger alerts."
      summary={
        selectedTypes.length > 0
          ? `${selectedTypes.length} property type${selectedTypes.length !== 1 ? "s" : ""} selected`
          : ""
      }
      emptySummary="No property types selected"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <FilterCheckboxGrid
        options={PROPERTY_TYPES}
        selected={selectedTypes}
        onChange={setSelectedTypes}
        idPrefix="comms-type"
      />

      {selectedTypes.length > 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <p className="text-sm">
            <span className="font-medium text-neutral-600">You will receive notifications for:</span>
            <br />
            <span className="font-medium text-neutral-900">{summaryLabels.join(", ")}</span>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-sm text-amber-900">
            <span className="font-medium">No property types selected</span>
            <br />
            <span className="text-amber-800">
              You will not receive notifications until you select at least one property type.
            </span>
          </p>
        </div>
      )}
    </FilterPreferenceCard>
  );
};

export default PropertyTypePreferences;
