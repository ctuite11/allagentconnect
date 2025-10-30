import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import { z } from "zod";
import { Loader2 } from "lucide-react";

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
  });

  const [disclosures, setDisclosures] = useState<string[]>([]);
  const [propertyFeatures, setPropertyFeatures] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);

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
        });
        setDisclosures(Array.isArray(data.disclosures) ? data.disclosures as string[] : []);
        setPropertyFeatures(Array.isArray(data.property_features) ? data.property_features as string[] : []);
        setAmenities(Array.isArray(data.amenities) ? data.amenities as string[] : []);
      }
    } catch (error: any) {
      toast.error("Error loading listing: " + error.message);
      navigate("/agent-dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const dataToUpdate = {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        property_type: formData.property_type || null,
        price: parseFloat(formData.price),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
        description: formData.description || null,
        status: formData.status,
      };

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
                    <SelectItem value="for_private_sale">For Private Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zip_code">Zip Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property_type">Property Type</Label>
                  <Input
                    id="property_type"
                    value={formData.property_type}
                    onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                    placeholder="e.g., Single Family, Condo"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
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
                  <Input
                    id="square_feet"
                    type="number"
                    value={formData.square_feet}
                    onChange={(e) => setFormData({ ...formData, square_feet: e.target.value })}
                  />
                </div>
              </div>

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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Describe the property..."
                />
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
                    <Label htmlFor="commission_rate">Rate/Amount</Label>
                    <Input
                      id="commission_rate"
                      type="number"
                      step="0.01"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_notes">Commission Notes</Label>
                  <Input
                    id="commission_notes"
                    value={formData.commission_notes}
                    onChange={(e) => setFormData({ ...formData, commission_notes: e.target.value })}
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

              {/* Disclosures */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Disclosures</h3>
                <div className="grid grid-cols-2 gap-3">
                  {['Lead-based paint', 'Asbestos', 'Radon', 'Flood zone', 'HOA restrictions', 'Previous damage/repairs'].map((disclosure) => (
                    <div key={disclosure} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={disclosure}
                        checked={disclosures.includes(disclosure)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDisclosures([...disclosures, disclosure]);
                          } else {
                            setDisclosures(disclosures.filter(d => d !== disclosure));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={disclosure} className="font-normal cursor-pointer text-sm">
                        {disclosure}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Property Features */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Property Features</h3>
                <div className="grid grid-cols-2 gap-3">
                  {['Hardwood floors', 'Granite countertops', 'Fireplace', 'Updated kitchen', 'Basement', 'Garage'].map((feature) => (
                    <div key={feature} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={feature}
                        checked={propertyFeatures.includes(feature)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPropertyFeatures([...propertyFeatures, feature]);
                          } else {
                            setPropertyFeatures(propertyFeatures.filter(f => f !== feature));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={feature} className="font-normal cursor-pointer text-sm">
                        {feature}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Amenities</h3>
                <div className="grid grid-cols-2 gap-3">
                  {['Pool', 'Gym', 'Pet friendly', 'Gated community', 'Security system', 'Parking'].map((amenity) => (
                    <div key={amenity} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={amenity}
                        checked={amenities.includes(amenity)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAmenities([...amenities, amenity]);
                          } else {
                            setAmenities(amenities.filter(a => a !== amenity));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={amenity} className="font-normal cursor-pointer text-sm">
                        {amenity}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Notes */}
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="additional_notes">Additional Notes</Label>
                <Textarea
                  id="additional_notes"
                  value={formData.additional_notes}
                  onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                  rows={3}
                />
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
                    <Label htmlFor="commission_rate">Rate/Amount</Label>
                    <Input
                      id="commission_rate"
                      type="number"
                      step="0.01"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_notes">Commission Notes</Label>
                  <Input
                    id="commission_notes"
                    value={formData.commission_notes}
                    onChange={(e) => setFormData({ ...formData, commission_notes: e.target.value })}
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

              {/* Disclosures */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Disclosures</h3>
                <div className="grid grid-cols-2 gap-3">
                  {['Lead-based paint', 'Asbestos', 'Radon', 'Flood zone', 'HOA restrictions', 'Previous damage/repairs'].map((disclosure) => (
                    <div key={disclosure} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={disclosure}
                        checked={disclosures.includes(disclosure)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDisclosures([...disclosures, disclosure]);
                          } else {
                            setDisclosures(disclosures.filter(d => d !== disclosure));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={disclosure} className="font-normal cursor-pointer text-sm">
                        {disclosure}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Property Features */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Property Features</h3>
                <div className="grid grid-cols-2 gap-3">
                  {['Hardwood floors', 'Granite countertops', 'Fireplace', 'Updated kitchen', 'Basement', 'Garage'].map((feature) => (
                    <div key={feature} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={feature}
                        checked={propertyFeatures.includes(feature)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPropertyFeatures([...propertyFeatures, feature]);
                          } else {
                            setPropertyFeatures(propertyFeatures.filter(f => f !== feature));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={feature} className="font-normal cursor-pointer text-sm">
                        {feature}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Amenities</h3>
                <div className="grid grid-cols-2 gap-3">
                  {['Pool', 'Gym', 'Pet friendly', 'Gated community', 'Security system', 'Parking'].map((amenity) => (
                    <div key={amenity} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={amenity}
                        checked={amenities.includes(amenity)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAmenities([...amenities, amenity]);
                          } else {
                            setAmenities(amenities.filter(a => a !== amenity));
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={amenity} className="font-normal cursor-pointer text-sm">
                        {amenity}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Notes */}
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="additional_notes">Additional Notes</Label>
                <Textarea
                  id="additional_notes"
                  value={formData.additional_notes}
                  onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                  rows={3}
                />
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
