import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Home, ChevronDown, ChevronUp } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

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
  // Default to empty array - no preselection
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [agentId]);

  // Notify parent of data changes (no autosave)
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

      if (data && (data as any).property_types) {
        // Handle both array and object formats for safety
        const types = Array.isArray((data as any).property_types) 
          ? ((data as any).property_types as string[])
          : [];
        // Validate that all items are strings
        const validTypes = types.filter(t => typeof t === 'string');
        setSelectedTypes(validTypes);
      }
      // If no data or no property_types, keep as empty array (no preselection)
    } catch (error) {
      console.error("Error fetching property type preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePropertyType = (typeValue: string) => {
    const newTypes = selectedTypes.includes(typeValue)
      ? selectedTypes.filter(t => t !== typeValue)
      : [...selectedTypes, typeValue];
    setSelectedTypes(newTypes);
  };

  const selectAll = () => {
    const newTypes = selectedTypes.length === PROPERTY_TYPES.length 
      ? [] 
      : PROPERTY_TYPES.map(t => t.value);
    setSelectedTypes(newTypes);
  };

  const allSelected = selectedTypes.length === PROPERTY_TYPES.length;

  if (loading) {
    return (
      <Card className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <AacMonogramLoader variant="inline" hideMessage className="min-h-0 gap-0 py-0" />
        </CardContent>
      </Card>
    );
  }

  return (
  <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow duration-150 hover:shadow-md">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Home className="h-5 w-5 !text-[#16A34A]" strokeWidth={2} aria-hidden />
                <CardTitle className="text-base font-semibold text-neutral-900">Property Type</CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-neutral-400" strokeWidth={2} />
              ) : (
                <ChevronDown className="h-5 w-5 text-neutral-400" strokeWidth={2} />
              )}
            </div>
            <CardDescription className="mt-1 text-left text-sm text-neutral-500">
              Choose which property types trigger alerts.
            </CardDescription>
            {!isOpen && selectedTypes.length > 0 && (
              <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left">
                <p className="text-sm font-medium text-neutral-900">
                  {selectedTypes.length} property type{selectedTypes.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
            {!isOpen && selectedTypes.length === 0 && (
              <p className="mt-1 text-left text-sm text-neutral-500">No property types selected</p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2 px-0 pb-0 pt-3">
            <span className="text-xs text-neutral-600">
              {selectedTypes.length} of {PROPERTY_TYPES.length} types selected
            </span>

            <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 md:grid-cols-2">
              <div
                className={`col-span-1 -mx-2 mb-2 flex items-center space-x-2 rounded-lg border-b border-neutral-200 px-2 py-1.5 pb-2 transition-colors hover:bg-neutral-50/80 md:col-span-2 ${allSelected ? "bg-neutral-50" : ""}`}
              >
                <Checkbox id="type-select-all" checked={allSelected} onCheckedChange={selectAll} />
                <Label
                  htmlFor="type-select-all"
                  className={`flex-1 cursor-pointer text-sm ${allSelected ? "font-medium text-neutral-900" : "text-neutral-600"}`}
                >
                  Select all
                </Label>
              </div>
              {PROPERTY_TYPES.map((type) => {
                const isChecked = selectedTypes.includes(type.value);
                return (
                  <div
                    key={type.value}
                    className={`-mx-2 flex items-center space-x-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50/80 ${isChecked ? "bg-neutral-50" : ""}`}
                  >
                    <Checkbox id={`type-${type.value}`} checked={isChecked} onCheckedChange={() => togglePropertyType(type.value)} />
                    <Label
                      htmlFor={`type-${type.value}`}
                      className={`flex-1 cursor-pointer text-sm ${isChecked ? "font-medium text-neutral-900" : "text-neutral-600"}`}
                    >
                      {type.label}
                    </Label>
                  </div>
                );
              })}
            </div>

            {selectedTypes.length > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <p className="text-sm">
                  <span className="font-medium text-neutral-600">You will receive notifications for:</span>
                  <br />
                  <span className="font-medium text-neutral-900">
                    {selectedTypes
                      .map((type) => {
                        const typeObj = PROPERTY_TYPES.find((t) => t.value === type);
                        return typeObj?.label;
                      })
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </p>
              </div>
            )}

            {selectedTypes.length === 0 && (
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
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default PropertyTypePreferences;
