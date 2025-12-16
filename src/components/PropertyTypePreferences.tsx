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
      <Card className={`border transition-all ${isOpen ? "border-primary bg-muted/30" : "border-border"}`}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                <CardTitle>Property Type</CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
            </div>
            <CardDescription className="text-left">
              Select which property types you want to receive notifications about
            </CardDescription>
            {!isOpen && (
              <p className="text-sm text-muted-foreground mt-1 text-left">
                {selectedTypes.length > 0 
                  ? `${selectedTypes.length} property type${selectedTypes.length !== 1 ? 's' : ''} selected`
                  : "No property types selected"}
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-4">
        
        {/* Prominent Select All Button */}
        <Button 
          onClick={selectAll}
          variant={allSelected ? "outline" : "default"}
          className="w-full h-12 text-base font-bold"
        >
          ✓ {allSelected ? "Deselect All Property Types" : "Select All Property Types"}
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-4 max-h-80 overflow-y-auto bg-background">
          {PROPERTY_TYPES.map((type) => (
            <div key={type.value} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${type.value}`}
                checked={selectedTypes.includes(type.value)}
                onCheckedChange={() => togglePropertyType(type.value)}
              />
              <Label
                htmlFor={`type-${type.value}`}
                className="cursor-pointer flex-1"
              >
                {type.label}
              </Label>
            </div>
          ))}
        </div>

        {selectedTypes.length > 0 && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="font-medium">You will receive notifications for:</span>
              <br />
              <span className="text-muted-foreground">
                {selectedTypes.map(type => {
                  const typeObj = PROPERTY_TYPES.find(t => t.value === type);
                  return typeObj?.label;
                }).filter(Boolean).join(", ")}
              </span>
            </p>
          </div>
        )}

        {selectedTypes.length === 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <span className="font-medium">No property types selected.</span>
              <br />
              <span className="text-amber-700 dark:text-amber-300">
                You will not receive notifications until you select at least one property type.
              </span>
            </p>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedTypes.length} of {PROPERTY_TYPES.length} types selected
          </p>
        </div>
      </CardContent>
    </CollapsibleContent>
    </Card>
    </Collapsible>
  );
};

export default PropertyTypePreferences;
