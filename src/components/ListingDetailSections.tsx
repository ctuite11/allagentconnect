import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, DollarSign, Building2, FileText, Calendar, Info } from "lucide-react";

interface ListingDetailSectionsProps {
  listing: any;
  agent?: any;
  isAgentView: boolean;
}

// Helper to format empty/null fields with placeholder
export const formatField = (value: any): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && value.trim() === '') return '—';
  return String(value);
};

export const ListingDetailSections = ({ listing, agent, isAgentView }: ListingDetailSectionsProps) => {
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showAllPropertyDetails, setShowAllPropertyDetails] = useState(false);
  const [showAllTaxInfo, setShowAllTaxInfo] = useState(false);
  
  const FEATURES_LIMIT = 16;
  const DETAIL_ROWS_LIMIT = 6;

  const DetailRow = ({ label, value }: { label: string; value: any }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex justify-between py-2 border-b last:border-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-right text-foreground">{value}</span>
      </div>
    );
  };

  const DetailGrid = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-0">{children}</div>
  );

  // Format arrays for display - deduplicate using Set
  const formatArray = (arr: any[] | null | undefined) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    const items = arr.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.name || item.label || item.value || JSON.stringify(item);
      }
      return String(item);
    });
    // Deduplicate items
    const uniqueItems = [...new Set(items)];
    return uniqueItems.join(', ');
  };

  const listDate = listing.active_date || listing.created_at;
  const daysOnMarket = listDate 
    ? Math.ceil((new Date().getTime() - new Date(listDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Gather all feature items for bullets
  const getFeatures = () => {
    const features: string[] = [];
    
    if (listing.heating_types && formatArray(listing.heating_types)) {
      features.push(`Heating: ${formatArray(listing.heating_types)}`);
    }
    if (listing.cooling_types && formatArray(listing.cooling_types)) {
      features.push(`Cooling: ${formatArray(listing.cooling_types)}`);
    }
    if (listing.has_basement) {
      const basementInfo = listing.basement_types && formatArray(listing.basement_types) 
        ? `Basement: ${formatArray(listing.basement_types)}`
        : 'Basement';
      features.push(basementInfo);
    }
    if (listing.basement_features_list && formatArray(listing.basement_features_list)) {
      features.push(`Basement Features: ${formatArray(listing.basement_features_list)}`);
    }
    
    // Combined property features + amenities
    const propFeatures = listing.property_features || [];
    const amenities = listing.amenities || [];
    const combined = [...new Set([...propFeatures, ...amenities])];
    combined.forEach((item: any) => {
      const name = typeof item === 'string' ? item : item.name || item.label || item.value;
      if (name) features.push(name);
    });
    
    if (listing.exterior_features_list && formatArray(listing.exterior_features_list)) {
      formatArray(listing.exterior_features_list)?.split(', ').forEach(f => features.push(f));
    }
    if (listing.parking_features_list && formatArray(listing.parking_features_list)) {
      features.push(`Parking: ${formatArray(listing.parking_features_list)}`);
    }
    if (listing.garage_features_list && formatArray(listing.garage_features_list)) {
      features.push(`Garage: ${formatArray(listing.garage_features_list)}`);
    }
    if (listing.foundation_types && formatArray(listing.foundation_types)) {
      features.push(`Foundation: ${formatArray(listing.foundation_types)}`);
    }
    if (listing.roof_materials && formatArray(listing.roof_materials)) {
      features.push(`Roof: ${formatArray(listing.roof_materials)}`);
    }
    if (listing.construction_features && formatArray(listing.construction_features)) {
      features.push(`Construction: ${formatArray(listing.construction_features)}`);
    }
    if (listing.green_features && formatArray(listing.green_features)) {
      features.push(`Green: ${formatArray(listing.green_features)}`);
    }
    if (listing.waterfront) features.push('Waterfront');
    if (listing.water_view) features.push(listing.water_view_type ? `Water View: ${listing.water_view_type}` : 'Water View');
    if (listing.beach_nearby) features.push('Beach Nearby');
    if (listing.area_amenities && listing.area_amenities.length > 0) {
      listing.area_amenities.forEach((a: string) => features.push(a));
    }
    if (listing.outdoor_space && formatArray(listing.outdoor_space)) {
      features.push(`Outdoor: ${formatArray(listing.outdoor_space)}`);
    }
    if (listing.laundry_type) features.push(`Laundry: ${listing.laundry_type}`);
    if (listing.num_fireplaces) features.push(`${listing.num_fireplaces} Fireplace(s)`);
    if (listing.pet_options && formatArray(listing.pet_options)) {
      features.push(`Pets: ${formatArray(listing.pet_options)}`);
    }
    if (listing.storage_options && formatArray(listing.storage_options)) {
      features.push(`Storage: ${formatArray(listing.storage_options)}`);
    }
    if (listing.handicap_accessible) features.push('Handicap Accessible');

    return [...new Set(features)];
  };

  const features = getFeatures();
  const displayedFeatures = showAllFeatures ? features : features.slice(0, FEATURES_LIMIT);

  // Build property details rows
  const propertyDetailRows = [
    { label: "Property Type", value: listing.property_type },
    { label: "Living Area", value: listing.square_feet ? `${listing.square_feet.toLocaleString()} sq ft` : null },
    { label: "Lot Size", value: listing.lot_size ? `${listing.lot_size} acres` : null },
    { label: "Year Built", value: listing.year_built },
    { label: "Stories/Floors", value: listing.floors },
    { label: "Bedrooms", value: listing.bedrooms },
    { label: "Bathrooms", value: listing.bathrooms },
    { label: "Total Parking Spaces", value: listing.total_parking_spaces },
    { label: "Garage Spaces", value: listing.garage_spaces },
    { label: "Unit Number", value: listing.unit_number },
    { label: "Building Name", value: listing.building_name },
    { label: "County", value: listing.county },
    { label: "Town", value: listing.town },
    { label: "Neighborhood", value: listing.neighborhood },
    { label: "Property Style", value: listing.property_styles ? formatArray(listing.property_styles) : null },
    { label: "Parcel ID / APN", value: listing.attom_id },
    { label: "Facing Direction", value: listing.facing_direction ? formatArray(listing.facing_direction) : null },
  ].filter(row => row.value);
  
  const displayedPropertyRows = showAllPropertyDetails ? propertyDetailRows : propertyDetailRows.slice(0, DETAIL_ROWS_LIMIT);

  // Build tax info rows
  const taxInfoRows = [
    { label: "Annual Tax", value: listing.annual_property_tax ? `$${listing.annual_property_tax.toLocaleString()}` : null },
    { label: "Tax Year", value: listing.tax_year },
    { label: "Tax Assessment", value: listing.tax_assessment_value ? `$${listing.tax_assessment_value.toLocaleString()}` : null },
    { label: "Assessed Value", value: listing.assessed_value ? `$${listing.assessed_value.toLocaleString()}` : null },
    { label: "Fiscal Year", value: listing.fiscal_year },
    { label: "Residential Exemption", value: listing.residential_exemption },
  ].filter(row => row.value);

  // Market info rows (always fully open since typically few rows)
  const marketInfoRows = [
    { label: "Listing Date", value: listDate ? new Date(listDate).toLocaleDateString() : null },
    { label: "Days on Market", value: daysOnMarket },
    { label: "Status", value: listing.status ? listing.status.charAt(0).toUpperCase() + listing.status.slice(1) : null },
    { label: "Listing Type", value: listing.listing_type === 'for_sale' ? 'For Sale' : listing.listing_type === 'for_rent' ? 'For Rent' : listing.listing_type },
    { label: "Listing Number (AAC ID)", value: listing.listing_number },
    { label: "Go Live Date", value: listing.go_live_date ? new Date(listing.go_live_date).toLocaleDateString() : null },
    { label: "Activation Date", value: listing.activation_date ? new Date(listing.activation_date).toLocaleDateString() : null },
    { label: "Expiration Date", value: listing.auto_activate_on ? new Date(listing.auto_activate_on).toLocaleDateString() : null },
    { label: "Off Market Date", value: listing.cancelled_at ? new Date(listing.cancelled_at).toLocaleDateString() : null },
  ].filter(row => row.value);

  return (
    <>
      {/* Property Features - Bullet Points, Two Columns - OPEN BY DEFAULT */}
      <Card className="rounded-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="w-5 h-5 text-primary" />
            Property Features
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-5">
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">No features listed</p>
          ) : (
            <>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-foreground">
                {displayedFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {features.length > FEATURES_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllFeatures(v => !v)}
                  className="text-primary font-medium text-sm mt-3"
                >
                  {showAllFeatures ? 'Show less' : `Show ${features.length - FEATURES_LIMIT} more`}
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Property Details - OPEN BY DEFAULT */}
      {propertyDetailRows.length > 0 && (
        <Card className="rounded-3xl">
        <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Home className="w-5 h-5 text-primary" />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-5">
            <DetailGrid>
              {displayedPropertyRows.map((row, idx) => (
                <DetailRow key={idx} label={row.label} value={row.value} />
              ))}
            </DetailGrid>
            {propertyDetailRows.length > DETAIL_ROWS_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllPropertyDetails(v => !v)}
                className="text-primary font-medium text-sm mt-3"
              >
                {showAllPropertyDetails ? 'Show less' : `Show ${propertyDetailRows.length - DETAIL_ROWS_LIMIT} more`}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Property Details (Condo/Multi-Family/Commercial) - OPEN BY DEFAULT */}
      {(listing.condo_details || listing.multi_family_details || listing.commercial_details) && (
        <Card className="rounded-3xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5 text-primary" />
              Additional Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-5">
            <DetailGrid>
              {listing.condo_details && typeof listing.condo_details === 'object' && (
                <>
                  {listing.condo_details.hoa_fee && (
                    <DetailRow label="HOA Fee" value={`$${listing.condo_details.hoa_fee}/month`} />
                  )}
                  {listing.condo_details.hoa_includes && (
                    <DetailRow label="HOA Includes" value={listing.condo_details.hoa_includes} />
                  )}
                  {listing.condo_details.association_name && (
                    <DetailRow label="Association" value={listing.condo_details.association_name} />
                  )}
                </>
              )}
              {listing.multi_family_details && typeof listing.multi_family_details === 'object' && (
                <>
                  {listing.multi_family_details.units && (
                    <DetailRow label="Number of Units" value={listing.multi_family_details.units} />
                  )}
                  {listing.multi_family_details.income && (
                    <DetailRow label="Annual Income" value={`$${listing.multi_family_details.income.toLocaleString()}`} />
                  )}
                </>
              )}
              {listing.commercial_details && typeof listing.commercial_details === 'object' && (
                <>
                  {listing.commercial_details.zoning && (
                    <DetailRow label="Zoning" value={listing.commercial_details.zoning} />
                  )}
                  {listing.commercial_details.building_class && (
                    <DetailRow label="Building Class" value={listing.commercial_details.building_class} />
                  )}
                </>
              )}
            </DetailGrid>
          </CardContent>
        </Card>
      )}

      {/* Tax Information - OPEN BY DEFAULT */}
      {taxInfoRows.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="w-5 h-5 text-primary" />
              Tax Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-5">
            <DetailGrid>
              {taxInfoRows.map((row, idx) => (
                <DetailRow key={idx} label={row.label} value={row.value} />
              ))}
            </DetailGrid>
          </CardContent>
        </Card>
      )}

      {/* Market Information - OPEN BY DEFAULT */}
      {marketInfoRows.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Market Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-5">
            <DetailGrid>
              {marketInfoRows.map((row, idx) => (
                <DetailRow key={idx} label={row.label} value={row.value} />
              ))}
            </DetailGrid>
          </CardContent>
        </Card>
      )}

      {/* Agent-Only: Firm Remarks */}
      {isAgentView && (
        <Card className="rounded-3xl border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-orange-900 dark:text-orange-100">
              <FileText className="w-5 h-5" />
              Firm Remarks
              <Badge variant="outline" className="ml-2 text-xs">Agent Only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-foreground/90">{listing.broker_comments || "N/A"}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
};
