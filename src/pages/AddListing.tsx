import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Save, Eye, Upload, X, Image as ImageIcon, FileText, GripVertical, ArrowLeft, Cloud, ChevronDown, CheckCircle2, AlertCircle, Home, CalendarIcon } from "lucide-react";
import { z } from "zod";
import { format, differenceInDays } from "date-fns";
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

// Zod validation schema
const listingSchema = z.object({
  address: z.string().trim().min(1, "Address is required").max(500),
  city: z.string().trim().min(1, "City is required").max(200),
  state: z.string().trim().length(2, "State must be 2 characters"),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  price: z.number().min(100, "Price must be at least $100").max(100000000),
  property_type: z.string().optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().min(0).max(50).optional(),
  square_feet: z.number().int().min(1).max(100000).optional(),
  year_built: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
  lot_size: z.number().min(0).max(10000).optional(),
  description: z.string().max(5000).optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

const AddListing = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [attomId, setAttomId] = useState<string | null>(null);
  const [attomResults, setAttomResults] = useState<any[]>([]);
  const [isAttomModalOpen, setIsAttomModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    status: "new",
    listing_type: "for_sale",
    property_type: "single_family",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    county: "",
    town: "",
    neighborhood: "",
    latitude: null as number | null,
    longitude: null as number | null,
    bedrooms: "",
    bathrooms: "",
    square_feet: "",
    lot_size: "",
    year_built: "",
    price: "",
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
    annual_property_tax: "",
    tax_year: "",
    go_live_date: "",
    auto_activate_on: null as Date | null,
    // Rental-specific
    monthly_rent: "",
    security_deposit: "",
    lease_term: "",
    available_date: "",
    // Multi-family specific
    num_units: "",
    gross_income: "",
    operating_expenses: "",
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

  // Track form changes
  useEffect(() => {
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
    }, 30000);
    return () => clearInterval(autoSaveInterval);
  }, [user, hasUnsavedChanges, formData]);

  // Warn before leaving
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

  // Fetch ZIP codes when city changes
  useEffect(() => {
    const fetchZipCodes = async () => {
      if (selectedState && selectedCity) {
        setSuggestedZipsLoading(true);
        try {
          if (hasZipCodeData(selectedCity, selectedState)) {
            const staticZips = getZipCodesForCity(selectedCity, selectedState);
            setSuggestedZips(staticZips);
            setAvailableZips(staticZips);
          } else {
            const { data, error } = await supabase.functions.invoke('get-city-zips', {
              body: { state: selectedState, city: selectedCity }
            });
            if (error) throw error;
            const zips = data?.zips || [];
            setSuggestedZips(zips);
            setAvailableZips(zips);
          }
          setFormData(prev => ({ ...prev, city: selectedCity, zip_code: "" }));
        } catch (error) {
          console.error("Error fetching ZIP codes:", error);
          toast.error("Could not load ZIP codes for this city");
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
      const [city, neighborhood] = value.split('-');
      setSelectedCity(city);
      setFormData(prev => ({ ...prev, city, neighborhood, zip_code: '' }));
    } else {
      setSelectedCity(value);
      setFormData(prev => ({ ...prev, city: value, neighborhood: '', zip_code: '' }));
    }
    setShowCityList(false);
    setValidationErrors([]);
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

  const handleAutoFillFromPublicRecords = async () => {
    if (!formData.address || !formData.city || !formData.state) {
      toast.error("Please enter address, city, and state first.");
      return;
    }

    setAutoFillLoading(true);
    const { data, error } = await supabase.functions.invoke("fetch-property-data", {
      body: {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip_code,
      },
    });
    setAutoFillLoading(false);

    if (error || !data) {
      toast.error("Could not fetch public record data.");
      console.error(error || data);
      return;
    }

    const results = data.results || [];

    if (results.length === 0) {
      toast.error("No property records found for this address.");
      return;
    }

    if (results.length === 1) {
      // Auto-fill with the single result
      applyAttomData(results[0]);
      toast.success("Property data loaded from public records!");
    } else {
      // Show modal to let user choose
      setAttomResults(results);
      setIsAttomModalOpen(true);
    }
  };

  const applyAttomData = (record: any) => {
    setAttomId(record.attom_id ?? null);
    setFormData(prev => ({
      ...prev,
      bedrooms: record.beds ? record.beds.toString() : prev.bedrooms,
      bathrooms: record.baths ? record.baths.toString() : prev.bathrooms,
      square_feet: record.sqft ? record.sqft.toString() : prev.square_feet,
      lot_size: record.lotSizeSqft ? record.lotSizeSqft.toString() : prev.lot_size,
      year_built: record.yearBuilt ? record.yearBuilt.toString() : prev.year_built,
      annual_property_tax: record.taxAmount ? record.taxAmount.toString() : prev.annual_property_tax,
      tax_year: record.taxYear ? record.taxYear.toString() : prev.tax_year,
      latitude: record.latitude ?? prev.latitude,
      longitude: record.longitude ?? prev.longitude,
    }));

    // Update property type if it's condo/co-op
    if (record.property_type && (
      record.property_type.toLowerCase().includes('condo') ||
      record.property_type.toLowerCase().includes('co-op')
    )) {
      setFormData(prev => ({ ...prev, property_type: 'condo' }));
    }
  };

  const handleImportAttomRecord = (record: any) => {
    applyAttomData(record);
    setIsAttomModalOpen(false);
    toast.success("Property data imported from public records!");
  };

  const handleStatusChange = (value: string) => {
    setFormData(prev => ({ ...prev, status: value }));
    if (value === "coming_soon") {
      setFormData(prev => ({ ...prev, auto_activate_on: null }));
    } else if (value === "new" || value === "active") {
      setFormData(prev => ({ ...prev, go_live_date: "" }));
    }
  };

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

  const uploadFiles = async (): Promise<{ photos: any[], floorPlans: any[], documents: any[] }> => {
    const uploadedPhotos: any[] = [];
    const uploadedFloorPlans: any[] = [];
    const uploadedDocuments: any[] = [];

    for (const photo of photos) {
      const filePath = `${user.id}/${Date.now()}_${photo.file.name}`;
      const { error } = await supabase.storage
        .from('listing-photos')
        .upload(filePath, photo.file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(filePath);
      uploadedPhotos.push({ url: publicUrl, name: photo.file.name });
    }

    for (const plan of floorPlans) {
      const filePath = `${user.id}/${Date.now()}_${plan.file.name}`;
      const { error } = await supabase.storage
        .from('listing-floorplans')
        .upload(filePath, plan.file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('listing-floorplans')
        .getPublicUrl(filePath);
      uploadedFloorPlans.push({ url: publicUrl, name: plan.file.name });
    }

    for (const doc of documents) {
      const filePath = `${user.id}/${Date.now()}_${doc.file.name}`;
      const { error } = await supabase.storage
        .from('listing-documents')
        .upload(filePath, doc.file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('listing-documents')
        .getPublicUrl(filePath);
      uploadedDocuments.push({ url: publicUrl, name: doc.file.name });
    }

    return { photos: uploadedPhotos, floorPlans: uploadedFloorPlans, documents: uploadedDocuments };
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
        const { error } = await supabase
          .from("listings")
          .update(payload)
          .eq("id", draftId);
        if (error) throw error;
      } else {
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
      // Validate required fields based on listing type
      const requiredFields = formData.listing_type === "for_sale" 
        ? { address: formData.address, city: formData.city, state: formData.state, zipCode: formData.zip_code, price: formData.price }
        : { address: formData.address, city: formData.city, state: formData.state, zipCode: formData.zip_code, monthlyRent: formData.monthly_rent };
      
      const missingFields = Object.entries(requiredFields).filter(([_, value]) => !value);
      if (missingFields.length > 0) {
        toast.error("Please fill in all required fields.");
        setSubmitting(false);
        return;
      }

      // Validate Coming Soon go-live date
      if (formData.status === "coming_soon" && !formData.go_live_date) {
        toast.error("Please select a Go-Live date for Coming Soon listings.");
        setSubmitting(false);
        return;
      }

      // Compute auto_activate_on and auto_activate_days
      let computedAutoActivateOn: string | null = null;
      let computedAutoActivateDays: number | null = null;
      
      if (formData.status === "coming_soon" && formData.go_live_date) {
        computedAutoActivateOn = new Date(formData.go_live_date + "T09:00:00").toISOString();
      }
      
      if (formData.status === "new" && formData.auto_activate_on) {
        computedAutoActivateOn = formData.auto_activate_on.toISOString();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(formData.auto_activate_on);
        targetDate.setHours(0, 0, 0, 0);
        computedAutoActivateDays = differenceInDays(targetDate, today);
      }

      // Prepare data for validation
      const dataToValidate = {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        price: formData.listing_type === "for_sale" ? parseFloat(formData.price) : parseFloat(formData.monthly_rent),
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

      const listingData: any = {
        agent_id: user.id,
        status: publishNow ? formData.status : "draft",
        listing_type: formData.listing_type,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zip_code: validatedData.zip_code,
        neighborhood: formData.neighborhood || null,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        property_type: formData.property_type,
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
        amenities: amenities,
        additional_notes: formData.additional_notes || null,
        photos: uploadedFiles.photos,
        floor_plans: uploadedFiles.floorPlans,
        documents: uploadedFiles.documents,
        attom_id: attomId,
        annual_property_tax: formData.annual_property_tax ? parseFloat(formData.annual_property_tax) : null,
        tax_year: formData.tax_year ? parseInt(formData.tax_year) : null,
        go_live_date: formData.go_live_date || null,
        auto_activate_days: computedAutoActivateDays,
        auto_activate_on: computedAutoActivateOn,
      };

      // Add type-specific fields
      if (formData.listing_type === "for_rent") {
        listingData.monthly_rent = listingData.price;
        if (formData.security_deposit) listingData.security_deposit = parseFloat(formData.security_deposit);
        if (formData.lease_term) listingData.lease_term = formData.lease_term;
        if (formData.available_date) listingData.available_date = formData.available_date;
      }

      // Add multi-family fields if applicable
      if (formData.property_type === "multi_family") {
        if (formData.num_units) listingData.num_units = parseFloat(formData.num_units);
        if (formData.gross_income) listingData.gross_income = parseFloat(formData.gross_income);
        if (formData.operating_expenses) listingData.operating_expenses = parseFloat(formData.operating_expenses);
      }

      const { data: insertedListing, error } = await supabase
        .from("listings")
        .insert(listingData)
        .select('id')
        .single();

      if (error) throw error;

      // Log price history for new listing
      if (insertedListing?.id) {
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData?.user?.id ?? null;

        await (supabase as any).from("listing_price_history").insert({
          listing_id: insertedListing.id,
          old_price: null,
          new_price: validatedData.price,
          changed_by: currentUserId,
          note: "Initial listing price",
        });

        // Log status history
        await (supabase as any).from("listing_status_history").insert({
          listing_id: insertedListing.id,
          old_status: null,
          new_status: formData.status,
          changed_by: currentUserId,
          note: "Listing created",
        });

        // Auto-fetch ATTOM data
        try {
          console.log("[AddListing] Triggering auto-fetch-property-data for listing:", insertedListing.id);
          await supabase.functions.invoke('auto-fetch-property-data', {
            body: { listing_id: insertedListing.id }
          });
        } catch (fetchError) {
          console.error("[AddListing] Error fetching ATTOM data:", fetchError);
        }
      }

      toast.success("Listing created successfully!");
      navigate("/agent-dashboard", { state: { reload: true } });
    } catch (error: any) {
      console.error("Error creating listing:", error);
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
                <span className="text-primary">Gotcha,</span> Let's Help You Add a Listing
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
                {/* Status & Type Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select value={formData.status} onValueChange={handleStatusChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="coming_soon">Coming Soon</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="listing_type">Listing Category *</Label>
                    <Select value={formData.listing_type} onValueChange={(value) => setFormData(prev => ({ ...prev, listing_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="for_sale">For Sale</SelectItem>
                        <SelectItem value="for_rent">For Rent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="property_type">Property Style *</Label>
                    <Select value={formData.property_type} onValueChange={(value) => setFormData(prev => ({ ...prev, property_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_family">Single Family</SelectItem>
                        <SelectItem value="condo">Condo</SelectItem>
                        <SelectItem value="multi_family">Multi-Family</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Coming Soon Date */}
                {formData.status === "coming_soon" && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <Label htmlFor="go_live_date">Go-Live / Active On Date *</Label>
                    <Input
                      id="go_live_date"
                      type="date"
                      value={formData.go_live_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, go_live_date: e.target.value }))}
                      className="mt-1"
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Date this Coming Soon listing should automatically become Active.
                    </p>
                  </div>
                )}

                {/* Auto-activate Date Picker */}
                {formData.status === "new" && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <Label htmlFor="auto_activate_on">Auto-activate on</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="auto_activate_on"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal mt-1",
                            !formData.auto_activate_on && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.auto_activate_on ? (
                            format(formData.auto_activate_on, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.auto_activate_on || undefined}
                          onSelect={(date) => setFormData(prev => ({ ...prev, auto_activate_on: date || null }))}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. Listing will automatically become Active on this date.
                    </p>
                  </div>
                )}

                {/* Address Section */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Property Location</Label>
                  
                  {/* Address with Auto-fill */}
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="address"
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
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
                  
                  {/* State, County */}
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
                          <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded text-sm text-primary">
                            <CheckCircle2 className="h-4 w-4" />
                            Selected: {formData.zip_code}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Input
                        id="zip_code"
                        type="text"
                        placeholder="Enter ZIP code"
                        value={formData.zip_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                        required
                      />
                    )}
                  </div>
                </div>

                {/* Price Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-lg font-semibold">Pricing</Label>
                  {formData.listing_type === "for_sale" ? (
                    <div className="space-y-2">
                      <Label htmlFor="price">Listing Price *</Label>
                      <FormattedInput
                        id="price"
                        format="currency"
                        placeholder="500000"
                        value={formData.price}
                        onChange={(value) => setFormData(prev => ({ ...prev, price: value }))}
                        decimals={0}
                        required
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="monthly_rent">Monthly Rent *</Label>
                        <FormattedInput
                          id="monthly_rent"
                          format="currency"
                          placeholder="2000"
                          value={formData.monthly_rent}
                          onChange={(value) => setFormData(prev => ({ ...prev, monthly_rent: value }))}
                          decimals={0}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="security_deposit">Security Deposit</Label>
                        <FormattedInput
                          id="security_deposit"
                          format="currency"
                          placeholder="2000"
                          value={formData.security_deposit}
                          onChange={(value) => setFormData(prev => ({ ...prev, security_deposit: value }))}
                          decimals={0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lease_term">Lease Term</Label>
                        <Input
                          id="lease_term"
                          placeholder="12 months"
                          value={formData.lease_term}
                          onChange={(e) => setFormData(prev => ({ ...prev, lease_term: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Property Details */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-lg font-semibold">Property Details</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bedrooms">Bedrooms</Label>
                      <Input
                        id="bedrooms"
                        type="number"
                        value={formData.bedrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bathrooms">Bathrooms</Label>
                      <Input
                        id="bathrooms"
                        type="number"
                        step="0.5"
                        value={formData.bathrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="square_feet">Sq Ft</Label>
                      <FormattedInput
                        id="square_feet"
                        format="number"
                        value={formData.square_feet}
                        onChange={(value) => setFormData(prev => ({ ...prev, square_feet: value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year_built">Year Built</Label>
                      <Input
                        id="year_built"
                        type="number"
                        value={formData.year_built}
                        onChange={(e) => setFormData(prev => ({ ...prev, year_built: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Property Description */}
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="description">Property Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={6}
                      placeholder="Describe the property features, location highlights, and any special details..."
                    />
                  </div>
                </div>

                {/* Commission & Compensation */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Commission & Compensation</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="commission_type">Commission Type</Label>
                      <Select
                        value={formData.commission_type}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, commission_type: value }))}
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
                        onChange={(value) => setFormData(prev => ({ ...prev, commission_rate: value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commission_notes">Commission Notes</Label>
                      <Input
                        id="commission_notes"
                        placeholder="Additional commission details"
                        value={formData.commission_notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, commission_notes: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Showing Instructions */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Showing Instructions</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="showing_instructions">Instructions</Label>
                      <Textarea
                        id="showing_instructions"
                        placeholder="Please call 24 hours in advance. Remove shoes..."
                        value={formData.showing_instructions}
                        onChange={(e) => setFormData(prev => ({ ...prev, showing_instructions: e.target.value }))}
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
                          onChange={(e) => setFormData(prev => ({ ...prev, lockbox_code: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="showing_contact_name">Contact Name</Label>
                        <Input
                          id="showing_contact_name"
                          placeholder="John Doe"
                          value={formData.showing_contact_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, showing_contact_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="showing_contact_phone">Contact Phone</Label>
                        <FormattedInput
                          id="showing_contact_phone"
                          format="phone"
                          placeholder="1234567890"
                          value={formData.showing_contact_phone}
                          onChange={(value) => setFormData(prev => ({ ...prev, showing_contact_phone: value }))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="appointment_required"
                        checked={formData.appointment_required}
                        onChange={(e) => setFormData(prev => ({ ...prev, appointment_required: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="appointment_required" className="font-normal cursor-pointer">
                        Appointment required for showing
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Disclosures */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Disclosures</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      'Lead-based paint', 'Asbestos', 'Radon', 'Flood zone', 'HOA restrictions',
                      'Previous damage/repairs', 'Environmental hazards', 'Easements',
                      'Pending litigation', 'Property liens'
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

                {/* Property Features */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Property Features</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      'Hardwood floors', 'Granite countertops', 'Stainless appliances',
                      'Updated kitchen', 'Updated bathrooms', 'Fireplace', 'Central air',
                      'Forced air heating', 'Basement', 'Finished basement', 'Attic',
                      'Garage', 'Carport', 'Energy efficient', 'Smart home features'
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

                {/* Amenities */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Amenities</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      'Pool', 'Hot tub', 'Tennis court', 'Gym/Fitness center', 'Playground',
                      'Clubhouse', 'Pet friendly', 'Gated community', 'Security system',
                      'Concierge', 'Elevator', 'Storage units', 'Bike storage',
                      'EV charging', 'Package room'
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
                    onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
                    rows={4}
                  />
                </div>

                {/* Media & Documents */}
                <div className="space-y-6 border-t pt-6">
                  <Label className="text-xl font-semibold">Media & Documents</Label>
                  
                  {/* Property Photos */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-lg font-medium">Property Photos</Label>
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

                  {/* Floor Plans */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-medium">Floor Plans</Label>
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
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e.target.files, 'floorplans')}
                      className="hidden"
                    />
                    {floorPlans.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {floorPlans.map((plan) => (
                          <div key={plan.id} className="relative group border rounded-lg overflow-hidden">
                            {plan.preview ? (
                              <img src={plan.preview} alt="Floor plan" className="w-full h-40 object-cover" />
                            ) : (
                              <div className="w-full h-40 bg-muted flex items-center justify-center">
                                <FileText className="w-12 h-12 text-muted-foreground" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(plan.id, 'floorplans')}
                              className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Documents */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-medium">Documents</Label>
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
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileSelect(e.target.files, 'documents')}
                      className="hidden"
                    />
                    {documents.length > 0 && (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                              <span className="text-sm">{doc.file.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFile(doc.id, 'documents')}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ATTOM Records Selection Modal */}
      <Dialog open={isAttomModalOpen} onOpenChange={setIsAttomModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Please choose a record to import</DialogTitle>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 mb-4">
            Please note that the property type of the listing will be updated with the property type of the public record that you select.
          </div>
          <div className="flex-1 overflow-auto">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Address</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">City</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Owner</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Property Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {attomResults.map((record, index) => (
                    <tr key={record.attom_id || index} className="border-t hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">{record.address || '—'}</td>
                      <td className="px-4 py-3 text-sm">{record.city || '—'}</td>
                      <td className="px-4 py-3 text-sm">{record.owner || '—'}</td>
                      <td className="px-4 py-3 text-sm">{record.property_type || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => handleImportAttomRecord(record)}
                          className="text-primary underline"
                        >
                          Import
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddListing;
