import { SupabaseClient } from "@supabase/supabase-js";

interface SearchCriteria {
  statuses?: string[];
  propertyTypes?: string[];
  cities?: string[];
  state?: string;
  zipCode?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  minSqft?: number;
  maxSqft?: number;
  listingNumber?: string;
  
  // Agent-only filters
  listDate?: string;
  offMarketWindow?: string;
  onlyOpenHouses?: boolean;
  openHouseDays?: string;
  onlyBrokerTours?: boolean;
  brokerTourDays?: string;
  maxPricePerSqft?: number;
}

/**
 * Property type mapping from UI codes to database values
 */
const PROPERTY_TYPE_MAP: Record<string, string> = {
  'single_family': 'Single Family',
  'condo': 'Condominium',
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
  let query = supabase.from("listings").select("*");

  // Normalize criteria
  const criteria: Required<SearchCriteria> = {
    statuses: rawCriteria.statuses?.length ? rawCriteria.statuses : ["active", "coming_soon"],
    propertyTypes: rawCriteria.propertyTypes || [],
    cities: rawCriteria.cities || [],
    state: rawCriteria.state || "",
    zipCode: rawCriteria.zipCode || "",
    minPrice: rawCriteria.minPrice || 0,
    maxPrice: rawCriteria.maxPrice || 0,
    bedrooms: rawCriteria.bedrooms || 0,
    bathrooms: rawCriteria.bathrooms || 0,
    minSqft: rawCriteria.minSqft || 0,
    maxSqft: rawCriteria.maxSqft || 0,
    listingNumber: rawCriteria.listingNumber || "",
    listDate: rawCriteria.listDate || "",
    offMarketWindow: rawCriteria.offMarketWindow || "",
    onlyOpenHouses: rawCriteria.onlyOpenHouses || false,
    openHouseDays: rawCriteria.openHouseDays || "",
    onlyBrokerTours: rawCriteria.onlyBrokerTours || false,
    brokerTourDays: rawCriteria.brokerTourDays || "",
    maxPricePerSqft: rawCriteria.maxPricePerSqft || 0,
  };

  // Status filter (defaults to active and coming_soon)
  // Note: Private listings are included in the status filter when explicitly requested
  if (criteria.statuses.length > 0) {
    query = query.in("status", criteria.statuses);
  }

  // Property types - map UI codes to database values
  if (criteria.propertyTypes.length > 0) {
    const mappedTypes = criteria.propertyTypes.map(type => 
      PROPERTY_TYPE_MAP[type] || type
    );
    query = query.in("property_type", mappedTypes);
  }

  // Price filters
  if (criteria.minPrice > 0) {
    query = query.gte("price", criteria.minPrice);
  }
  if (criteria.maxPrice > 0) {
    query = query.lte("price", criteria.maxPrice);
  }

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

  // Cities and neighborhoods - case-insensitive matching
  if (criteria.cities.length > 0) {
    const cityFilters = criteria.cities.map(cityStr => {
      const parts = cityStr.split(',');
      const cityPart = parts[0].trim();
      
      // Check if it's a city-neighborhood format (e.g., "Boston-Charlestown")
      if (cityPart.includes('-')) {
        const [city, neighborhood] = cityPart.split('-').map(s => s.trim());
        return { city, neighborhood };
      }
      
      return { city: cityPart, neighborhood: null };
    });
    
    // Group by cities that have neighborhoods vs just cities
    const citiesWithNeighborhoods = cityFilters.filter(f => f.neighborhood);
    const citiesOnly = cityFilters.filter(f => !f.neighborhood).map(f => f.city);
    
    // Build PostgREST filter with wildcards for case-insensitive matching
    const wild = (v: string) => `*${String(v).replace(/[*",]/g, ' ').trim()}*`;
    
    if (citiesWithNeighborhoods.length > 0 || citiesOnly.length > 0) {
      const segments: string[] = [];
      
      // Add city-only filters
      if (citiesOnly.length > 0) {
        segments.push(...citiesOnly.map(c => `city.ilike.${wild(c)}`));
      }
      
      // Add city+neighborhood filters
      if (citiesWithNeighborhoods.length > 0) {
        segments.push(
          ...citiesWithNeighborhoods.map(f => 
            `and(city.ilike.${wild(f.city)},neighborhood.ilike.${wild(f.neighborhood!)})`
          )
        );
      }
      
      query = query.or(segments.join(','));
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

  // Default ordering
  query = query.order("created_at", { ascending: false });

  return query;
}
