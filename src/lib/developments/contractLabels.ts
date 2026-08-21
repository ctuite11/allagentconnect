import {
  DEVELOPMENT_BUILDING_AMENITIES,
  DEVELOPMENT_BUILDING_TYPES,
  DEVELOPMENT_SALES_STATUSES,
  DEVELOPMENT_STAGES,
  DEVELOPMENT_UNIT_FEATURES,
  DEVELOPMENT_UNIT_STATUSES,
  DEVELOPMENT_UNIT_TYPES,
} from "./publishStatus";

export const BUILDING_TYPE_OPTIONS: Array<{
  value: (typeof DEVELOPMENT_BUILDING_TYPES)[number];
  label: string;
}> = [
  { value: "high_rise", label: "High Rise" },
  { value: "mid_rise", label: "Mid Rise" },
  { value: "low_rise", label: "Low Rise" },
  { value: "three_family", label: "3 Family" },
  { value: "two_family", label: "2 Family" },
  { value: "single_family", label: "Single Family" },
  { value: "townhomes", label: "Townhomes" },
  { value: "condo_community", label: "Condo Community" },
  { value: "mixed_use", label: "Mixed Use" },
  { value: "garden_style", label: "Garden Style" },
  { value: "loft_conversion", label: "Loft Conversion" },
  { value: "brownstone", label: "Brownstone" },
  { value: "other", label: "Other" },
];

export const STAGE_OPTIONS: Array<{
  value: (typeof DEVELOPMENT_STAGES)[number];
  label: string;
}> = [
  { value: "planning", label: "Planning" },
  { value: "pre_construction", label: "Pre-Construction" },
  { value: "under_construction", label: "Under Construction" },
  { value: "completed", label: "Completed" },
];

export const SALES_STATUS_OPTIONS: Array<{
  value: (typeof DEVELOPMENT_SALES_STATUSES)[number];
  label: string;
}> = [
  { value: "not_yet_released", label: "Not Yet Released" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "now_selling", label: "Now Selling" },
  { value: "final_units", label: "Final Units" },
  { value: "sold_out", label: "Sold Out" },
];

export const BUILDING_AMENITY_OPTIONS: Array<{
  value: (typeof DEVELOPMENT_BUILDING_AMENITIES)[number];
  label: string;
}> = [
  { value: "concierge_doorman", label: "Concierge / Doorman" },
  { value: "elevator", label: "Elevator" },
  { value: "fitness_center", label: "Fitness Center" },
  { value: "pool", label: "Pool" },
  { value: "roof_deck", label: "Roof Deck" },
  { value: "resident_lounge", label: "Resident Lounge" },
  { value: "business_center", label: "Business Center" },
  { value: "package_room", label: "Package Room" },
  { value: "bike_storage", label: "Bike Storage" },
  { value: "garage_parking", label: "Garage Parking" },
  { value: "ev_charging", label: "EV Charging" },
  { value: "storage", label: "Storage" },
  { value: "pet_friendly", label: "Pet Friendly" },
  { value: "dog_wash_pet_spa", label: "Dog Wash / Pet Spa" },
  { value: "common_outdoor_space", label: "Common Outdoor Space" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

export const UNIT_TYPE_OPTIONS: Array<{
  value: (typeof DEVELOPMENT_UNIT_TYPES)[number];
  label: string;
}> = [
  { value: "studio", label: "Studio" },
  { value: "flat", label: "Flat" },
  { value: "duplex", label: "Duplex" },
  { value: "triplex", label: "Triplex" },
  { value: "loft", label: "Loft" },
  { value: "penthouse", label: "Penthouse" },
  { value: "townhome", label: "Townhome" },
  { value: "live_work", label: "Live / Work" },
  { value: "commercial", label: "Commercial" },
];

export const UNIT_FEATURE_OPTIONS: Array<{
  value: (typeof DEVELOPMENT_UNIT_FEATURES)[number];
  label: string;
}> = [
  { value: "balcony", label: "Balcony" },
  { value: "terrace", label: "Terrace" },
  { value: "private_roof_deck", label: "Private Roof Deck" },
  { value: "in_unit_laundry", label: "In-Unit Laundry" },
  { value: "central_air", label: "Central Air" },
  { value: "fireplace", label: "Fireplace" },
  { value: "walk_in_closet", label: "Walk-In Closet" },
  { value: "floor_to_ceiling_windows", label: "Floor-to-Ceiling Windows" },
  { value: "water_views", label: "Water Views" },
  { value: "city_views", label: "City Views" },
  { value: "garage_parking", label: "Garage Parking" },
  { value: "ev_charging", label: "EV Charging" },
  { value: "private_elevator", label: "Private Elevator" },
  { value: "smart_home", label: "Smart Home" },
  { value: "storage", label: "Storage" },
  { value: "other", label: "Other" },
];

export const UNIT_STATUS_OPTIONS: Array<{
  value: (typeof DEVELOPMENT_UNIT_STATUSES)[number];
  label: string;
}> = [
  { value: "not_released", label: "Not Released" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "under_agreement", label: "Under Agreement" },
  { value: "sold", label: "Sold" },
];

export function buildingTypeLabel(value: string | null | undefined): string {
  return BUILDING_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}

export function buildingAmenityLabel(value: string): string {
  return BUILDING_AMENITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function unitTypeLabel(value: string | null | undefined): string {
  return UNIT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}

export function unitFeatureLabel(value: string): string {
  return UNIT_FEATURE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function formatExpectedCompletion(parts: {
  expected_completion_year?: number | null;
  expected_completion_quarter?: number | null;
  expected_completion_month?: number | null;
  estimated_completion?: string | null;
}): string {
  const year = parts.expected_completion_year;
  if (year && parts.expected_completion_quarter) {
    return `Q${parts.expected_completion_quarter} ${year}`;
  }
  if (year && parts.expected_completion_month) {
    const d = new Date(year, parts.expected_completion_month - 1, 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  if (year) return String(year);
  if (parts.estimated_completion) {
    const d = new Date(
      parts.estimated_completion.includes("T")
        ? parts.estimated_completion
        : `${parts.estimated_completion}T00:00:00`,
    );
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
  }
  return "TBD";
}
