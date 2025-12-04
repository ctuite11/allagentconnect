import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormattedInput } from "@/components/ui/formatted-input";
import { toast } from "sonner";
import { Loader2, Save, Eye, Upload, X, Image as ImageIcon, FileText, GripVertical, ArrowLeft, Cloud, ChevronDown, CheckCircle2, AlertCircle, Home } from "lucide-react";
import { z } from "zod";
import { bostonNeighborhoods, bostonNeighborhoodsWithAreas } from "@/data/bostonNeighborhoods";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import listingIcon from "@/assets/listing-creation-icon.png";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";
import { getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";
import { getZipCodesForCity, hasZipCodeData } from "@/data/usZipCodesByCity";
import { cn } from "@/lib/utils";

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
  uploaded?: boolean;
  url?: string;
}

// Zod validation schema for listing data
const listingSchema = z.object({
  address: z.string().trim().min(1, "Address is required").max(500, "Address must be less than 500 characters"),
  city: z.string().trim().min(1, "City is required").max(200, "City must be less than 200 characters"),
  state: z.string().trim().length(2, "State must be 2 characters"),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  price: z.number().min(100, "Price must be at least $100").max(100000, "Price must be less than $100,000"),
  property_type: z.string().optional(),
  bedrooms: z.number().int().min(0, "Bedrooms must be 0 or more").max(50, "Bedrooms must be 50 or less").optional(),
  bathrooms: z.number().min(0, "Bathrooms must be 0 or more").max(50, "Bathrooms must be 50 or less").optional(),
  square_feet: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().min(1, "Square feet must be at least 1").max(100000, "Square feet must be less than 100,000").optional()
  ),
  year_built: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
    z.number().int().min(1800, "Year built must be 1800 or later").max(new Date().getFullYear() + 1, "Year built cannot be in the future").nullable()
  ).optional(),
  lot_size: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
    z.number().min(0, "Lot size must be 0 or more").max(10000, "Lot size must be less than 10,000 acres").nullable()
  ).optional(),
  description: z.string().max(5000, "Description must be less than 5,000 characters").optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

const AddRentalListing = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [formData, setFormData] = useState({
    status: "active",
    listing_type: "for_rent",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    county: "",
    town: "",
    neighborhood: "",
    latitude: null as number | null,
    longitude: null as number | null,
    property_type: "Single Family",
    bedrooms: "",
    bathrooms: "",
    square_feet: "",
    lot_size: "",
    year_built: "",
    price: "",
    list_date: new Date().toISOString().split('T')[0],
    expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: "",
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

  const [photos, setPhotos] = useState<FileWithPreview[]>([]);
  const [floorPlans, setFloorPlans] = useState<FileWithPreview[]>([]);
  const [documents, setDocuments] = useState<FileWithPreview[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Address dropdown state
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [availableCounties, setAvailableCounties] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableZips, setAvailableZips] = useState<string[]>([]);
  const [suggestedZips, setSuggestedZips] = useState<string[]>([]);
  const [suggestedZipsLoading, setSuggestedZipsLoading] = useState(false);
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [showCityList, setShowCityList] = useState(true);

  // Update available counties when state changes
  useEffect(() => {
    if (selectedState) {
      const counties = getCountiesForState(selectedState);
      setAvailableCounties(counties);
      setSelectedCounty("all");
      setSelectedCity("");
      setAvailableCities([]);
      setAvailableZips([]);
      setFormData(prev => ({ ...prev, city: "", state: selectedState, zip_code: "" }));
    }
  }, [selectedState]);

  // Update available cities when county changes
  useEffect(() => {
    if (selectedState && selectedCounty) {
      const hasCountyData = hasCountyCityMapping(selectedState);
      let cities: string[] = [];
      
      if (hasCountyData && selectedCounty !== "all") {
        cities = getCitiesForCounty(selectedState, selectedCounty);
      } else {
        cities = usCitiesByState[selectedState] || [];
      }
      
      setAvailableCities(cities);
      setSelectedCity("");
      setAvailableZips([]);
      setFormData(prev => ({ ...prev, city: "", zip_code: "" }));
    }
  }, [selectedState, selectedCounty]);

  // Track form changes for unsaved changes warning
  useEffect(() => {
    // Skip if it's the initial mount (no changes yet)
    if (!user) return;
    
    const hasContent = formData.address || formData.city || formData.price || 
                       formData.bedrooms || formData.description;
    if (hasContent) {
      setHasUnsavedChanges(true);
    }
  }, [formData, user]);

  // Auto-save functionality
  useEffect(() => {
    if (!user || !hasUnsavedChanges) return;

    const autoSaveInterval = setInterval(() => {
      handleSaveDraft(true);
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [user, hasUnsavedChanges, formData]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Fetch ZIP codes when city changes - uses static data, edge function, and Zippopotam.us fallback
  useEffect(() => {
    const fetchZipCodes = async () => {
      if (selectedState && selectedCity) {
        setSuggestedZipsLoading(true);
        try {
          // Try static data first
          if (hasZipCodeData(selectedCity, selectedState)) {
            const staticZips = getZipCodesForCity(selectedCity, selectedState);
            setSuggestedZips(staticZips);
            setAvailableZips(staticZips);
            setFormData(prev => ({ ...prev, city: selectedCity, zip_code: "" }));
            setSuggestedZipsLoading(false);
            return;
          }
          
          // Try edge function second
          try {
            const { data, error } = await supabase.functions.invoke('get-city-zips', {
              body: { state: selectedState, city: selectedCity }
            });
            if (!error && data?.zips?.length > 0) {
              setSuggestedZips(data.zips);
              setAvailableZips(data.zips);
              setFormData(prev => ({ ...prev, city: selectedCity, zip_code: "" }));
              setSuggestedZipsLoading(false);
              return;
            }
          } catch (edgeFnError) {
            console.log("Edge function failed, trying Zippopotam.us fallback:", edgeFnError);
          }
          
          // Fallback to Zippopotam.us API
          try {
            const response = await fetch(`https://api.zippopotam.us/us/${selectedState}/${encodeURIComponent(selectedCity)}`);
            if (response.ok) {
              const data = await response.json();
              const zips = data.places?.map((place: any) => place['post code']) || [];
              if (zips.length > 0) {
                setSuggestedZips(zips);
                setAvailableZips(zips);
                setFormData(prev => ({ ...prev, city: selectedCity, zip_code: "" }));
                setSuggestedZipsLoading(false);
                return;
              }
            }
          } catch (zippopotamError) {
            console.log("Zippopotam.us fallback failed:", zippopotamError);
          }
          
          // No ZIPs found - allow manual entry without error
          setSuggestedZips([]);
          setAvailableZips([]);
          setFormData(prev => ({ ...prev, city: selectedCity, zip_code: "" }));
        } catch (error) {
          console.error("Error fetching ZIP codes:", error);
          // Don't show error toast - just allow manual entry
          setSuggestedZips([]);
          setAvailableZips([]);
        } finally {
          setSuggestedZipsLoading(false);
        }
      } else {
        setSuggestedZips([]);
        setFormData(prev => ({ ...prev, zip_code: "" }));
      }
    };

    fetchZipCodes();
  }, [selectedState, selectedCity]);

  const toggleCityExpansion = (city: string) => {
    setExpandedCities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(city)) {
        newSet.delete(city);
      } else {
        newSet.add(city);
      }
      return newSet;
    });
  };

  const handleCitySelect = (value: string) => {
    if (value.includes('-')) {
      // It's a neighborhood selection
      const [city, neighborhood] = value.split('-');
      setSelectedCity(city);
      setFormData(prev => ({ 
        ...prev, 
        city,
        neighborhood,
        zip_code: '' // Clear ZIP when changing location
      }));
    } else {
      // It's a city selection
      setSelectedCity(value);
      setFormData(prev => ({ 
        ...prev, 
        city: value,
        neighborhood: '',
        zip_code: ''
      }));
    }
    setShowCityList(false);
    setValidationErrors([]);
  };

  const handleNeighborhoodSelect = (neighborhood: string) => {
    setFormData(prev => ({ ...prev, neighborhood }));
  };

  const handleZipSelect = (zip: string) => {
    setFormData(prev => ({ ...prev, zip_code: zip }));
    setValidationErrors([]);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);


  const handleFileSelect = (files: FileList | null, type: 'photos' | 'floorplans' | 'documents') => {
    if (!files) return;

    const fileArray = Array.from(files);
    const newFiles: FileWithPreview[] = fileArray.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      id: Math.random().toString(36).substr(2, 9),
    }));

    if (type === 'photos') {
      setPhotos(prev => [...prev, ...newFiles]);
    } else if (type === 'floorplans') {
      setFloorPlans(prev => [...prev, ...newFiles]);
    } else {
      setDocuments(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (id: string, type: 'photos' | 'floorplans' | 'documents') => {
    if (type === 'photos') {
      setPhotos(prev => {
        const file = prev.find(f => f.id === id);
        if (file?.preview) URL.revokeObjectURL(file.preview);
        return prev.filter(f => f.id !== id);
      });
    } else if (type === 'floorplans') {
      setFloorPlans(prev => {
        const file = prev.find(f => f.id === id);
        if (file?.preview) URL.revokeObjectURL(file.preview);
        return prev.filter(f => f.id !== id);
      });
    } else {
      setDocuments(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setPhotos(prev => {
      const newPhotos = [...prev];
      const draggedItem = newPhotos[draggedIndex];
      newPhotos.splice(draggedIndex, 1);
      newPhotos.splice(index, 0, draggedItem);
      return newPhotos;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const uploadFiles = async (): Promise<{
    photos: { url: string; name?: string }[];
    floorPlans: { url: string; name?: string }[];
    documents: { url: string; name?: string }[];
  }> => {
    if (!user) {
      console.warn("uploadFiles called without user - aborting");
      return { photos: [], floorPlans: [], documents: [] };
    }

    const uploadedPhotos: { url: string; name?: string }[] = [];
    const uploadedFloorPlans: { url: string; name?: string }[] = [];
    const uploadedDocuments: { url: string; name?: string }[] = [];

    // ---- PHOTOS ----
    for (const photo of photos) {
      // Preserve existing, already-uploaded items
      if (photo.uploaded && photo.url) {
        uploadedPhotos.push({
          url: photo.url,
          name: photo.file?.name || "",
        });
        continue;
      }

      // Skip items without a valid file
      if (!photo.file || photo.file.size === 0) {
        console.warn("Skipping photo without valid file", photo);
        continue;
      }

      // Upload NEW photos only
      const filePath = `${user.id}/${Date.now()}_${photo.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-photos")
        .upload(filePath, photo.file);

      if (uploadError) {
        console.error("Photo upload error", { filePath, uploadError });
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("listing-photos")
        .getPublicUrl(filePath);

      uploadedPhotos.push({ url: publicUrl, name: photo.file.name });
    }

    // ---- FLOOR PLANS ----
    for (const plan of floorPlans) {
      if (plan.uploaded && plan.url) {
        uploadedFloorPlans.push({
          url: plan.url,
          name: plan.file?.name || "",
        });
        continue;
      }

      if (!plan.file || plan.file.size === 0) {
        console.warn("Skipping floor plan without valid file", plan);
        continue;
      }

      const filePath = `${user.id}/${Date.now()}_${plan.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-floorplans")
        .upload(filePath, plan.file);

      if (uploadError) {
        console.error("Floor plan upload error", { filePath, uploadError });
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("listing-floorplans")
        .getPublicUrl(filePath);

      uploadedFloorPlans.push({ url: publicUrl, name: plan.file.name });
    }

    // ---- DOCUMENTS ----
    for (const doc of documents) {
      if (doc.uploaded && doc.url) {
        uploadedDocuments.push({
          url: doc.url,
          name: doc.file?.name || "",
        });
        continue;
      }

      if (!doc.file || doc.file.size === 0) {
        console.warn("Skipping document without valid file", doc);
        continue;
      }

      const filePath = `${user.id}/${Date.now()}_${doc.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-documents")
        .upload(filePath, doc.file);

      if (uploadError) {
        console.error("Document upload error", { filePath, uploadError });
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("listing-documents")
        .getPublicUrl(filePath);

      uploadedDocuments.push({ url: publicUrl, name: doc.file.name });
    }

    console.log("uploadFiles result", {
      photos: uploadedPhotos,
      floorPlans: uploadedFloorPlans,
      documents: uploadedDocuments,
    });

    return {
      photos: uploadedPhotos,
      floorPlans: uploadedFloorPlans,
      documents: uploadedDocuments,
    };
  };

  const handleSaveDraft = async (isAutoSave = false) => {
    try {
      if (!user) {
        if (!isAutoSave) {
          toast.error("Please sign in to save drafts");
          navigate("/auth");
        }
        return;
      }
      
      if (isAutoSave) {
        setAutoSaving(true);
      } else {
        setSubmitting(true);
      }

      const payload: any = {
        agent_id: user.id,
        status: "draft",
        listing_type: formData.listing_type,
        address: (formData.address || "Draft").trim(),
        city: formData.city?.trim() || "",
        state: formData.state?.trim() || "",
        zip_code: formData.zip_code?.trim() || "",
        price: formData.price ? parseFloat(formData.price) : 0,
        property_type: formData.property_type || null,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
        photos: [],
        floor_plans: [],
        documents: [],
      };

      if (draftId) {
        // Update existing draft
        const { error } = await supabase
          .from("listings")
          .update(payload)
          .eq("id", draftId);
        if (error) throw error;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from("listings")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setDraftId(data.id);
      }

      setHasUnsavedChanges(false);
      setLastAutoSave(new Date());
      
      if (!isAutoSave) {
        toast.success("Draft saved successfully!");
        navigate("/agent-dashboard", { state: { reload: true } });
      }
    } catch (error: any) {
      console.error("Error saving draft:", error);
      if (!isAutoSave) {
        toast.error(error.message || "Failed to save draft");
      }
    } finally {
      if (isAutoSave) {
        setAutoSaving(false);
      } else {
        setSubmitting(false);
      }
    }
  };

  const handlePreview = () => {
    toast.info("Preview functionality coming soon");
  };

  const handleSubmit = async (e: React.FormEvent, publishNow: boolean = true) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Prepare data for validation
      const dataToValidate = {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        price: parseFloat(formData.price),
        property_type: formData.property_type || undefined,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : undefined,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : undefined,
        year_built: formData.year_built ? parseInt(formData.year_built) : undefined,
        lot_size: formData.lot_size ? parseFloat(formData.lot_size) : undefined,
        description: formData.description || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };

      // Validate data with Zod
      const validatedData = listingSchema.parse(dataToValidate);

      // Upload files first
      toast.info("Uploading files...");
      const uploadedFiles = await uploadFiles();

      const { data: insertedListing, error } = await supabase.from("listings").insert({
        agent_id: user.id,
        status: publishNow ? formData.status : "draft",
        listing_type: formData.listing_type,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zip_code: validatedData.zip_code,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        property_type: validatedData.property_type || null,
        bedrooms: validatedData.bedrooms || null,
        bathrooms: validatedData.bathrooms || null,
        square_feet: validatedData.square_feet || null,
        lot_size: validatedData.lot_size || null,
        year_built: validatedData.year_built || null,
        price: validatedData.price,
        description: validatedData.description || null,
        commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
        commission_type: formData.commission_type,
        commission_notes: formData.commission_notes || null,
        showing_instructions: formData.showing_instructions || null,
        lockbox_code: formData.lockbox_code || null,
        appointment_required: formData.appointment_required,
        showing_contact_name: formData.showing_contact_name || null,
        showing_contact_phone: formData.showing_contact_phone || null,
        disclosures: disclosures,
        property_features: propertyFeatures,
        amenities: propertyFeatures, // Same as property_features - unified storage
        additional_notes: formData.additional_notes || null,
        photos: uploadedFiles.photos,
        floor_plans: uploadedFiles.floorPlans,
        documents: uploadedFiles.documents,
      }).select('id').single();

      if (error) throw error;

      // Automatically fetch ATTOM data (walk score and schools) after listing is created
      if (insertedListing?.id) {
        try {
          console.log("[AddRentalListing] Triggering auto-fetch-property-data for listing:", insertedListing.id);
          await supabase.functions.invoke('auto-fetch-property-data', {
            body: { listing_id: insertedListing.id }
          });
          console.log("[AddRentalListing] ATTOM data fetch initiated successfully");
        } catch (fetchError) {
          console.error("[AddRentalListing] Error fetching ATTOM data:", fetchError);
          // Don't fail the submission if ATTOM fetch fails
        }
      }

      toast.success("Rental listing created successfully!");
      navigate("/agent-dashboard", { state: { reload: true } });
    } catch (error: any) {
      console.error("Error creating listing:", error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error(error.message || "Failed to create listing");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">Hello. Bonjour. Hola. 你好. Ciao</p>
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-4xl font-bold">
                <span className="text-primary">Gotcha,</span> Let's Help You add a Rental Listing
              </h1>
              <img src={listingIcon} alt="Listing creation" className="w-16 h-16" />
            </div>
            <p className="text-muted-foreground">
              Hovering over your Dashboard within the Menu will give you easy access to your Account. 
              If you have to walk away from your Listing use Save as Draft.
            </p>
          </div>

          {/* Action Buttons - Sticky */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-8 -mx-4 px-4 py-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 flex items-center gap-2">
                {autoSaving && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Auto-saving...</span>
                  </div>
                )}
                {!autoSaving && lastAutoSave && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Last saved {lastAutoSave.toLocaleTimeString()}</span>
                  </div>
                )}
                {!autoSaving && !lastAutoSave && hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Unsaved changes</span>
                  </div>
                )}
              </div>
            <Button variant="outline" size="lg" onClick={() => handleSaveDraft(false)} type="button" disabled={submitting || autoSaving} className="gap-2">
              <Save className="w-5 h-5" />
              Save Draft
            </Button>
              <Button variant="default" size="lg" onClick={handlePreview} type="button" className="gap-2">
                <Eye className="w-5 h-5" />
                Preview Listing
              </Button>
              <Button variant="default" size="lg" onClick={(e) => handleSubmit(e, true)} type="button" disabled={submitting} className="gap-2">
                <Upload className="w-5 h-5" />
                {submitting ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </div>

          {/* Form Card */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-6">Listing Details</h2>
              
              <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
                {/* Address Section */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Property Location</Label>
                  
                  {/* Row 1: State, County */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Select
                        value={selectedState}
                        onValueChange={(value) => {
                          setSelectedState(value);
                          setFormData(prev => ({ ...prev, state: value }));
                        }}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-[300px]">
                          {US_STATES.map((state) => (
                            <SelectItem key={state.code} value={state.code}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>County (Optional)</Label>
                      {!selectedState || availableCounties.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {!selectedState ? "Select a state first" : "No counties available"}
                        </p>
                      ) : (
                        <RadioGroup value={selectedCounty} onValueChange={setSelectedCounty}>
                          <div className="space-y-2 border rounded-lg p-3 max-h-[200px] overflow-y-auto bg-background">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="all" id="county-all" />
                              <Label htmlFor="county-all" className="cursor-pointer flex-1 font-normal">
                                All Counties
                              </Label>
                            </div>
                            {availableCounties.map((county) => (
                              <div key={county} className="flex items-center space-x-2">
                                <RadioGroupItem value={county} id={`county-${county}`} />
                                <Label htmlFor={`county-${county}`} className="cursor-pointer flex-1 font-normal">
                                  {county}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  </div>

                  {/* City with Neighborhoods */}
                  <div className="space-y-2">
                    <Label htmlFor="city">City/Town *</Label>
                    
                    {/* Selected City Display */}
                    {selectedCity && (
                      <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <Home className="h-4 w-4 text-primary" />
                        <div className="flex-1">
                          <div className="font-medium text-primary">
                            {selectedCity}
                            {formData.neighborhood && ` - ${formData.neighborhood}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedState && US_STATES.find(s => s.code === selectedState)?.name}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                        onClick={() => {
                          setSelectedCity("");
                          setFormData(prev => ({ ...prev, city: "", neighborhood: "" }));
                          setCitySearch("");
                          setShowCityList(true);
                        }}
                          className="h-8 gap-1"
                        >
                          <X className="h-3 w-3" />
                          Change
                        </Button>
                      </div>
                    )}
                    
                    {/* Search Input - Only show if no city selected */}
                    {!selectedCity && (
                      <div className="relative">
                        <Input
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          placeholder="Search cities..."
                          className="pr-8"
                        />
                        {citySearch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                            onClick={() => setCitySearch("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}

                    {availableCities.length > 0 && !selectedCity && showCityList ? (
                      <ScrollArea className="h-[300px] border rounded-lg p-3 bg-background">
                        <RadioGroup value={formData.neighborhood ? `${selectedCity}-${formData.neighborhood}` : selectedCity} onValueChange={handleCitySelect}>
                          <div className="space-y-2">
                            {availableCities
                              .filter(city => city.toLowerCase().includes(citySearch.toLowerCase()))
                              .map((city) => {
                                const neighborhoods = getAreasForCity(city, selectedState);
                                const hasNeighborhoods = neighborhoods && neighborhoods.length > 0;
                                const isExpanded = expandedCities.has(city);
                                
                                return (
                                  <div key={city} className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      {hasNeighborhoods && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => toggleCityExpansion(city)}
                                          className="h-6 w-6 p-0"
                                        >
                                          <ChevronDown 
                                            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                          />
                                        </Button>
                                      )}
                                      <RadioGroupItem value={city} id={`city-${city}`} />
                                      <Label 
                                        htmlFor={`city-${city}`} 
                                        className={`cursor-pointer flex-1 font-normal ${!hasNeighborhoods ? 'ml-8' : ''}`}
                                      >
                                        {city}
                                      </Label>
                                    </div>
                                    
                                    {hasNeighborhoods && isExpanded && (
                                      <div className="ml-8 border-l-2 border-muted pl-3 space-y-2 bg-muted/30 rounded-r py-2">
                                        {neighborhoods.map((neighborhood) => (
                                          <div key={neighborhood} className="flex items-center space-x-2">
                                            <RadioGroupItem 
                                              value={`${city}-${neighborhood}`} 
                                              id={`neighborhood-${city}-${neighborhood}`}
                                            />
                                            <Label 
                                              htmlFor={`neighborhood-${city}-${neighborhood}`}
                                              className="cursor-pointer flex-1 text-sm text-muted-foreground font-normal"
                                            >
                                              {neighborhood}
                                            </Label>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </RadioGroup>
                      </ScrollArea>
                    ) : availableCities.length > 0 && selectedCity ? null : (
                      <p className="text-sm text-muted-foreground">
                        {selectedState ? "Select a county or state to see cities" : "Select a state first"}
                      </p>
                    )}
                  </div>

                  {/* ZIP Code Picker */}
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">ZIP Code *</Label>
                    {suggestedZipsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading ZIP codes...
                      </div>
                    ) : suggestedZips.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {suggestedZips.map((zip) => (
                            <Button
                              key={zip}
                              type="button"
                              variant={formData.zip_code === zip ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleZipSelect(zip)}
                            >
                              {zip}
                            </Button>
                          ))}
                        </div>
                        {formData.zip_code && (
                          <p className="text-sm text-muted-foreground">
                            Selected: <span className="font-medium">{formData.zip_code}</span>
                          </p>
                        )}
                      </div>
                    ) : selectedCity ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          No ZIP codes available for this city - enter manually below
                        </p>
                        <Input
                          id="zip_code_manual"
                          value={formData.zip_code}
                          onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                          placeholder="02134"
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a city to see ZIP code options</p>
                    )}
                  </div>

                  {/* Street Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="123 Main Street"
                    />
                  </div>
                </div>

                {/* Row: Property Type, Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="property_type">Property Type</Label>
                    <Select
                      value={formData.property_type}
                      onValueChange={(value) => setFormData({ ...formData, property_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single Family">Single Family</SelectItem>
                        <SelectItem value="Condo">Condo</SelectItem>
                        <SelectItem value="Townhouse">Townhouse</SelectItem>
                        <SelectItem value="Multi-Family">Multi-Family</SelectItem>
                        <SelectItem value="Apartment">Apartment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Available</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="sold">Rented</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row: List Date, Expiration Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="list_date">List Date</Label>
                    <Input
                      id="list_date"
                      type="date"
                      value={formData.list_date}
                      onChange={(e) => setFormData({ ...formData, list_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration_date">Expiration Date</Label>
                    <Input
                      id="expiration_date"
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Monthly Rent */}
                <div className="space-y-2">
                  <Label htmlFor="price">Monthly Rent *</Label>
                  <FormattedInput
                    id="price"
                    format="currency"
                    placeholder="2000"
                    value={formData.price}
                    onChange={(value) => setFormData({ ...formData, price: value })}
                    required
                  />
                </div>

                {/* Row: State, County, Town, Neighborhood (for non-Boston) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="county">County</Label>
                    <Input
                      id="county"
                      value={formData.county}
                      onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="town">Town</Label>
                    <Input
                      id="town"
                      value={formData.town}
                      onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                    />
                  </div>
                  {formData.city !== "Boston" && (
                    <div className="space-y-2">
                      <Label htmlFor="neighborhood">Neighborhood</Label>
                      <Input
                        id="neighborhood"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                {/* Property Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <Label htmlFor="square_feet">Sq Ft</Label>
                    <FormattedInput
                      id="square_feet"
                      format="number"
                      value={formData.square_feet}
                      onChange={(value) => setFormData({ ...formData, square_feet: value })}
                    />
                  </div>
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

                {/* Property Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Property Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    placeholder="Describe the property features, location highlights, and any special details..."
                  />
                </div>

                {/* Commission Information Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Commission Information</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <FormattedInput
                        id="commission_rate"
                        format={formData.commission_type === 'percentage' ? 'percentage' : 'currency'}
                        decimals={2}
                        placeholder={formData.commission_type === 'percentage' ? '2.5' : '500'}
                        value={formData.commission_rate}
                        onChange={(value) => setFormData({ ...formData, commission_rate: value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commission_notes">Commission Notes</Label>
                      <Input
                        id="commission_notes"
                        placeholder="Additional commission details"
                        value={formData.commission_notes}
                        onChange={(e) => setFormData({ ...formData, commission_notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Showing Instructions Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Showing Instructions</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="showing_instructions">Instructions</Label>
                      <Textarea
                        id="showing_instructions"
                        placeholder="Please call 24 hours in advance. Remove shoes..."
                        value={formData.showing_instructions}
                        onChange={(e) => setFormData({ ...formData, showing_instructions: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lockbox_code">Lockbox Code</Label>
                        <Input
                          id="lockbox_code"
                          type="password"
                          placeholder="1234"
                          value={formData.lockbox_code}
                          onChange={(e) => setFormData({ ...formData, lockbox_code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="showing_contact_name">Contact Name</Label>
                        <Input
                          id="showing_contact_name"
                          placeholder="John Doe"
                          value={formData.showing_contact_name}
                          onChange={(e) => setFormData({ ...formData, showing_contact_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="showing_contact_phone">Contact Phone</Label>
                        <FormattedInput
                          id="showing_contact_phone"
                          format="phone"
                          placeholder="1234567890"
                          value={formData.showing_contact_phone}
                          onChange={(value) => setFormData({ ...formData, showing_contact_phone: value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="appointment_required"
                        checked={formData.appointment_required}
                        onChange={(e) => setFormData({ ...formData, appointment_required: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="appointment_required" className="font-normal cursor-pointer">
                        Appointment required for showing
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Disclosures Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Disclosures</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      'Lead-based paint',
                      'Asbestos',
                      'Radon',
                      'Flood zone',
                      'HOA restrictions',
                      'Previous damage/repairs',
                      'Environmental hazards',
                      'Easements',
                      'Pending litigation',
                      'Property liens'
                    ].map((disclosure) => (
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
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={disclosure} className="font-normal cursor-pointer">
                          {disclosure}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Property Features Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Property Features</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      'Hardwood floors',
                      'Granite countertops',
                      'Stainless appliances',
                      'Updated kitchen',
                      'Updated bathrooms',
                      'Fireplace',
                      'Central air',
                      'Forced air heating',
                      'Basement',
                      'Finished basement',
                      'Attic',
                      'Garage',
                      'Carport',
                      'Energy efficient',
                      'Smart home features'
                    ].map((feature) => (
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
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={feature} className="font-normal cursor-pointer">
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Amenities Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Amenities</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      'Pool',
                      'Hot tub',
                      'Tennis court',
                      'Gym/Fitness center',
                      'Playground',
                      'Clubhouse',
                      'Pet friendly',
                      'Gated community',
                      'Security system',
                      'Concierge',
                      'Elevator',
                      'Storage units',
                      'Bike storage',
                      'EV charging',
                      'Package room'
                    ].map((amenity) => (
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
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={amenity} className="font-normal cursor-pointer">
                          {amenity}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="space-y-2 border-t pt-6">
                  <Label htmlFor="additional_notes">Additional Notes</Label>
                  <Textarea
                    id="additional_notes"
                    placeholder="Any other important information about the property..."
                    value={formData.additional_notes}
                    onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                    rows={4}
                  />
                </div>

                {/* Property Photos Section */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xl font-semibold">Property Photos</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Drag and drop to reorder. First photo will be the main image.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('photo-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Photos
                    </Button>
                  </div>
                  <input
                    id="photo-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e.target.files, 'photos')}
                    className="hidden"
                  />
                  {photos.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {photos.map((photo, index) => (
                        <div
                          key={photo.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className="relative group cursor-move border rounded-lg overflow-hidden"
                        >
                          <img src={photo.preview} alt="Property" className="w-full h-40 object-cover" />
                          <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                            {index === 0 ? 'Main' : `#${index + 1}`}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(photo.id, 'photos')}
                            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Floor Plans Section */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-xl font-semibold">Floor Plans</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('floorplan-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Floor Plans
                    </Button>
                  </div>
                  <input
                    id="floorplan-upload"
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileSelect(e.target.files, 'floorplans')}
                    className="hidden"
                  />
                  {floorPlans.length > 0 && (
                    <div className="space-y-2">
                      {floorPlans.map((plan) => (
                        <div key={plan.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            {plan.preview ? (
                              <img src={plan.preview} alt="Floor plan" className="w-16 h-16 object-cover rounded" />
                            ) : (
                              <FileText className="w-8 h-8" />
                            )}
                            <span className="text-sm">{plan.file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(plan.id, 'floorplans')}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documents Section */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-xl font-semibold">Documents</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('document-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Documents
                    </Button>
                  </div>
                  <input
                    id="document-upload"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => handleFileSelect(e.target.files, 'documents')}
                    className="hidden"
                  />
                  {documents.length > 0 && (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="w-8 h-8" />
                            <span className="text-sm">{doc.file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(doc.id, 'documents')}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Action Buttons - Bottom */}
                <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t items-center">
                  <Button variant="ghost" size="lg" onClick={() => navigate("/agent-dashboard")} type="button" className="gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </Button>
                  <div className="flex-1 flex items-center gap-2">
                    {autoSaving && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Auto-saving...</span>
                      </div>
                    )}
                    {!autoSaving && lastAutoSave && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Last saved {lastAutoSave.toLocaleTimeString()}</span>
                      </div>
                    )}
                    {!autoSaving && !lastAutoSave && hasUnsavedChanges && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>Unsaved changes</span>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="lg" onClick={() => handleSaveDraft(false)} type="button" disabled={submitting || autoSaving} className="gap-2">
                    <Save className="w-5 h-5" />
                    Save Draft
                  </Button>
                  <Button variant="default" size="lg" onClick={handlePreview} type="button" className="gap-2">
                    <Eye className="w-5 h-5" />
                    Preview
                  </Button>
                  <Button variant="default" size="lg" onClick={(e) => handleSubmit(e, true)} type="button" disabled={submitting} className="gap-2">
                    <Upload className="w-5 h-5" />
                    {submitting ? "Publishing..." : "Publish"}
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

export default AddRentalListing;
