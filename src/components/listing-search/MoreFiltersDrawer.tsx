import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Search, RotateCcw } from "lucide-react";
import { FilterState, initialFilters } from "./ListingSearchTopBar";

interface MoreFiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  onReset: () => void;
}

const MoreFiltersDrawer = ({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onSearch,
  onReset,
}: MoreFiltersDrawerProps) => {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleSearch = () => {
    onSearch();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold">More Filters</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Standard Search Criteria */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-4">Standard Criteria</h3>
            
            {/* Living Area */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Living Area (SqFt)</Label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.sqftMin}
                    onChange={e => updateFilter("sqftMin", e.target.value)}
                    className="h-9"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.sqftMax}
                    onChange={e => updateFilter("sqftMax", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Lot Size */}
              <div>
                <Label className="text-xs text-muted-foreground">Lot Size (Acres)</Label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.lotSizeMin}
                    onChange={e => updateFilter("lotSizeMin", e.target.value)}
                    className="h-9"
                    step="0.1"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.lotSizeMax}
                    onChange={e => updateFilter("lotSizeMax", e.target.value)}
                    className="h-9"
                    step="0.1"
                  />
                </div>
              </div>

              {/* Year Built */}
              <div>
                <Label className="text-xs text-muted-foreground">Year Built</Label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.yearBuiltMin}
                    onChange={e => updateFilter("yearBuiltMin", e.target.value)}
                    className="h-9"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.yearBuiltMax}
                    onChange={e => updateFilter("yearBuiltMax", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Garage Spaces */}
              <div>
                <Label className="text-xs text-muted-foreground">Garage Spaces (Min)</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.garageSpaces}
                  onChange={e => updateFilter("garageSpaces", e.target.value)}
                  className="h-9 mt-1"
                />
              </div>

              {/* Total Parking */}
              <div>
                <Label className="text-xs text-muted-foreground">Total Parking Spaces (Min)</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.parkingSpaces}
                  onChange={e => updateFilter("parkingSpaces", e.target.value)}
                  className="h-9 mt-1"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Address / Radius Search */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-4">Address / Radius Search</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Street Address</Label>
                <Input
                  placeholder="Enter street address"
                  value={filters.streetAddress}
                  onChange={e => updateFilter("streetAddress", e.target.value)}
                  className="h-9 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Zip Code</Label>
                  <Input
                    placeholder="02101"
                    value={filters.zipCode}
                    onChange={e => updateFilter("zipCode", e.target.value)}
                    className="h-9 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Radius (miles)</Label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={filters.radius}
                    onChange={e => updateFilter("radius", e.target.value)}
                    className="h-9 mt-1"
                  />
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Keywords */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-4">Keywords</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Include (description contains)</Label>
                <Input
                  placeholder="e.g. pool, waterfront, renovated"
                  value={filters.keywordsInclude}
                  onChange={e => updateFilter("keywordsInclude", e.target.value)}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Exclude (description does not contain)</Label>
                <Input
                  placeholder="e.g. as-is, fixer"
                  value={filters.keywordsExclude}
                  onChange={e => updateFilter("keywordsExclude", e.target.value)}
                  className="h-9 mt-1"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onReset}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All
            </Button>
            <Button
              className="flex-1"
              onClick={handleSearch}
            >
              <Search className="h-4 w-4 mr-2" />
              View Results
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MoreFiltersDrawer;
