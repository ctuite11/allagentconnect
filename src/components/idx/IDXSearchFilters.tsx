import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { RepliersListingsParams } from "@/lib/repliers";

interface IDXSearchFiltersProps {
  filters: RepliersListingsParams;
  onFiltersChange: (filters: RepliersListingsParams) => void;
  onSearch: () => void;
  onReset: () => void;
}

const PROPERTY_TYPES = [
  { value: "", label: "Any Type" },
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "land", label: "Land" },
];

const BED_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
  { value: "5", label: "5+" },
];

const BATH_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "1+" },
  { value: "1.5", label: "1.5+" },
  { value: "2", label: "2+" },
  { value: "2.5", label: "2.5+" },
  { value: "3", label: "3+" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Any Status" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
];

export function IDXSearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  onReset,
}: IDXSearchFiltersProps) {
  const updateFilter = (key: keyof RepliersListingsParams, value: string | number | undefined) => {
    const newFilters = { ...filters };
    if (value === "" || value === undefined) {
      delete newFilters[key];
    } else {
      // @ts-expect-error - dynamic key assignment
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* City */}
        <div className="space-y-1.5">
          <Label htmlFor="city" className="text-sm text-neutral-700">
            City
          </Label>
          <Input
            id="city"
            placeholder="Enter city..."
            value={filters.city || ""}
            onChange={(e) => updateFilter("city", e.target.value)}
            onKeyDown={handleKeyDown}
            className="rounded-xl"
          />
        </div>

        {/* Min Price */}
        <div className="space-y-1.5">
          <Label htmlFor="minPrice" className="text-sm text-neutral-700">
            Min Price
          </Label>
          <Input
            id="minPrice"
            type="number"
            placeholder="No min"
            value={filters.minPrice || ""}
            onChange={(e) =>
              updateFilter("minPrice", e.target.value ? Number(e.target.value) : undefined)
            }
            onKeyDown={handleKeyDown}
            className="rounded-xl"
          />
        </div>

        {/* Max Price */}
        <div className="space-y-1.5">
          <Label htmlFor="maxPrice" className="text-sm text-neutral-700">
            Max Price
          </Label>
          <Input
            id="maxPrice"
            type="number"
            placeholder="No max"
            value={filters.maxPrice || ""}
            onChange={(e) =>
              updateFilter("maxPrice", e.target.value ? Number(e.target.value) : undefined)
            }
            onKeyDown={handleKeyDown}
            className="rounded-xl"
          />
        </div>

        {/* Property Type */}
        <div className="space-y-1.5">
          <Label className="text-sm text-neutral-700">Property Type</Label>
          <Select
            value={filters.propertyType || ""}
            onValueChange={(val) => updateFilter("propertyType", val)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Any Type" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Beds */}
        <div className="space-y-1.5">
          <Label className="text-sm text-neutral-700">Beds</Label>
          <Select
            value={filters.minBeds?.toString() || ""}
            onValueChange={(val) =>
              updateFilter("minBeds", val ? Number(val) : undefined)
            }
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {BED_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Baths */}
        <div className="space-y-1.5">
          <Label className="text-sm text-neutral-700">Baths</Label>
          <Select
            value={filters.minBaths?.toString() || ""}
            onValueChange={(val) =>
              updateFilter("minBaths", val ? Number(val) : undefined)
            }
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {BATH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-sm text-neutral-700">Status</Label>
          <Select
            value={filters.status || ""}
            onValueChange={(val) => updateFilter("status", val)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Any Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex items-end gap-2">
          <Button
            onClick={onSearch}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700"
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button
            variant="outline"
            onClick={onReset}
            className="rounded-xl"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
