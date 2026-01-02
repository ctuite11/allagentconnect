import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Home, ChevronDown, ChevronUp } from "lucide-react";

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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
  <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Home className="h-6 w-6 text-emerald-600" />
                <CardTitle className="text-base font-medium text-zinc-900">Property Type</CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
            </div>
            <CardDescription className="text-left text-sm text-zinc-500 mt-1">
              Select which property types you want to receive notifications about
            </CardDescription>
            {!isOpen && selectedTypes.length > 0 && (
              <div className="mt-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-left">
                <p className="text-sm font-medium text-zinc-900">
                  {selectedTypes.length} property type{selectedTypes.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
            {!isOpen && selectedTypes.length === 0 && (
              <p className="text-sm text-zinc-400 mt-1 text-left">
                No property types selected
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-4 px-0 pb-0">
        
        {/* Selection count */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            {selectedTypes.length} of {PROPERTY_TYPES.length} types selected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-zinc-200 rounded-xl p-3 max-h-80 overflow-y-auto bg-white">
          {/* Select all as first checkbox item */}
          <div className="flex items-center space-x-2 col-span-1 md:col-span-2 pb-2 mb-2 border-b border-zinc-200">
            <Checkbox
              id="type-select-all"
              checked={allSelected}
              onCheckedChange={selectAll}
            />
            <Label
              htmlFor="type-select-all"
              className={`cursor-pointer flex-1 text-sm ${allSelected ? "font-medium text-zinc-900" : "text-zinc-700"}`}
            >
              Select all
            </Label>
          </div>
          {PROPERTY_TYPES.map((type) => {
            const isChecked = selectedTypes.includes(type.value);
            return (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type.value}`}
                  checked={isChecked}
                  onCheckedChange={() => togglePropertyType(type.value)}
                />
                <Label
                  htmlFor={`type-${type.value}`}
                  className={`cursor-pointer flex-1 text-sm ${isChecked ? "font-medium text-zinc-900" : "text-zinc-600"}`}
                >
                  {type.label}
                </Label>
              </div>
            );
          })}
        </div>

        {selectedTypes.length > 0 && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
            <p className="text-sm">
              <span className="font-medium text-zinc-700">You will receive notifications for:</span>
              <br />
              <span className="text-zinc-900 font-medium">
                {selectedTypes.map(type => {
                  const typeObj = PROPERTY_TYPES.find(t => t.value === type);
                  return typeObj?.label;
                }).filter(Boolean).join(", ")}
              </span>
            </p>
          </div>
        )}

        {selectedTypes.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <p className="text-sm text-amber-900">
              <span className="font-medium">No property types selected</span>
              <br />
              <span className="text-amber-700">
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
