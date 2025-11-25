import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UnifiedPropertySearch, SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditHotsheetCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotSheetId: string;
  initialCriteria: any;
  onUpdate: () => void;
}

export function EditHotsheetCriteriaDialog({
  open,
  onOpenChange,
  hotSheetId,
  initialCriteria,
  onUpdate,
}: EditHotsheetCriteriaDialogProps) {
  const [criteria, setCriteria] = useState<SearchCriteria>(() => {
    // Convert hotsheet criteria to UnifiedPropertySearch format
    return {
      state: initialCriteria.state || "MA",
      county: initialCriteria.county || "all",
      towns: initialCriteria.cities || [],
      showAreas: initialCriteria.showAreas !== false,
      propertyTypes: initialCriteria.propertyTypes || [],
      statuses: initialCriteria.statuses || ["new", "coming_soon", "active", "back_on_market"],
      minPrice: initialCriteria.minPrice?.toString() || "",
      maxPrice: initialCriteria.maxPrice?.toString() || "",
      bedrooms: initialCriteria.bedrooms?.toString() || "",
      bathrooms: initialCriteria.bathrooms?.toString() || "",
      zipCode: initialCriteria.zipCode || "",
    };
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Convert to hotsheet criteria format
      const hotsheetCriteria = {
        state: criteria.state,
        county: criteria.county,
        cities: criteria.towns,
        showAreas: criteria.showAreas,
        propertyTypes: criteria.propertyTypes,
        statuses: criteria.statuses,
        minPrice: criteria.minPrice ? parseFloat(criteria.minPrice) : undefined,
        maxPrice: criteria.maxPrice ? parseFloat(criteria.maxPrice) : undefined,
        bedrooms: criteria.bedrooms ? parseInt(criteria.bedrooms) : undefined,
        bathrooms: criteria.bathrooms ? parseFloat(criteria.bathrooms) : undefined,
        zipCode: criteria.zipCode || undefined,
        minSqft: criteria.minLivingArea ? parseFloat(criteria.minLivingArea) : undefined,
        maxSqft: criteria.maxLivingArea ? parseFloat(criteria.maxLivingArea) : undefined,
      };

      const { error } = await supabase
        .from("hot_sheets")
        .update({ criteria: hotsheetCriteria })
        .eq("id", hotSheetId);

      if (error) throw error;

      toast.success("Search criteria updated");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update criteria:", error);
      toast.error("Failed to update search criteria");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Search Criteria</DialogTitle>
          <DialogDescription>
            Update the search filters for this hotsheet
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <UnifiedPropertySearch
            criteria={criteria}
            onCriteriaChange={setCriteria}
            showResultsCount={false}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
