import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const listingSchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(1, "Zip code is required"),
  property_type: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  square_feet: z.number().nullable(),
  description: z.string().optional(),
  status: z.string(),
});

const EditListing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    listing_type: "for_sale",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    property_type: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    square_feet: "",
    description: "",
    status: "active",
    commission_rate: "",
    commission_type: "percentage",
    commission_notes: "",
    showing_instructions: "",
    lockbox_code: "",
    appointment_required: false,
    showing_contact_name: "",
    showing_contact_phone: "",
    additional_notes: "",
    annual_property_tax: "",
    tax_assessment_value: "",
    tax_year: "",
    lot_size: "",
    year_built: "",
    num_fireplaces: "",
  });

  const [disclosures, setDisclosures] = useState<string[]>([]);
  const [propertyFeatures, setPropertyFeatures] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [manualAddressDialogOpen, setManualAddressDialogOpen] = useState(false);
  
  // Unit number for condos, townhouses, rentals
  const [unitNumber, setUnitNumber] = useState("");
  const [hoaFee, setHoaFee] = useState("");
  const [hoaFeeFrequency, setHoaFeeFrequency] = useState("monthly");
  
  // New comprehensive fields
  const [assessedValue, setAssessedValue] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [residentialExemption, setResidentialExemption] = useState("");
  const [floors, setFloors] = useState("");
  const [basementType, setBasementType] = useState("");
  const [basementFeatures, setBasementFeatures] = useState<string[]>([]);
  const [basementFloorType, setBasementFloorType] = useState<string[]>([]);
  const [leadPaint, setLeadPaint] = useState("");
  const [handicapAccess, setHandicapAccess] = useState("");
  const [foundation, setFoundation] = useState<string[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState("");
  const [parkingComments, setParkingComments] = useState("");
  const [parkingFeatures, setParkingFeatures] = useState<string[]>([]);
  const [garageSpaces, setGarageSpaces] = useState("");
  const [garageComments, setGarageComments] = useState("");
  const [garageFeatures, setGarageFeatures] = useState<string[]>([]);
  const [lotSizeSource, setLotSizeSource] = useState("");
  const [lotDescription, setLotDescription] = useState<string[]>([]);
  const [sellerDisclosure, setSellerDisclosure] = useState("");
  const [disclosuresText, setDisclosuresText] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [brokerComments, setBrokerComments] = useState("");

  useEffect(() => {
    const checkAuthAndLoadListing = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      if (id) {
        await loadListing(id, session.user.id);
      }
    };

    checkAuthAndLoadListing();
  }, [id, navigate]);

  const loadListing = async (listingId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .eq("agent_id", userId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          listing_type: data.listing_type || "for_sale",
          address: data.address,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          property_type: data.property_type || "",
          price: data.price.toString(),
          bedrooms: data.bedrooms?.toString() || "",
          bathrooms: data.bathrooms?.toString() || "",
          square_feet: data.square_feet?.toString() || "",
          description: data.description || "",
          status: data.status,
          commission_rate: data.commission_rate?.toString() || "",
          commission_type: data.commission_type || "percentage",
          commission_notes: data.commission_notes || "",
          showing_instructions: data.showing_instructions || "",
          lockbox_code: data.lockbox_code || "",
          appointment_required: data.appointment_required || false,
          showing_contact_name: data.showing_contact_name || "",
          showing_contact_phone: data.showing_contact_phone || "",
          additional_notes: data.additional_notes || "",
          annual_property_tax: data.annual_property_tax?.toString() || "",
          tax_assessment_value: data.tax_assessment_value?.toString() || "",
          tax_year: data.tax_year?.toString() || "",
          lot_size: data.lot_size?.toString() || "",
          year_built: data.year_built?.toString() || "",
          num_fireplaces: data.num_fireplaces?.toString() || "",
        });
        setDisclosures(Array.isArray(data.disclosures) ? data.disclosures as string[] : []);
        setPropertyFeatures(Array.isArray(data.property_features) ? data.property_features as string[] : []);
        setAmenities(Array.isArray(data.amenities) ? data.amenities as string[] : []);
        
        // Extract unit number from condo_details if available
        if (data.property_type === "Condominium" && data.condo_details) {
          try {
            const condoDetails = typeof data.condo_details === 'string' 
              ? JSON.parse(data.condo_details) 
              : data.condo_details;
            if (condoDetails?.unit_number) {
              setUnitNumber(condoDetails.unit_number);
            }
            if (condoDetails?.hoa_fee) {
              setHoaFee(condoDetails.hoa_fee.toString());
            }
            if (condoDetails?.hoa_fee_frequency) {
              setHoaFeeFrequency(condoDetails.hoa_fee_frequency);
            }
          } catch (e) {
            console.error("Error parsing condo_details:", e);
          }
        }

        // Parse comprehensive fields from disclosures array
        const disclosuresArray = Array.isArray(data.disclosures) ? data.disclosures as string[] : [];
        disclosuresArray.forEach((d: string) => {
          if (d.startsWith('Residential Exemption:')) setResidentialExemption(d.replace('Residential Exemption: ', ''));
          if (d.startsWith('Floors:')) setFloors(d.replace('Floors: ', ''));
          if (d.startsWith('Basement Type:')) setBasementType(d.replace('Basement Type: ', ''));
          if (d.startsWith('Basement Features:')) setBasementFeatures(d.replace('Basement Features: ', '').split(', '));
          if (d.startsWith('Basement Floor Type:')) setBasementFloorType(d.replace('Basement Floor Type: ', '').split(', '));
          if (d.startsWith('Lead Paint:')) setLeadPaint(d.replace('Lead Paint: ', ''));
          if (d.startsWith('Handicap Access:')) setHandicapAccess(d.replace('Handicap Access: ', ''));
          if (d.startsWith('Foundation:')) setFoundation(d.replace('Foundation: ', '').split(', '));
          if (d.startsWith('Parking Comments:')) setParkingComments(d.replace('Parking Comments: ', ''));
          if (d.startsWith('Parking Features:')) setParkingFeatures(d.replace('Parking Features: ', '').split(', '));
          if (d.startsWith('Garage Comments:')) setGarageComments(d.replace('Garage Comments: ', ''));
          if (d.startsWith('Garage Features:')) setGarageFeatures(d.replace('Garage Features: ', '').split(', '));
          if (d.startsWith('Lot Size Source:')) setLotSizeSource(d.replace('Lot Size Source: ', ''));
          if (d.startsWith('Lot Description:')) setLotDescription(d.replace('Lot Description: ', '').split(', '));
          if (d.startsWith('Seller Disclosure:')) setSellerDisclosure(d.replace('Seller Disclosure: ', ''));
          if (d.startsWith('Disclosures:')) setDisclosuresText(d.replace('Disclosures: ', ''));
          if (d.startsWith('Exclusions:')) setExclusions(d.replace('Exclusions: ', ''));
        });
        
        // Load parking and garage spaces from total_parking_spaces and garage_spaces
        if (data.total_parking_spaces) {
          setParkingSpaces(data.total_parking_spaces.toString());
        }
        if (data.garage_spaces) {
          setGarageSpaces(data.garage_spaces.toString());
        }
        
        // Parse broker comments from additional_notes
        if (data.additional_notes?.includes('Broker Comments:')) {
          const parts = data.additional_notes.split('Broker Comments:');
          setBrokerComments(parts[1]?.trim() || '');
        }
      }
    } catch (error: any) {
      toast.error("Error loading listing: " + error.message);
      navigate("/agent-dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = (place: google.maps.places.PlaceResult) => {
    const addressComponents = place.address_components || [];
    const getComponent = (type: string) => {
      const component = addressComponents.find((c) => c.types.includes(type));
      return component?.long_name || "";
    };

    const address = place.formatted_address?.split(",")[0] || "";
    const city = getComponent("locality") || getComponent("sublocality");
    const state = getComponent("administrative_area_level_1");
    const zip_code = getComponent("postal_code");

    setFormData({
      ...formData,
      address,
      city,
      state,
      zip_code,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate unit number for Condominium and Townhouse
    if ((formData.property_type === "Condominium" || formData.property_type === "Townhouse") && !unitNumber.trim()) {
      toast.error("Unit number is required for condominium and townhouse properties");
      return;
    }

    setSubmitting(true);

    try {
      // Build updated disclosures array
      const updatedDisclosures = [...disclosures];
      
      if (residentialExemption) updatedDisclosures.push(`Residential Exemption: ${residentialExemption}`);
      if (floors) updatedDisclosures.push(`Floors: ${floors}`);
      if (basementType) updatedDisclosures.push(`Basement Type: ${basementType}`);
      if (basementFeatures.length > 0) updatedDisclosures.push(`Basement Features: ${basementFeatures.join(', ')}`);
      if (basementFloorType.length > 0) updatedDisclosures.push(`Basement Floor Type: ${basementFloorType.join(', ')}`);
      if (leadPaint) updatedDisclosures.push(`Lead Paint: ${leadPaint}`);
      if (handicapAccess) updatedDisclosures.push(`Handicap Access: ${handicapAccess}`);
      if (foundation.length > 0) updatedDisclosures.push(`Foundation: ${foundation.join(', ')}`);
      if (parkingComments) updatedDisclosures.push(`Parking Comments: ${parkingComments}`);
      if (parkingFeatures.length > 0) updatedDisclosures.push(`Parking Features: ${parkingFeatures.join(', ')}`);
      if (garageComments) updatedDisclosures.push(`Garage Comments: ${garageComments}`);
      if (garageFeatures.length > 0) updatedDisclosures.push(`Garage Features: ${garageFeatures.join(', ')}`);
      if (lotSizeSource) updatedDisclosures.push(`Lot Size Source: ${lotSizeSource}`);
      if (lotDescription.length > 0) updatedDisclosures.push(`Lot Description: ${lotDescription.join(', ')}`);
      if (sellerDisclosure) updatedDisclosures.push(`Seller Disclosure: ${sellerDisclosure}`);
      if (disclosuresText) updatedDisclosures.push(`Disclosures: ${disclosuresText}`);
      if (exclusions) updatedDisclosures.push(`Exclusions: ${exclusions}`);

      // Build additional notes with broker comments
      let additionalNotes = formData.additional_notes;
      if (brokerComments) {
        additionalNotes += `\n\nBroker Comments: ${brokerComments}`;
      }

      const dataToUpdate: any = {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        property_type: formData.property_type || null,
        price: parseFloat(formData.price),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
        lot_size: formData.lot_size ? parseFloat(formData.lot_size) : null,
        year_built: formData.year_built ? parseInt(formData.year_built) : null,
        description: formData.description || null,
        status: formData.status,
        commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
        commission_type: formData.commission_type,
        commission_notes: formData.commission_notes || null,
        showing_instructions: formData.showing_instructions || null,
        lockbox_code: formData.lockbox_code || null,
        appointment_required: formData.appointment_required,
        showing_contact_name: formData.showing_contact_name || null,
        showing_contact_phone: formData.showing_contact_phone || null,
        disclosures: updatedDisclosures,
        property_features: propertyFeatures,
        amenities: amenities,
        additional_notes: additionalNotes || null,
        annual_property_tax: formData.annual_property_tax ? parseFloat(formData.annual_property_tax) : null,
        tax_assessment_value: formData.tax_assessment_value ? parseFloat(formData.tax_assessment_value) : null,
        tax_year: formData.tax_year ? parseInt(formData.tax_year) : null,
        num_fireplaces: formData.num_fireplaces ? parseInt(formData.num_fireplaces) : null,
        total_parking_spaces: parkingSpaces ? parseInt(parkingSpaces) : null,
        garage_spaces: garageSpaces ? parseInt(garageSpaces) : null,
      };

      // Update condo_details if it's a condominium
      if (formData.property_type?.includes("Condo") && unitNumber) {
        // Fetch existing condo_details first
        const { data: existingData } = await supabase
          .from("listings")
          .select("condo_details")
          .eq("id", id)
          .single();
        
        const existingCondoDetails = existingData?.condo_details 
          ? (typeof existingData.condo_details === 'string' 
            ? JSON.parse(existingData.condo_details) 
            : existingData.condo_details)
          : {};
        
        dataToUpdate.condo_details = {
          ...existingCondoDetails,
          unit_number: unitNumber,
          hoa_fee: hoaFee ? parseFloat(hoaFee) : null,
          hoa_fee_frequency: hoaFeeFrequency,
        };
      }

      const validated = listingSchema.parse(dataToUpdate);

      const { error } = await supabase
        .from("listings")
        .update(validated)
        .eq("id", id);

      if (error) throw error;

      toast.success("Listing updated successfully!");
      navigate("/agent-dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Error updating listing: " + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Manual Address Entry Dialog */}
      <Dialog open={manualAddressDialogOpen} onOpenChange={setManualAddressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Address Manually</DialogTitle>
            <DialogDescription>
              Fill in the address details manually if autocomplete doesn't find your property.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="manual-address">Street Address *</Label>
              <Input
                id="manual-address"
                placeholder="123 Main Street"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manual-city">City *</Label>
                <Input
                  id="manual-city"
                  placeholder="Boston"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-state">State *</Label>
                <Input
                  id="manual-state"
                  placeholder="MA"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-zip">ZIP Code *</Label>
              <Input
                id="manual-zip"
                placeholder="02101"
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                maxLength={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualAddressDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (formData.address && formData.city && formData.state && formData.zip_code) {
                  setManualAddressDialogOpen(false);
                  toast.success("Address entered manually");
                } else {
                  toast.error("Please fill in all address fields");
                }
              }}
            >
              Save Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Edit Listing</CardTitle>
            <CardDescription>Update your property listing details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Listing Type */}
              <div className="space-y-2">
                <Label htmlFor="listing_type">Listing Type</Label>
                <Select
                  value={formData.listing_type}
                  onValueChange={(value) => setFormData({ ...formData, listing_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="for_sale">For Sale</SelectItem>
                    <SelectItem value="for_rent">For Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Property Type */}
              <div className="space-y-2">
                <Label htmlFor="property_type">Property Type</Label>
                <Select
                  value={formData.property_type}
                  onValueChange={(value) => setFormData({ ...formData, property_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single Family">Single Family</SelectItem>
                    <SelectItem value="Condominium">Condominium</SelectItem>
                    <SelectItem value="Townhouse">Townhouse</SelectItem>
                    <SelectItem value="Multi-Family">Multi-Family</SelectItem>
                    <SelectItem value="Land">Land</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Mobile Home">Mobile Home</SelectItem>
                    <SelectItem value="Co-op">Co-op</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="address">Address</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setManualAddressDialogOpen(true)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Enter manually
                  </Button>
                </div>
                <AddressAutocomplete
                  onPlaceSelect={handleAddressSelect}
                  placeholder="Enter property address"
                  value={formData.address}
                  onChange={(val) => setFormData({ ...formData, address: val })}
                />
                <p className="text-xs text-muted-foreground">
                  Can't find your address? Click "Enter manually" above
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip Code</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  required
                />
              </div>

              {/* Unit Number - for properties with units */}
              {(formData.property_type?.includes("Condo") || 
                formData.property_type?.includes("Townhouse") || 
                formData.property_type?.includes("Multi") || 
                formData.property_type?.includes("Rental") ||
                formData.listing_type === "for_rent") && (
                <div className="space-y-2">
                  <Label htmlFor="unit_number">
                    Unit/Apartment Number
                    {(formData.property_type?.includes("Condo") || formData.property_type?.includes("Townhouse")) && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    id="unit_number"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    placeholder="e.g., 3B, 205, Apt 4"
                    required={formData.property_type?.includes("Condo") || formData.property_type?.includes("Townhouse")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(formData.property_type?.includes("Condo") || formData.property_type?.includes("Townhouse"))
                      ? "Required - Helps identify the specific unit and fetch accurate property data"
                      : "Helps identify the specific unit and fetch accurate property data"}
                  </p>
                </div>
              )}

              {/* HOA/Condo Fee - for condos and townhouses */}
              {(formData.property_type?.includes("Condo") || formData.property_type?.includes("Townhouse")) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hoa_fee">HOA/Condo Fee</Label>
                    <FormattedInput
                      id="hoa_fee"
                      format="currency"
                      decimals={0}
                      value={hoaFee}
                      onChange={(value) => setHoaFee(value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hoa_fee_frequency">Fee Frequency</Label>
                    <Select value={hoaFeeFrequency} onValueChange={setHoaFeeFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <FormattedInput
                  id="price"
                  format="currency"
                  value={formData.price}
                  onChange={(value) => setFormData({ ...formData, price: value })}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    step="0.5"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="square_feet">Square Feet</Label>
                  <FormattedInput
                    id="square_feet"
                    format="number"
                    value={formData.square_feet}
                    onChange={(value) => setFormData({ ...formData, square_feet: value })}
                  />
                </div>
              </div>


              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Describe the property..."
                />
              </div>

              {/* Unit Features */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Unit Features</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="floors">Number of Floors</Label>
                    <Input
                      id="floors"
                      value={floors}
                      onChange={(e) => setFloors(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="num_fireplaces">Fireplaces</Label>
                    <Input
                      id="num_fireplaces"
                      type="number"
                      value={formData.num_fireplaces}
                      onChange={(e) => setFormData({ ...formData, num_fireplaces: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Property Tax */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Property Tax</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="annual_property_tax">Annual Property Tax</Label>
                    <FormattedInput
                      id="annual_property_tax"
                      format="currency"
                      value={formData.annual_property_tax}
                      onChange={(value) => setFormData({ ...formData, annual_property_tax: value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_assessment_value">Assessed Value</Label>
                    <FormattedInput
                      id="tax_assessment_value"
                      format="currency"
                      value={formData.tax_assessment_value}
                      onChange={(value) => setFormData({ ...formData, tax_assessment_value: value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_year">Fiscal Year</Label>
                    <Input
                      id="tax_year"
                      type="number"
                      value={formData.tax_year}
                      onChange={(e) => setFormData({ ...formData, tax_year: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residentialExemption">Residential Exemption</Label>
                  <Select value={residentialExemption} onValueChange={setResidentialExemption}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {!(formData.property_type?.toLowerCase().includes("condo")) && (
                    <div className="space-y-2">
                      <Label htmlFor="lot_size">Lot Size (acres)</Label>
                      <Input
                        id="lot_size"
                        type="number"
                        step="0.01"
                        value={formData.lot_size}
                        onChange={(e) => setFormData({ ...formData, lot_size: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="year_built">Year Built</Label>
                    <Input
                      id="year_built"
                      type="number"
                      value={formData.year_built}
                      onChange={(e) => setFormData({ ...formData, year_built: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Basement Details */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Basement Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="basementType">Basement Type</Label>
                  <Select value={basementType} onValueChange={setBasementType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select basement type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full">Full</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="Crawl Space">Crawl Space</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Basement Features</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Finished', 'Unfinished', 'Partially Finished', 'Walk-Out', 'Interior Access', 'Exterior Access'].map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`basement-${feature}`}
                          checked={basementFeatures.includes(feature)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBasementFeatures([...basementFeatures, feature]);
                            } else {
                              setBasementFeatures(basementFeatures.filter(f => f !== feature));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`basement-${feature}`} className="font-normal cursor-pointer text-sm">
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Basement Floor Type</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Concrete', 'Tile', 'Carpet', 'Wood', 'Other'].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`floor-${type}`}
                          checked={basementFloorType.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBasementFloorType([...basementFloorType, type]);
                            } else {
                              setBasementFloorType(basementFloorType.filter(t => t !== type));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`floor-${type}`} className="font-normal cursor-pointer text-sm">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Foundation & Building Details */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Foundation & Building Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leadPaint">Lead Paint</Label>
                    <Select value={leadPaint} onValueChange={setLeadPaint}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="handicapAccess">Handicap Access</Label>
                    <Select value={handicapAccess} onValueChange={setHandicapAccess}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Foundation</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Poured Concrete', 'Block', 'Stone', 'Brick', 'Wood', 'Other'].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`foundation-${type}`}
                          checked={foundation.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFoundation([...foundation, type]);
                            } else {
                              setFoundation(foundation.filter(f => f !== type));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`foundation-${type}`} className="font-normal cursor-pointer text-sm">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Parking & Garage */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Parking & Garage</h3>
                <div className="space-y-2">
                  <Label htmlFor="parkingSpaces">Parking #</Label>
                  <Input
                    id="parkingSpaces"
                    type="number"
                    value={parkingSpaces}
                    onChange={(e) => setParkingSpaces(e.target.value)}
                    placeholder="Number of parking spaces"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parking Features</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Driveway', 'Off-Street', 'On Street Permit', 'Assigned', 'Covered', 'Uncovered', 'Garage Attached', 'Garage Detached'].map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`parking-${feature}`}
                          checked={parkingFeatures.includes(feature)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setParkingFeatures([...parkingFeatures, feature]);
                            } else {
                              setParkingFeatures(parkingFeatures.filter(f => f !== feature));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`parking-${feature}`} className="font-normal cursor-pointer text-sm">
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parkingComments">Parking Comments</Label>
                  <Input
                    id="parkingComments"
                    value={parkingComments}
                    onChange={(e) => setParkingComments(e.target.value)}
                    placeholder="Additional parking information..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garageSpaces">Garage #</Label>
                  <Input
                    id="garageSpaces"
                    type="number"
                    value={garageSpaces}
                    onChange={(e) => setGarageSpaces(e.target.value)}
                    placeholder="Number of garage spaces"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Garage Features</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Heated', 'Electric Door Opener', 'Workshop', 'Finished Interior', 'Storage', 'Insulated'].map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`garage-${feature}`}
                          checked={garageFeatures.includes(feature)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGarageFeatures([...garageFeatures, feature]);
                            } else {
                              setGarageFeatures(garageFeatures.filter(f => f !== feature));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`garage-${feature}`} className="font-normal cursor-pointer text-sm">
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garageComments">Garage Comments</Label>
                  <Input
                    id="garageComments"
                    value={garageComments}
                    onChange={(e) => setGarageComments(e.target.value)}
                    placeholder="Additional garage information..."
                  />
                </div>
              </div>

              {/* Lot Information */}
              {!(formData.property_type?.toLowerCase().includes("condo")) && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Lot Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="lotSizeSource">Lot Size Source</Label>
                    <Input
                      id="lotSizeSource"
                      value={lotSizeSource}
                      onChange={(e) => setLotSizeSource(e.target.value)}
                      placeholder="e.g., Assessor, Survey, Public Records"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lot Description</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {['Corner Lot', 'Cul-de-sac', 'Level', 'Sloped', 'Wooded', 'Cleared', 'Fenced', 'Landscaped'].map((desc) => (
                        <div key={desc} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`lot-${desc}`}
                            checked={lotDescription.includes(desc)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLotDescription([...lotDescription, desc]);
                              } else {
                                setLotDescription(lotDescription.filter(d => d !== desc));
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`lot-${desc}`} className="font-normal cursor-pointer text-sm">
                            {desc}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Disclosures & Legal */}
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Seller Disclosure</Label>
                  <RadioGroup value={sellerDisclosure} onValueChange={setSellerDisclosure}>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="disclosure-yes" />
                        <Label htmlFor="disclosure-yes" className="font-normal cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="disclosure-no" />
                        <Label htmlFor="disclosure-no" className="font-normal cursor-pointer">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disclosuresText">Additional Disclosures</Label>
                  <Textarea
                    id="disclosuresText"
                    value={disclosuresText}
                    onChange={(e) => setDisclosuresText(e.target.value)}
                    rows={3}
                    placeholder="Any additional disclosures about the property..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exclusions">Exclusions</Label>
                  <Textarea
                    id="exclusions"
                    value={exclusions}
                    onChange={(e) => setExclusions(e.target.value)}
                    rows={3}
                    placeholder="Items not included in the sale..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brokerComments">Broker Comments</Label>
                  <Textarea
                    id="brokerComments"
                    value={brokerComments}
                    onChange={(e) => setBrokerComments(e.target.value)}
                    rows={3}
                    placeholder="Comments for other agents..."
                  />
                </div>
              </div>

              {/* Commission Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Commission Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commission_type">Commission Type</Label>
                    <Select
                      value={formData.commission_type}
                      onValueChange={(value) => setFormData({ ...formData, commission_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="flat_fee">Flat Fee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commission_rate">
                      {formData.commission_type === 'percentage' ? 'Rate' : 'Amount'}
                    </Label>
                    {formData.commission_type === 'percentage' ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id="commission_rate"
                          type="number"
                          step="0.01"
                          value={formData.commission_rate}
                          onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                          placeholder="2.5"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="commission_rate"
                          type="number"
                          step="0.01"
                          value={formData.commission_rate}
                          onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                          placeholder="5000"
                          className="pl-6"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_notes">Commission Notes</Label>
                  <Input
                    id="commission_notes"
                    value={formData.commission_notes}
                    onChange={(e) => setFormData({ ...formData, commission_notes: e.target.value })}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Showing Instructions */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Showing Instructions</h3>
                <div className="space-y-2">
                  <Label htmlFor="showing_instructions">Instructions</Label>
                  <Textarea
                    id="showing_instructions"
                    value={formData.showing_instructions}
                    onChange={(e) => setFormData({ ...formData, showing_instructions: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lockbox_code">Lockbox Code</Label>
                    <Input
                      id="lockbox_code"
                      type="password"
                      value={formData.lockbox_code}
                      onChange={(e) => setFormData({ ...formData, lockbox_code: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
                    <input
                      type="checkbox"
                      id="appointment_required"
                      checked={formData.appointment_required}
                      onChange={(e) => setFormData({ ...formData, appointment_required: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="appointment_required" className="font-normal cursor-pointer">
                      Appointment required
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="showing_contact_name">Contact Name</Label>
                    <Input
                      id="showing_contact_name"
                      value={formData.showing_contact_name}
                      onChange={(e) => setFormData({ ...formData, showing_contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="showing_contact_phone">Contact Phone</Label>
                    <Input
                      id="showing_contact_phone"
                      type="tel"
                      value={formData.showing_contact_phone}
                      onChange={(e) => setFormData({ ...formData, showing_contact_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Updating..." : "Update Listing"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/agent-dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditListing;
