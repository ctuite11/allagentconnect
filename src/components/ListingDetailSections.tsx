import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Home, DollarSign, Building2, FileText, Calendar, Info } from "lucide-react";

interface ListingDetailSectionsProps {
  listing: any;
  agent?: any;
  isAgentView: boolean;
}

export const ListingDetailSections = ({ listing, agent, isAgentView }: ListingDetailSectionsProps) => {
  const DetailRow = ({ label, value }: { label: string; value: any }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex justify-between py-2 border-b last:border-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-right">{value}</span>
      </div>
    );
  };

  const DetailGrid = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-0">{children}</div>
  );

  // Format arrays for display
  const formatArray = (arr: any[] | null | undefined) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.name || item.label || item.value || JSON.stringify(item);
      }
      return String(item);
    }).join(', ');
  };

  const listDate = listing.active_date || listing.created_at;
  const daysOnMarket = listDate 
    ? Math.ceil((new Date().getTime() - new Date(listDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <section className="mt-6 max-w-6xl mx-auto px-4 pb-10">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Property Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5" />
                Property Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailRow label="Property Type" value={listing.property_type} />
                <DetailRow label="Living Area" value={listing.square_feet ? `${listing.square_feet.toLocaleString()} sq ft` : null} />
                <DetailRow label="Lot Size" value={listing.lot_size ? `${listing.lot_size} acres` : null} />
                <DetailRow label="Bedrooms" value={listing.bedrooms} />
                <DetailRow label="Bathrooms" value={listing.bathrooms} />
                <DetailRow label="Year Built" value={listing.year_built} />
                <DetailRow label="Floors" value={listing.floors} />
                <DetailRow label="Total Parking Spaces" value={listing.total_parking_spaces} />
                <DetailRow label="Garage Spaces" value={listing.garage_spaces} />
                <DetailRow label="Fireplaces" value={listing.num_fireplaces} />
                {listing.unit_number && <DetailRow label="Unit Number" value={listing.unit_number} />}
                {listing.building_name && <DetailRow label="Building Name" value={listing.building_name} />}
              </DetailGrid>
            </CardContent>
          </Card>

          {/* Features & Amenities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Features & Amenities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                {listing.heating_types && formatArray(listing.heating_types) && (
                  <DetailRow label="Heating" value={formatArray(listing.heating_types)} />
                )}
                {listing.cooling_types && formatArray(listing.cooling_types) && (
                  <DetailRow label="Cooling" value={formatArray(listing.cooling_types)} />
                )}
                {listing.laundry_type && <DetailRow label="Laundry" value={listing.laundry_type} />}
                <DetailRow label="Basement" value={listing.has_basement ? 'Yes' : null} />
                {listing.basement_types && formatArray(listing.basement_types) && (
                  <DetailRow label="Basement Type" value={formatArray(listing.basement_types)} />
                )}
                {listing.basement_features_list && formatArray(listing.basement_features_list) && (
                  <DetailRow label="Basement Features" value={formatArray(listing.basement_features_list)} />
                )}
                {listing.foundation_types && formatArray(listing.foundation_types) && (
                  <DetailRow label="Foundation" value={formatArray(listing.foundation_types)} />
                )}
                {listing.roof_materials && formatArray(listing.roof_materials) && (
                  <DetailRow label="Roof" value={formatArray(listing.roof_materials)} />
                )}
                {listing.exterior_features_list && formatArray(listing.exterior_features_list) && (
                  <DetailRow label="Exterior Features" value={formatArray(listing.exterior_features_list)} />
                )}
                {listing.parking_features_list && formatArray(listing.parking_features_list) && (
                  <DetailRow label="Parking Features" value={formatArray(listing.parking_features_list)} />
                )}
                {listing.garage_features_list && formatArray(listing.garage_features_list) && (
                  <DetailRow label="Garage Features" value={formatArray(listing.garage_features_list)} />
                )}
                {listing.green_features && formatArray(listing.green_features) && (
                  <DetailRow label="Green Features" value={formatArray(listing.green_features)} />
                )}
                {listing.construction_features && formatArray(listing.construction_features) && (
                  <DetailRow label="Construction" value={formatArray(listing.construction_features)} />
                )}
                <DetailRow label="Waterfront" value={listing.waterfront ? 'Yes' : null} />
                <DetailRow label="Water View" value={listing.water_view ? listing.water_view_type || 'Yes' : null} />
                <DetailRow label="Beach Nearby" value={listing.beach_nearby ? 'Yes' : null} />
                {listing.area_amenities && listing.area_amenities.length > 0 && (
                  <DetailRow label="Area Amenities" value={listing.area_amenities.join(', ')} />
                )}
                {listing.outdoor_space && formatArray(listing.outdoor_space) && (
                  <DetailRow label="Outdoor Space" value={formatArray(listing.outdoor_space)} />
                )}
                {listing.pet_options && formatArray(listing.pet_options) && (
                  <DetailRow label="Pets" value={formatArray(listing.pet_options)} />
                )}
                {listing.pets_comment && <DetailRow label="Pet Notes" value={listing.pets_comment} />}
                {listing.storage_options && formatArray(listing.storage_options) && (
                  <DetailRow label="Storage" value={formatArray(listing.storage_options)} />
                )}
                <DetailRow label="Handicap Accessible" value={listing.handicap_accessible} />
              </DetailGrid>
            </CardContent>
          </Card>

          {/* Market Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Market Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                {listDate && <DetailRow label="Listing Date" value={new Date(listDate).toLocaleDateString()} />}
                {daysOnMarket && <DetailRow label="Days on Market" value={daysOnMarket} />}
                <DetailRow label="Status" value={listing.status.charAt(0).toUpperCase() + listing.status.slice(1)} />
                <DetailRow label="Listing Type" value={listing.listing_type === 'for_sale' ? 'For Sale' : 'For Rent'} />
                {listing.listing_number && <DetailRow label="Listing Number" value={listing.listing_number} />}
                {listing.go_live_date && <DetailRow label="Go Live Date" value={new Date(listing.go_live_date).toLocaleDateString()} />}
                {listing.activation_date && <DetailRow label="Activation Date" value={new Date(listing.activation_date).toLocaleDateString()} />}
                {listing.cancelled_at && <DetailRow label="Off Market Date" value={new Date(listing.cancelled_at).toLocaleDateString()} />}
              </DetailGrid>
            </CardContent>
          </Card>

          {/* Additional Notes (if any) */}
          {listing.additional_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{listing.additional_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Condo/Multi-Family/Commercial Details */}
          {(listing.condo_details || listing.multi_family_details || listing.commercial_details) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Additional Property Details
                </CardTitle>
              </CardHeader>
              <CardContent>
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

          {/* Tax Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Tax Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                {listing.attom_id && <DetailRow label="Parcel ID" value={listing.attom_id} />}
                <DetailRow label="Annual Tax" value={listing.annual_property_tax ? `$${listing.annual_property_tax.toLocaleString()}` : null} />
                <DetailRow label="Tax Year" value={listing.tax_year} />
                <DetailRow label="Tax Assessment" value={listing.tax_assessment_value ? `$${listing.tax_assessment_value.toLocaleString()}` : null} />
                <DetailRow label="Assessed Value" value={listing.assessed_value ? `$${listing.assessed_value.toLocaleString()}` : null} />
                <DetailRow label="Fiscal Year" value={listing.fiscal_year} />
                <DetailRow label="Residential Exemption" value={listing.residential_exemption} />
              </DetailGrid>
            </CardContent>
          </Card>

          {/* Other Property Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Other Property Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                {listing.disclosures && formatArray(listing.disclosures) && (
                  <DetailRow label="Disclosures" value={formatArray(listing.disclosures)} />
                )}
                {listing.disclosures_other && <DetailRow label="Other Disclosures" value={listing.disclosures_other} />}
                <DetailRow label="Lead Paint" value={listing.lead_paint} />
                <DetailRow label="Short Sale" value={listing.short_sale ? 'Yes' : null} />
                <DetailRow label="Lender Owned" value={listing.lender_owned ? 'Yes' : null} />
                {listing.listing_agreement_types && formatArray(listing.listing_agreement_types) && (
                  <DetailRow label="Agreement Type" value={formatArray(listing.listing_agreement_types)} />
                )}
                {listing.listing_exclusions && <DetailRow label="Exclusions" value={listing.listing_exclusions} />}
              </DetailGrid>
            </CardContent>
          </Card>

          {/* Office/Agent Information & Buyer Compensation */}
          <Card>
            <CardHeader>
              <CardTitle>Office & Agent Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-3">Listing Information</h4>
                <DetailGrid>
                  {agent && <DetailRow label="Listing Agent" value={`${agent.first_name} ${agent.last_name}`} />}
                  {agent?.title && <DetailRow label="Agent Title" value={agent.title} />}
                  {agent?.company && <DetailRow label="Company" value={agent.company} />}
                  {agent?.office_name && <DetailRow label="Office" value={agent.office_name} />}
                  {(agent?.cell_phone || agent?.phone) && (
                    <DetailRow label="Agent Phone" value={agent.cell_phone || agent.phone} />
                  )}
                  {agent?.email && <DetailRow label="Agent Email" value={agent.email} />}
                </DetailGrid>
              </div>
              
              {(listing.commission_rate || listing.commission_type || listing.commission_notes) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Buyer Agent Compensation</h4>
                    <DetailGrid>
                      {listing.commission_rate && listing.commission_type && (
                        <DetailRow 
                          label="Commission" 
                          value={listing.commission_type === 'percentage' 
                            ? `${listing.commission_rate}% of sale price`
                            : `$${listing.commission_rate.toLocaleString()} flat fee`
                          } 
                        />
                      )}
                      {listing.commission_notes && (
                        <div className="py-2">
                          <p className="text-sm text-muted-foreground mb-1">Commission Notes:</p>
                          <p className="text-sm">{listing.commission_notes}</p>
                        </div>
                      )}
                    </DetailGrid>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Agent-Only: Firm Remarks */}
          {isAgentView && listing.broker_comments && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <FileText className="w-5 h-5" />
                  Firm Remarks (Internal)
                  <Badge variant="outline" className="ml-2">Agent Only</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{listing.broker_comments}</p>
              </CardContent>
            </Card>
          )}

          {/* Agent-Only: Showing Instructions */}
          {isAgentView && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Info className="w-5 h-5" />
                  Showing Instructions (Internal)
                  <Badge variant="outline" className="ml-2">Agent Only</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DetailGrid>
                  {listing.showing_instructions && (
                    <div className="py-2">
                      <p className="text-sm font-medium mb-1">Instructions:</p>
                      <p className="text-sm whitespace-pre-wrap">{listing.showing_instructions}</p>
                    </div>
                  )}
                  <DetailRow label="Appointment Required" value={listing.appointment_required ? 'Yes' : 'No'} />
                  <DetailRow label="Entry Only" value={listing.entry_only ? 'Yes' : null} />
                  {listing.lockbox_code && <DetailRow label="Lockbox Code" value={listing.lockbox_code} />}
                  {listing.showing_contact_name && <DetailRow label="Contact Name" value={listing.showing_contact_name} />}
                  {listing.showing_contact_phone && <DetailRow label="Contact Phone" value={listing.showing_contact_phone} />}
                </DetailGrid>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
};

