import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Home, Upload, Check, Users, Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Logo } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { US_STATES } from "@/data/usStatesCountiesData";
import AgentMatchAuthDialog from "@/components/agent-match/AgentMatchAuthDialog";
import AgentMatchResultsPanel from "@/components/agent-match/AgentMatchResultsPanel";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const PROPERTY_TYPES = [
  { value: "Single Family", label: "Single Family" },
  { value: "Condominium", label: "Condo" },
  { value: "Townhouse", label: "Townhouse" },
  { value: "Multi Family", label: "Multi-Family" },
  { value: "Land", label: "Land" },
];

type Step = "property" | "photos" | "confirm" | "results";

interface PropertyData {
  address: string;
  unit_number: string;
  city: string;
  state: string;
  zip_code: string;
  neighborhood: string;
  property_type: string;
  bedrooms: string;
  bathrooms: string;
  square_feet: string;
  asking_price: string;
  lot_size: string;
  year_built: string;
  description: string;
  video_url: string;
  property_website_url: string;
  buyer_agent_commission: string;
}

const AgentMatch = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("property");
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [propertyData, setPropertyData] = useState<PropertyData>({
    address: "",
    unit_number: "",
    city: "",
    state: "MA",
    zip_code: "",
    neighborhood: "",
    property_type: "Single Family",
    bedrooms: "",
    bathrooms: "",
    square_feet: "",
    asking_price: "",
    lot_size: "",
    year_built: "",
    description: "",
    video_url: "",
    property_website_url: "",
    buyer_agent_commission: "2.5%",
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [confirmations, setConfirmations] = useState({
    notUnderContract: false,
    ownerOrAuthorized: false,
  });
  const [autoFillLoading, setAutoFillLoading] = useState(false);

  // Check for existing user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateProperty = (field: keyof PropertyData, value: string) => {
    setPropertyData(prev => ({ ...prev, [field]: value }));
  };

  const handlePlaceSelect = (place: any) => {
    if (!place.address_components) return;
    
    const components = place.address_components;
    
    // Extract street number + route for address
    const streetNumber = components.find((c: any) => 
      c.types.includes('street_number'))?.long_name || '';
    const route = components.find((c: any) => 
      c.types.includes('route'))?.long_name || '';
    const address = `${streetNumber} ${route}`.trim();
    
    // Extract city (locality or sublocality)
    const city = components.find((c: any) => 
      c.types.includes('locality') || c.types.includes('sublocality'))?.long_name || '';
    
    // Extract state (short_name for abbreviation)
    const state = components.find((c: any) => 
      c.types.includes('administrative_area_level_1'))?.short_name || '';
    
    // Extract ZIP code
    const zipCode = components.find((c: any) => 
      c.types.includes('postal_code'))?.long_name || '';
    
    // Extract neighborhood if available
    const neighborhood = components.find((c: any) => 
      c.types.includes('neighborhood') || c.types.includes('sublocality_level_1'))?.long_name || '';
    
    // Update form state
    setPropertyData(prev => ({
      ...prev,
      address: address || place.formatted_address?.split(',')[0] || '',
      city,
      state: state || prev.state,
      zip_code: zipCode,
      neighborhood: neighborhood || prev.neighborhood,
    }));
    
    // Trigger ATTOM data fetch
    if (address && city && state) {
      fetchPropertyData(address, city, state, zipCode);
    }
  };

  const fetchPropertyData = async (address: string, city: string, state: string, zip: string) => {
    setAutoFillLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-property-data', {
        body: { address, city, state, zip }
      });
      
      if (error) throw error;
      
      if (data?.results?.length > 0) {
        const record = data.results[0];
        
        // Auto-fill property details from ATTOM
        setPropertyData(prev => ({
          ...prev,
          bedrooms: record.beds?.toString() || prev.bedrooms,
          bathrooms: record.baths?.toString() || prev.bathrooms,
          square_feet: record.sqft?.toString() || prev.square_feet,
          lot_size: record.lotSizeSqft ? (record.lotSizeSqft / 43560).toFixed(2) : prev.lot_size,
          year_built: record.yearBuilt?.toString() || prev.year_built,
        }));
        
        toast.success("Property details auto-filled from public records");
      }
    } catch (err) {
      console.error("ATTOM fetch error:", err);
      // Silent fail - seller can still enter manually
    } finally {
      setAutoFillLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
    
    // Create preview URLs
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      setPhotoUrls(prev => [...prev, url]);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const validatePropertyStep = (): boolean => {
    const required = ["address", "city", "state", "property_type", "bedrooms", "bathrooms", "square_feet", "asking_price"];
    for (const field of required) {
      if (!propertyData[field as keyof PropertyData]) {
        toast.error(`Please fill in ${field.replace(/_/g, " ")}`);
        return false;
      }
    }
    return true;
  };

  const validatePhotosStep = (): boolean => {
    if (photos.length < 2) {
      toast.error("Please upload at least 2 photos (exterior + interior)");
      return false;
    }
    return true;
  };

  const validateConfirmStep = (): boolean => {
    if (!confirmations.notUnderContract || !confirmations.ownerOrAuthorized) {
      toast.error("Please confirm both statements");
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    if (step === "property" && !validatePropertyStep()) return;
    if (step === "photos" && !validatePhotosStep()) return;
    if (step === "confirm" && !validateConfirmStep()) {
      return;
    }

    if (step === "property") setStep("photos");
    else if (step === "photos") setStep("confirm");
    else if (step === "confirm") {
      // Calculate match count immediately (no auth required)
      setIsLoading(true);
      try {
        const { data: matchData, error: matchError } = await supabase.rpc("count_matching_agents", {
          p_city: propertyData.city,
          p_state: propertyData.state,
          p_property_type: propertyData.property_type,
          p_price: parseFloat(propertyData.asking_price) || 0,
          p_bedrooms: parseInt(propertyData.bedrooms) || 0,
          p_bathrooms: parseFloat(propertyData.bathrooms) || 0,
        });

        if (matchError) throw matchError;
        setMatchCount(matchData || 0);
        setStep("results");
      } catch (error: any) {
        console.error("Error calculating matches:", error);
        toast.error(error.message || "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAuthComplete = async (email: string) => {
    setIsLoading(true);
    setShowAuthDialog(false);
    
    try {
      // Upload photos to storage
      const uploadedUrls: string[] = [];
      const session = await supabase.auth.getSession();
      
      if (session.data.session) {
        for (const photo of photos) {
          const fileName = `${Date.now()}-${photo.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("agent-match-photos")
            .upload(`${session.data.session.user.id}/${fileName}`, photo);

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage
              .from("agent-match-photos")
              .getPublicUrl(uploadData.path);
            uploadedUrls.push(urlData.publicUrl);
          }
        }
      }

      // Create submission record with paid status
      const { data: submission, error: submitError } = await supabase
        .from("agent_match_submissions")
        .insert({
          user_id: session.data.session?.user?.id || null,
          seller_email: email,
          address: propertyData.address,
          unit_number: propertyData.unit_number || null,
          city: propertyData.city,
          state: propertyData.state,
          zip_code: propertyData.zip_code || null,
          neighborhood: propertyData.neighborhood || null,
          property_type: propertyData.property_type,
          bedrooms: parseInt(propertyData.bedrooms),
          bathrooms: parseFloat(propertyData.bathrooms),
          square_feet: parseInt(propertyData.square_feet),
          asking_price: parseFloat(propertyData.asking_price),
          lot_size: propertyData.lot_size ? parseFloat(propertyData.lot_size) : null,
          year_built: propertyData.year_built ? parseInt(propertyData.year_built) : null,
          description: propertyData.description || null,
          photos: uploadedUrls,
          video_url: propertyData.video_url || null,
          property_website_url: propertyData.property_website_url || null,
          buyer_agent_commission: propertyData.buyer_agent_commission || null,
          confirmed_not_under_contract: confirmations.notUnderContract,
          confirmed_owner_or_authorized: confirmations.ownerOrAuthorized,
          match_count: matchCount || 0,
          matched_at: new Date().toISOString(),
          status: "paid",
        })
        .select()
        .single();

      if (submitError) throw submitError;
      setSubmissionId(submission.id);
      toast.success("Your property has been submitted to matched agents!");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerAuth = () => {
    setShowAuthDialog(true);
  };

  const stepNumber = step === "property" ? 1 : step === "photos" ? 2 : step === "confirm" ? 3 : 4;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-zinc-100">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-3 -ml-1">
              <Logo size="lg" />
            </button>
            <span className="text-sm font-medium text-zinc-500">Agent Match</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-8 md:py-12">
        {step !== "results" && (
          <>
            {/* Progress */}
            <div className="flex items-center gap-2 mb-8">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    n <= stepNumber ? "bg-[#0E56F5]" : "bg-zinc-200"
                  }`}
                />
              ))}
            </div>

            {/* Back button */}
            {step !== "property" && (
              <button
                onClick={() => {
                  if (step === "photos") setStep("property");
                  else if (step === "confirm") setStep("photos");
                }}
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-6"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
          </>
        )}

        {/* Step 1: Property Details */}
        {step === "property" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 mb-2">Tell us about your property</h1>
              <p className="text-zinc-500">We'll match you with AAC Verified agents who have qualified buyers.</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="property_type">Property Type *</Label>
                <Select value={propertyData.property_type} onValueChange={(v) => updateProperty("property_type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="address">Street Address *</Label>
                <AddressAutocomplete
                  value={propertyData.address}
                  onChange={(value) => updateProperty("address", value)}
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Start typing an address..."
                  types={['address']}
                  className="w-full"
                />
                {autoFillLoading && (
                  <p className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Fetching property details...
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unit">Unit/Apt (optional)</Label>
                  <Input
                    id="unit"
                    value={propertyData.unit_number}
                    onChange={(e) => updateProperty("unit_number", e.target.value)}
                    placeholder="Unit 2B"
                  />
                </div>
                <div>
                  <Label htmlFor="neighborhood">Neighborhood (optional)</Label>
                  <Input
                    id="neighborhood"
                    value={propertyData.neighborhood}
                    onChange={(e) => updateProperty("neighborhood", e.target.value)}
                    placeholder="Back Bay"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={propertyData.city}
                    onChange={(e) => updateProperty("city", e.target.value)}
                    placeholder="Boston"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Select value={propertyData.state} onValueChange={(v) => updateProperty("state", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={propertyData.zip_code}
                    onChange={(e) => updateProperty("zip_code", e.target.value)}
                    placeholder="02101"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="beds">Bedrooms *</Label>
                  <Input
                    id="beds"
                    type="number"
                    min="0"
                    value={propertyData.bedrooms}
                    onChange={(e) => updateProperty("bedrooms", e.target.value)}
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label htmlFor="baths">Bathrooms *</Label>
                  <Input
                    id="baths"
                    type="number"
                    min="0"
                    step="0.5"
                    value={propertyData.bathrooms}
                    onChange={(e) => updateProperty("bathrooms", e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label htmlFor="sqft">Square Feet *</Label>
                  <FormattedInput
                    id="sqft"
                    format="number"
                    value={propertyData.square_feet}
                    onChange={(v) => updateProperty("square_feet", v)}
                    placeholder="1,800"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="price">Asking Price *</Label>
                <FormattedInput
                  id="price"
                  format="currency"
                  value={propertyData.asking_price}
                  onChange={(v) => updateProperty("asking_price", v)}
                  placeholder="$650,000"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lot">Lot Size (acres, optional)</Label>
                  <Input
                    id="lot"
                    type="number"
                    step="0.01"
                    value={propertyData.lot_size}
                    onChange={(e) => updateProperty("lot_size", e.target.value)}
                    placeholder="0.25"
                  />
                </div>
                <div>
                  <Label htmlFor="year">Year Built (optional)</Label>
                  <Input
                    id="year"
                    type="number"
                    value={propertyData.year_built}
                    onChange={(e) => updateProperty("year_built", e.target.value)}
                    placeholder="1985"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="desc">Property Description (optional)</Label>
                <Textarea
                  id="desc"
                  value={propertyData.description}
                  onChange={(e) => updateProperty("description", e.target.value)}
                  placeholder="Describe your property's best features..."
                  rows={3}
                />
              </div>

              <div className="pt-4 border-t">
                <Label htmlFor="commission">Buyer Agent Commission</Label>
                <Input
                  id="commission"
                  value={propertyData.buyer_agent_commission}
                  onChange={(e) => updateProperty("buyer_agent_commission", e.target.value)}
                  placeholder="2.5% or $10,000"
                />
                <p className="mt-1 text-xs text-zinc-500">Enter a percentage or fixed amount you'll offer to buyer agents.</p>
              </div>
            </div>

            <Button
              onClick={handleNextStep}
              className="w-full bg-[#0E56F5] hover:bg-[#0D4AD9] text-white"
            >
              Continue to Photos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Photos */}
        {step === "photos" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 mb-2">Add property photos</h1>
              <p className="text-zinc-500">Upload at least 2 photos: one exterior and one interior.</p>
            </div>

            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center hover:border-zinc-300 transition-colors cursor-pointer"
                onClick={() => document.getElementById("photo-input")?.click()}
              >
                <Upload className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-700">Click to upload photos</p>
                <p className="text-xs text-zinc-500 mt-1">PNG, JPG up to 10MB each</p>
                <input
                  id="photo-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>

              {photoUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {photoUrls.map((url, index) => (
                    <div key={index} className="relative group aspect-square rounded-lg overflow-hidden bg-zinc-100">
                      <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="sr-only">Remove</span>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-zinc-500">
                {photos.length} photo{photos.length !== 1 ? "s" : ""} uploaded
                {photos.length < 2 && " — need at least 2"}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label htmlFor="video">Video URL (optional)</Label>
                <Input
                  id="video"
                  value={propertyData.video_url}
                  onChange={(e) => updateProperty("video_url", e.target.value)}
                  placeholder="https://youtube.com/..."
                />
              </div>
              <div>
                <Label htmlFor="website">Property Website (optional)</Label>
                <Input
                  id="website"
                  value={propertyData.property_website_url}
                  onChange={(e) => updateProperty("property_website_url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            <Button
              onClick={handleNextStep}
              className="w-full bg-[#0E56F5] hover:bg-[#0D4AD9] text-white"
            >
              Continue to Confirmation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 3: Confirmations */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 mb-2">Confirm eligibility</h1>
              <p className="text-zinc-500">Please confirm the following before we find your matches.</p>
            </div>

            <div className="space-y-4 p-6 bg-zinc-50 rounded-xl">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="not-under-contract"
                  checked={confirmations.notUnderContract}
                  onCheckedChange={(checked) =>
                    setConfirmations((prev) => ({ ...prev, notUnderContract: !!checked }))
                  }
                />
                <Label htmlFor="not-under-contract" className="text-sm leading-relaxed cursor-pointer">
                  I confirm that this property is <strong>not currently under contract</strong> with a listing brokerage.
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="owner-auth"
                  checked={confirmations.ownerOrAuthorized}
                  onCheckedChange={(checked) =>
                    setConfirmations((prev) => ({ ...prev, ownerOrAuthorized: !!checked }))
                  }
                />
                <Label htmlFor="owner-auth" className="text-sm leading-relaxed cursor-pointer">
                  I am the <strong>property owner</strong> or am <strong>authorized to represent the owner</strong>.
                </Label>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex gap-3">
                <Lock className="h-5 w-5 text-[#0E56F5] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-zinc-900">Your information is private</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Your property details are never publicly listed. They're only shared with matched agents after you approve.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleNextStep}
              className="w-full bg-[#0E56F5] hover:bg-[#0D4AD9] text-white"
              disabled={!confirmations.notUnderContract || !confirmations.ownerOrAuthorized || isLoading}
            >
              {isLoading ? "Finding Matches..." : "Find My Matches"}
              {!isLoading && <Sparkles className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* Step 4: Results */}
        {step === "results" && (
          <AgentMatchResultsPanel
            matchCount={matchCount || 0}
            submissionId={submissionId}
            propertyData={propertyData}
            isAuthenticated={!!user}
            isProcessing={isLoading}
            onTriggerAuth={handleTriggerAuth}
          />
        )}
      </main>

      {/* Auth Dialog */}
      <AgentMatchAuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onComplete={handleAuthComplete}
        isLoading={isLoading}
      />
    </div>
  );
};

export default AgentMatch;
