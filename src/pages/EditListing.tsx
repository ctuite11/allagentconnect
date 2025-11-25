import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/LoadingScreen";

const EditListing: React.FC = () => {
  const { user } = useAuthRole();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [listingType, setListingType] = useState<"for_sale" | "for_rent">("for_sale");
  const [propertyType, setPropertyType] = useState<"single_family" | "condo" | "multi_family">("single_family");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [price, setPrice] = useState<number | "">("");
  
  // Rental-specific fields
  const [monthlyRent, setMonthlyRent] = useState<number | "">("");
  const [securityDeposit, setSecurityDeposit] = useState<number | "">("");
  const [leaseTerm, setLeaseTerm] = useState("");
  const [availableDate, setAvailableDate] = useState("");
  
  // Multi-family specific fields
  const [numUnits, setNumUnits] = useState<number | "">("");
  const [grossIncome, setGrossIncome] = useState<number | "">("");
  const [operatingExpenses, setOperatingExpenses] = useState<number | "">("");

  useEffect(() => {
    if (!user || !id) return;

    const loadListing = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .eq("agent_id", user.id)
        .single();

      if (error) {
        console.error("Error loading listing", error);
        toast.error("Failed to load listing");
        navigate("/agent/listings");
        return;
      }

      if (data) {
        setListingType((data.listing_type as "for_sale" | "for_rent") || "for_sale");
        setPropertyType((data.property_type as any as "single_family" | "condo" | "multi_family") || "single_family");
        setAddress(data.address || "");
        setCity(data.city || "");
        setState(data.state || "");
        setZipCode(data.zip_code || "");
        setPrice(data.price || "");
        
        // Load rental fields (safely access potentially non-existent properties)
        const listing: any = data;
        setMonthlyRent(listing.monthly_rent || "");
        setSecurityDeposit(listing.security_deposit || "");
        setLeaseTerm(listing.lease_term || "");
        setAvailableDate(listing.available_date || "");
        
        // Load multi-family fields
        setNumUnits(listing.num_units || "");
        setGrossIncome(listing.gross_income || "");
        setOperatingExpenses(listing.operating_expenses || "");
      }

      setLoading(false);
    };

    loadListing();
  }, [user, id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredFields = listingType === "for_sale" 
      ? { address, city, state, zipCode, price }
      : { address, city, state, zipCode, monthlyRent };
    
    const missingFields = Object.entries(requiredFields).filter(([_, value]) => !value);
    if (missingFields.length > 0) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSaving(true);

    const listingData: any = {
      address,
      city,
      state,
      zip_code: zipCode,
      listing_type: listingType,
      property_type: propertyType,
    };

    // Add type-specific fields
    if (listingType === "for_sale") {
      listingData.price = typeof price === "string" ? parseFloat(price) : price;
    } else {
      listingData.listing_type = "for_rent";
      listingData.price = typeof monthlyRent === "string" ? parseFloat(monthlyRent) : monthlyRent;
      listingData.monthly_rent = listingData.price;
      if (securityDeposit) listingData.security_deposit = typeof securityDeposit === "string" ? parseFloat(securityDeposit) : securityDeposit;
      if (leaseTerm) listingData.lease_term = leaseTerm;
      if (availableDate) listingData.available_date = availableDate;
    }

    // Add multi-family fields if applicable
    if (propertyType === "multi_family") {
      if (numUnits) listingData.num_units = typeof numUnits === "string" ? parseFloat(numUnits) : numUnits;
      if (grossIncome) listingData.gross_income = typeof grossIncome === "string" ? parseFloat(grossIncome) : grossIncome;
      if (operatingExpenses) listingData.operating_expenses = typeof operatingExpenses === "string" ? parseFloat(operatingExpenses) : operatingExpenses;
    }

    const { error } = await supabase
      .from("listings")
      .update(listingData)
      .eq("id", id);

    setSaving(false);

    if (error) {
      console.error("Error updating listing", error);
      toast.error(error.message);
      return;
    }

    toast.success("Listing updated successfully!");
    navigate("/agent/listings");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">You must be signed in as an agent to edit listings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading listing..." />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Edit Listing</CardTitle>
              <CardDescription>
                Update the listing details below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="listingType">Listing Category *</Label>
                    <select
                      id="listingType"
                      value={listingType}
                      onChange={(e) => setListingType(e.target.value as "for_sale" | "for_rent")}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="for_sale">For Sale</option>
                      <option value="for_rent">For Rent</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="propertyType">Property Style *</Label>
                    <select
                      id="propertyType"
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value as "single_family" | "condo" | "multi_family")}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="single_family">Single Family</option>
                      <option value="condo">Condo</option>
                      <option value="multi_family">Multi-Family</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 123 Main Street"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Boston"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. MA"
                      maxLength={2}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zipCode">ZIP Code *</Label>
                    <Input
                      id="zipCode"
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="e.g. 02101"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="price">{listingType === "for_sale" ? "Price" : "Monthly Rent"} *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={listingType === "for_sale" ? price : monthlyRent}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        if (listingType === "for_sale") {
                          setPrice(val);
                        } else {
                          setMonthlyRent(val);
                        }
                      }}
                      placeholder={listingType === "for_sale" ? "e.g. 995000" : "e.g. 2500"}
                      required
                    />
                  </div>
                </div>

                {listingType === "for_rent" && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">Rental Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="securityDeposit">Security Deposit</Label>
                        <Input
                          id="securityDeposit"
                          type="number"
                          value={securityDeposit}
                          onChange={(e) => setSecurityDeposit(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 2500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="leaseTerm">Lease Term</Label>
                        <Input
                          id="leaseTerm"
                          type="text"
                          value={leaseTerm}
                          onChange={(e) => setLeaseTerm(e.target.value)}
                          placeholder="e.g. 12 months"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="availableDate">Available Date</Label>
                      <Input
                        id="availableDate"
                        type="date"
                        value={availableDate}
                        onChange={(e) => setAvailableDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {propertyType === "multi_family" && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">Multi-Family Details</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="numUnits">Number of Units</Label>
                        <Input
                          id="numUnits"
                          type="number"
                          value={numUnits}
                          onChange={(e) => setNumUnits(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 3"
                        />
                      </div>
                      <div>
                        <Label htmlFor="grossIncome">Gross Annual Income</Label>
                        <Input
                          id="grossIncome"
                          type="number"
                          value={grossIncome}
                          onChange={(e) => setGrossIncome(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 60000"
                        />
                      </div>
                      <div>
                        <Label htmlFor="operatingExpenses">Operating Expenses</Label>
                        <Input
                          id="operatingExpenses"
                          type="number"
                          value={operatingExpenses}
                          onChange={(e) => setOperatingExpenses(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 15000"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/agent/listings")}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditListing;
