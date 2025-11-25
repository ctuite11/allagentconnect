import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const NewListing: React.FC = () => {
  const { user } = useAuthRole();
  const navigate = useNavigate();
  const [listingType, setListingType] = useState<"for_sale" | "for_rent">("for_sale");
  const [propertyType, setPropertyType] = useState<"single_family" | "condo" | "multi_family">("single_family");
  const [status, setStatus] = useState<"New" | "Coming Soon">("New");
  const [goLiveDate, setGoLiveDate] = useState<string>("");
  const [autoActivateDays, setAutoActivateDays] = useState<number | "">("");
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
  
  // Auto-fill from public records
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [attomId, setAttomId] = useState<string | null>(null);
  const [bedrooms, setBedrooms] = useState<number | "">("");
  const [bathrooms, setBathrooms] = useState<number | "">("");
  const [squareFeet, setSquareFeet] = useState<number | "">("");
  const [lotSize, setLotSize] = useState<number | "">("");
  const [yearBuilt, setYearBuilt] = useState<number | "">("");
  const [taxAmount, setTaxAmount] = useState<number | "">("");
  const [taxYear, setTaxYear] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">You must be signed in as an agent to create a listing.</p>
        </div>
      </div>
    );
  }

  const handleAutoFillFromPublicRecords = async () => {
    if (!address || !city || !state) {
      toast.error("Please enter address, city, and state first.");
      return;
    }

    setAutoFillLoading(true);

    const { data, error } = await supabase.functions.invoke("fetch-property-data", {
      body: {
        address,
        city,
        state,
        zip: zipCode,
      },
    });

    setAutoFillLoading(false);

    if (error || !data || data.error) {
      toast.error("Could not fetch public record data.");
      console.error(error || data);
      return;
    }

    toast.success("Property data loaded from public records!");
    
    setAttomId(data.attomId ?? null);
    if (data.beds) setBedrooms(data.beds);
    if (data.baths) setBathrooms(data.baths);
    if (data.sqft) setSquareFeet(data.sqft);
    if (data.lotSizeSqft) setLotSize(data.lotSizeSqft);
    if (data.yearBuilt) setYearBuilt(data.yearBuilt);
    if (data.taxAmount) setTaxAmount(data.taxAmount);
    if (data.taxYear) setTaxYear(data.taxYear.toString());
    if (data.latitude) setLatitude(data.latitude);
    if (data.longitude) setLongitude(data.longitude);
  };

  const handleStatusChange = (value: string) => {
    const newStatus = value as "New" | "Coming Soon";
    setStatus(newStatus);

    if (newStatus === "Coming Soon") {
      setAutoActivateDays("");
    } else if (newStatus === "New") {
      setGoLiveDate("");
    }
  };

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

    // Validate Coming Soon go-live date
    if (status === "Coming Soon" && !goLiveDate) {
      toast.error("Please select a Go-Live date for Coming Soon listings.");
      return;
    }

    setSaving(true);

    // Compute auto_activate_on
    let computedAutoActivateOn: string | null = null;
    if (status === "Coming Soon" && goLiveDate) {
      computedAutoActivateOn = new Date(goLiveDate + "T09:00:00").toISOString();
    }
    if (status === "New" && typeof autoActivateDays === "number") {
      const base = new Date();
      base.setDate(base.getDate() + autoActivateDays);
      computedAutoActivateOn = base.toISOString();
    }

    const listingData: any = {
      agent_id: user.id,
      address,
      city,
      state,
      zip_code: zipCode,
      listing_type: listingType,
      property_type: propertyType,
      status: status.toLowerCase().replace(" ", "_"),
      attom_id: attomId,
      bedrooms: bedrooms || null,
      bathrooms: bathrooms || null,
      square_feet: squareFeet || null,
      lot_size: lotSize || null,
      year_built: yearBuilt || null,
      annual_property_tax: taxAmount || null,
      tax_year: taxYear ? parseInt(taxYear) : null,
      latitude,
      longitude,
      go_live_date: goLiveDate || null,
      auto_activate_days: status === "New" && typeof autoActivateDays === "number" ? autoActivateDays : null,
      auto_activate_on: computedAutoActivateOn,
    };

    // Add type-specific fields
    if (listingType === "for_sale") {
      listingData.price = typeof price === "string" ? parseFloat(price) : price;
    } else {
      listingData.listing_type = "for_rent";
      listingData.price = typeof monthlyRent === "string" ? parseFloat(monthlyRent) : monthlyRent;
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

    const { error } = await supabase.from("listings").insert(listingData);

    setSaving(false);

    if (error) {
      console.error("Error creating listing", error);
      toast.error(error.message);
      return;
    }

    toast.success("Listing created successfully!");
    navigate("/agent/listings");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Create New Listing</CardTitle>
              <CardDescription>
                Fill in the basic information to create a draft listing. You can add more details later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="status">Status *</Label>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="New">New</option>
                      <option value="Coming Soon">Coming Soon</option>
                    </select>
                  </div>

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

                {status === "Coming Soon" && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <Label htmlFor="goLiveDate">Go-Live / Active On Date *</Label>
                    <Input
                      id="goLiveDate"
                      type="date"
                      value={goLiveDate}
                      onChange={(e) => setGoLiveDate(e.target.value)}
                      className="mt-1"
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Date this Coming Soon listing should automatically become Active.
                    </p>
                  </div>
                )}

                {status === "New" && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <Label htmlFor="autoActivateDays">Auto-activate after (days)</Label>
                    <Input
                      id="autoActivateDays"
                      type="number"
                      min={1}
                      value={autoActivateDays}
                      onChange={(e) => setAutoActivateDays(e.target.value === "" ? "" : Number(e.target.value))}
                      className="mt-1"
                      placeholder="e.g. 3"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. If set, this listing will automatically move from New to Active after this many days.
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="address">Street Address *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 123 Main Street"
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleAutoFillFromPublicRecords}
                      disabled={autoFillLoading}
                      variant="secondary"
                    >
                      {autoFillLoading ? "Fetching..." : "Auto-fill from Public Records"}
                    </Button>
                  </div>
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

                <div className="grid grid-cols-3 gap-4 border-t pt-4">
                  <div>
                    <Label htmlFor="bedrooms">Bedrooms</Label>
                    <Input
                      id="bedrooms"
                      type="number"
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bathrooms">Bathrooms</Label>
                    <Input
                      id="bathrooms"
                      type="number"
                      step="0.5"
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 2.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="squareFeet">Square Feet</Label>
                    <Input
                      id="squareFeet"
                      type="number"
                      value={squareFeet}
                      onChange={(e) => setSquareFeet(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 2000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lotSize">Lot Size (sq ft)</Label>
                    <Input
                      id="lotSize"
                      type="number"
                      value={lotSize}
                      onChange={(e) => setLotSize(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 5000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="yearBuilt">Year Built</Label>
                    <Input
                      id="yearBuilt"
                      type="number"
                      value={yearBuilt}
                      onChange={(e) => setYearBuilt(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 1990"
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
                    {saving ? "Saving..." : "Save Listing"}
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

export default NewListing;
