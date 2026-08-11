import { SupabaseClient } from "@supabase/supabase-js";
import { applyLocationFilter } from "./buildLocationFilter";
import { applyDcmlsFilter } from "./dcmlsFilter";
import { applyListingPriceOverlapFilter } from "./applyListingPriceOverlapFilter";

interface SearchCriteria {
  statuses?: string[];
  propertyTypes?: string[];
  cities?: string[];
  neighborhoods?: string[];
  state?: string;
  zipCode?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  minSqft?: number;
  maxSqft?: number;
  listingNumber?: string;
  
  // Listing type filter
  listingType?: string;
  
  // Agent-only filters
  listDate?: string;
  offMarketWindow?: string;
  onlyOpenHouses?: boolean;
  openHouseDays?: string;
  onlyBrokerTours?: boolean;
  brokerTourDays?: string;
  maxPricePerSqft?: number;

  // DCMLS filter — when true, only show DCMLS-published listings
  dcmlsOnly?: boolean;
}

/**
 * Property type mapping from UI codes to database values
 */
const PROPERTY_TYPE_MAP: Record<string, string> = {
  'single_family': 'Single Family',
  'condo': 'condo',
  'Condominium': 'condo',
  'multi_family': 'Multi Family',
  'townhouse': 'Townhouse',
  'land': 'Land',
  'commercial': 'Commercial',
  'business_opp': 'Business Opportunity'
};

/**
 * Builds a unified Supabase query for listings based on search criteria.
 * Handles case-insensitive matching for cities, states, and partial zip codes.
 * 
 * @param supabase - Supabase client instance
 * @param rawCriteria - Search criteria object
 * @returns Supabase query builder (caller should add .limit() as needed)
 */
export function buildListingsQuery(
  supabase: SupabaseClient,
  rawCriteria: SearchCriteria
) {
  // Marketing-only public view — anon cannot SELECT public.listings after Phase 3.
  // Authenticated hot-sheet / browse callers use the same safe column set.
  let query = supabase.from("listings_public").select("*");

  // Normalize criteria
  // Note: honor the caller's statuses array as-is. An empty array is a valid
  // "no status selected" signal and must yield zero results (see filter below).
  const criteria: Required<SearchCriteria> = {
    statuses: rawCriteria.statuses ?? [],
    propertyTypes: rawCriteria.propertyTypes || [],
    cities: rawCriteria.cities || [],
    neighborhoods: rawCriteria.neighborhoods || [],
    state: rawCriteria.state || "",
    zipCode: rawCriteria.zipCode || "",
    minPrice: rawCriteria.minPrice || 0,
    maxPrice: rawCriteria.maxPrice || 0,
    bedrooms: rawCriteria.bedrooms || 0,
    bathrooms: rawCriteria.bathrooms || 0,
    minSqft: rawCriteria.minSqft || 0,
    maxSqft: rawCriteria.maxSqft || 0,
    listingNumber: rawCriteria.listingNumber || "",
    listingType: rawCriteria.listingType || "",
    listDate: rawCriteria.listDate || "",
    offMarketWindow: rawCriteria.offMarketWindow || "",
    onlyOpenHouses: rawCriteria.onlyOpenHouses || false,
    openHouseDays: rawCriteria.openHouseDays || "",
    onlyBrokerTours: rawCriteria.onlyBrokerTours || false,
    brokerTourDays: rawCriteria.brokerTourDays || "",
    maxPricePerSqft: rawCriteria.maxPricePerSqft || 0,
    dcmlsOnly: rawCriteria.dcmlsOnly || false,
  };

  // Listing type filter (for_sale / for_rent)
  if (criteria.listingType) {
    query = query.eq("listing_type", criteria.listingType);
  }

  // Status filter — if no statuses are selected, return zero results
  // rather than silently defaulting to active/coming_soon.
  if (criteria.statuses.length > 0) {
    query = query.in("status", criteria.statuses);
  } else {
    query = query.in("status", ["__none__"]);
  }

  // Property types - map UI codes to database values
  if (criteria.propertyTypes.length > 0) {
    const mappedTypes = criteria.propertyTypes.map(type => 
      PROPERTY_TYPE_MAP[type] || type
    );
    query = query.in("property_type", mappedTypes);
  }

  // Price: fixed `price`, `price_range_min`/`price_range_max`, or single-ended range — overlap search band
  query = applyListingPriceOverlapFilter(
    query,
    criteria.minPrice > 0 ? criteria.minPrice : null,
    criteria.maxPrice > 0 ? criteria.maxPrice : null,
  );

  // Bedrooms/bathrooms
  if (criteria.bedrooms > 0) {
    query = query.gte("bedrooms", criteria.bedrooms);
  }
  if (criteria.bathrooms > 0) {
    query = query.gte("bathrooms", criteria.bathrooms);
  }

  // Square feet
  if (criteria.minSqft > 0) {
    query = query.gte("square_feet", criteria.minSqft);
  }
  if (criteria.maxSqft > 0) {
    query = query.lte("square_feet", criteria.maxSqft);
  }

  // State filter (case-insensitive)
  if (criteria.state) {
    query = query.ilike("state", criteria.state);
  }

  // Cities and neighborhoods — unified case-insensitive matching
  // Combine cities and standalone neighborhoods into one canonical array
  // then delegate to the shared applyLocationFilter utility.
  {
    const combinedTowns: string[] = [...criteria.cities];

    // Fold standalone neighborhoods into the canonical "City-Neighborhood" or
    // plain neighborhood format that applyLocationFilter expects.
    // Standalone neighborhoods without a city prefix are kept as-is (plain city match).
    for (const n of criteria.neighborhoods) {
      if (!combinedTowns.includes(n)) {
        combinedTowns.push(n);
      }
    }

    if (combinedTowns.length > 0) {
      query = applyLocationFilter(query, combinedTowns);
    }
  }

  // Zip code filter
  if (criteria.zipCode) {
    // Exact match for 5-digit zip codes, partial match otherwise
    if (/^\d{5}$/.test(criteria.zipCode)) {
      query = query.eq("zip_code", criteria.zipCode);
    } else {
      query = query.ilike("zip_code", `%${criteria.zipCode}%`);
    }
  }

  // Listing number filter (case-insensitive)
  if (criteria.listingNumber) {
    query = query.ilike("listing_number", `%${criteria.listingNumber}%`);
  }

  // Agent-only: List Date filter
  if (criteria.listDate && criteria.listDate !== "any") {
    const now = new Date();
    let cutoffDate: Date;
    
    if (criteria.listDate === "today") {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      const days = parseInt(criteria.listDate);
      cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    
    query = query.gte("created_at", cutoffDate.toISOString());
  }

  // Agent-only: Off-Market Window filter
  if (criteria.offMarketWindow && criteria.offMarketWindow !== "any") {
    const now = new Date();
    const days = parseInt(criteria.offMarketWindow);
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    query = query.gte("updated_at", cutoffDate.toISOString());
  }

  // Agent-only: Open Houses filter
  if (criteria.onlyOpenHouses) {
    query = query.not("open_houses", "is", null);
    
    if (criteria.openHouseDays) {
      const days = parseInt(criteria.openHouseDays);
      const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      // This would need more complex filtering on the JSON field
      // For now, we just check that open_houses exists
    }
  }

  // Agent-only: Broker Tours filter (similar to open houses)
  if (criteria.onlyBrokerTours) {
    // Assuming there's a broker_tours field in the listings table
    // If not, this would need to be adjusted based on actual schema
  }

  // Agent-only: Price Per SqFt Max
  if (criteria.maxPricePerSqft && criteria.maxPricePerSqft > 0) {
    // Calculate price per sqft on the fly: price / square_feet <= maxPricePerSqft
    // Note: This requires filtering in post-processing or using a computed column
    // For now, we'll add a filter that checks if the listing has square_feet
    query = query.not("square_feet", "is", null);
    query = query.gt("square_feet", 0);
  }

  // DCMLS-only filter: restrict to published DCMLS listings
  if (criteria.dcmlsOnly) {
    query = applyDcmlsFilter(query);
  }

  // Default ordering
  query = query.order("created_at", { ascending: false });

  return query;
}
