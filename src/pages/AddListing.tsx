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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { bostonNeighborhoods } from "@/data/bostonNeighborhoods";
import { cn } from "@/lib/utils";

const SUPPORTED_CITIES = [
  "Boston",
  "Cambridge",
  "Somerville",
  "Brookline",
  "Chelsea",
  "Revere",
  "Medford",
  "Everett",
  "Watertown",
  "Newton",
  "Quincy",
  "Other"
];

// County to cities mapping for MA
const CITY_OPTIONS_BY_COUNTY: Record<string, string[]> = {
  Suffolk: ["Boston", "Chelsea", "Revere", "Winthrop"],
  Middlesex: ["Cambridge", "Somerville", "Medford", "Everett", "Watertown", "Newton", "Arlington", "Belmont", "Lexington", "Waltham", "Malden", "Melrose", "Woburn", "Burlington"],
  Norfolk: ["Brookline", "Quincy", "Milton", "Dedham", "Needham", "Wellesley", "Canton", "Randolph"],
  Essex: ["Lynn", "Salem", "Peabody", "Beverly", "Gloucester", "Lawrence", "Haverhill", "Newburyport"],
  Plymouth: ["Plymouth", "Brockton", "Marshfield", "Duxbury", "Hingham", "Weymouth"],
  Bristol: ["New Bedford", "Fall River", "Taunton", "Attleboro"],
  Worcester: ["Worcester", "Fitchburg", "Leominster", "Framingham", "Marlborough"],
  Hampden: ["Springfield", "Holyoke", "Chicopee", "Westfield"],
  Hampshire: ["Northampton", "Amherst", "Easthampton"],
  Berkshire: ["Pittsfield", "North Adams", "Great Barrington"],
  Franklin: ["Greenfield", "Deerfield"],
  Barnstable: ["Barnstable", "Hyannis", "Falmouth", "Sandwich", "Provincetown"],
  Dukes: ["Edgartown", "Oak Bluffs", "Vineyard Haven"],
  Nantucket: ["Nantucket"],
  Other: ["Boston", "Cambridge", "Somerville", "Brookline", "Chelsea", "Revere", "Medford", "Everett", "Watertown", "Newton", "Quincy"]
};

// State name to abbreviation mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  Massachusetts: "MA",
  "New Hampshire": "NH",
  "Rhode Island": "RI",
  Connecticut: "CT",
  Vermont: "VT",
  Maine: "ME",
};

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
  const [hasAutoFetched, setHasAutoFetched] = useState(false);
  const [attomFetchStatus, setAttomFetchStatus] = useState<string>("");
  const [attomNeighborhoods, setAttomNeighborhoods] = useState<string[]>([]);
  const [addressVerified, setAddressVerified] = useState<boolean>(false);
  const [verificationMessage, setVerificationMessage] = useState<string>("");
  
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
  const [cityChoice, setCityChoice] = useState<string>("");
  const [customCity, setCustomCity] = useState<string>("");
  const [openCityCombo, setOpenCityCombo] = useState(false);
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
      // For MA, don't default to "all" since we require county selection
      if (selectedState === "MA") {
        setSelectedCounty("");
      } else {
        setSelectedCounty("all");
      }
      setCityChoice("");
      setCustomCity("");
      setAvailableCities([]);
      setAvailableZips([]);
      setFormData(prev => ({ ...prev, city: "", state: selectedState, zip_code: "", county: "" }));
    }
  }, [selectedState]);

  // Update available cities when county changes
  useEffect(() => {
    if (selectedState) {
      let cityOptions: string[] = [];
      
      // For MA, use county-based filtering
      if (selectedState === "MA" && selectedCounty && selectedCounty !== "all") {
        cityOptions = CITY_OPTIONS_BY_COUNTY[selectedCounty] || CITY_OPTIONS_BY_COUNTY.Other;
        cityOptions = [...cityOptions, "Other"]; // Always allow "Other" as fallback
      } else if (selectedState !== "MA") {
        // For non-MA states, show all supported cities
        cityOptions = SUPPORTED_CITIES;
      }
      
      // Clear city choice if it's not in the new filtered list
      if (cityChoice && !cityOptions.includes(cityChoice) && cityChoice !== "Other") {
        setCityChoice("");
        setCustomCity("");
        setFormData(prev => ({ ...prev, city: "" }));
      }
      
      setAvailableCities(cityOptions);
      setAvailableZips([]);
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
      // Determine the actual city to use for ZIP lookup
      const actualCity = cityChoice === "Other" ? customCity : cityChoice;
      
      if (selectedState && actualCity) {
        setSuggestedZipsLoading(true);
        try {
          if (hasZipCodeData(actualCity, selectedState)) {
            const staticZips = getZipCodesForCity(actualCity, selectedState);
            setSuggestedZips(staticZips);
            setAvailableZips(staticZips);
          } else {
            const { data, error } = await supabase.functions.invoke('get-city-zips', {
              body: { state: selectedState, city: actualCity }
            });
            if (error) throw error;
            const zips = data?.zips || [];
            setSuggestedZips(zips);
            setAvailableZips(zips);
          }
          setFormData(prev => ({ ...prev, city: actualCity, zip_code: "" }));
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
  }, [selectedState, cityChoice, customCity]);

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

  const handleAutoFillFromPublicRecords = async (isAutoTrigger = false) => {
    if (!formData.address || !formData.city || !formData.state) {
      if (!isAutoTrigger) {
        toast.error("Please enter address, city, and state first.");
      }
      return;
    }

    // Normalize state to 2-letter code for ATTOM
    const stateCode = STATE_ABBREVIATIONS[formData.state] || formData.state;
    
    const payload = {
      address: formData.address,
      city: formData.city,
      state: stateCode,
      zip: formData.zip_code,
    };
    
    console.log("ATTOM REQUEST:", payload);

    setAutoFillLoading(true);
    setAttomFetchStatus("Fetching public record data...");
    
    const { data, error } = await supabase.functions.invoke("fetch-property-data", {
      body: payload,
    });
    
    setAutoFillLoading(false);

    if (error || !data) {
      setAttomFetchStatus("No matching public record found. You can enter details manually.");
      if (!isAutoTrigger) {
        toast.error("Could not fetch public record data.");
      }
      console.error(error || data);
      // Enable neighborhood dropdown even on failure
      const areas = getAreasForCity(formData.city, formData.state);
      setAttomNeighborhoods(areas);
      return;
    }

    const results = data.results || [];

    if (results.length === 0) {
      setAttomFetchStatus("No matching public record found. You can enter details manually.");
      
      // Set verification status - enable neighborhood even on failure
      setAddressVerified(true);
      setVerificationMessage("Public record not found – please verify address and choose Neighborhood/Area manually.");
      
      // Enable neighborhood dropdown even on failure
      const areas = getAreasForCity(formData.city, formData.state);
      setAttomNeighborhoods(areas);
      
      if (!isAutoTrigger) {
        toast.error("No property records found for this address.");
      }
      return;
    }

    if (results.length === 1) {
      // Auto-fill with the single result
      applyAttomData(results[0]);
      setAttomFetchStatus("Public record data loaded successfully.");
      if (!isAutoTrigger) {
        toast.success("Property data loaded from public records!");
      }
      setHasAutoFetched(true);
    } else {
      // Show modal to let user choose
      setAttomResults(results);
      setIsAttomModalOpen(true);
      setAttomFetchStatus("Multiple records found - please select one.");
    }
  };

  const applyAttomData = (record: any) => {
    setAttomId(record.attom_id ?? null);
    
    const oldZip = formData.zip_code;
    const newZip = record.zip;
    
    // Handle city from ATTOM record - Check if it's a Boston neighborhood
    if (record.city) {
      const normalizedCity = record.city.trim();
      
      // Check if this is a Boston neighborhood (like Charlestown, Back Bay, etc.)
      if (bostonNeighborhoods.includes(normalizedCity)) {
        // Set city to Boston and neighborhood to the actual neighborhood
        setCityChoice("Boston");
        setCustomCity("");
        setFormData(prev => ({ 
          ...prev, 
          city: "Boston",
          neighborhood: normalizedCity 
        }));
        
        // Get areas for Boston
        const areas = getAreasForCity("Boston", formData.state || record.state);
        setAttomNeighborhoods(areas);
      } else if (SUPPORTED_CITIES.includes(normalizedCity)) {
        setCityChoice(normalizedCity);
        setCustomCity("");
        setFormData(prev => ({ ...prev, city: normalizedCity }));
        
        // Get available neighborhoods for the city
        const areas = getAreasForCity(normalizedCity, formData.state || record.state);
        setAttomNeighborhoods(areas);
      } else {
        setCityChoice("Other");
        setCustomCity(normalizedCity);
        setFormData(prev => ({ ...prev, city: normalizedCity }));
        
        // Get available neighborhoods
        const areas = getAreasForCity(normalizedCity, formData.state || record.state);
        setAttomNeighborhoods(areas);
      }
    } else {
      // No city from ATTOM, but still enable neighborhood dropdown
      const cityToUse = formData.city;
      const stateToUse = formData.state || record.state;
      if (cityToUse && stateToUse) {
        const areas = getAreasForCity(cityToUse, stateToUse);
        setAttomNeighborhoods(areas);
      }
    }
    
    // If ATTOM provides additional neighborhood data in other fields, try to match
    if (record.raw?.address?.locality && attomNeighborhoods.length > 0) {
      const attomNeighborhood = record.raw.address.locality.trim();
      const matchedArea = attomNeighborhoods.find(area => 
        area.toLowerCase() === attomNeighborhood.toLowerCase()
      );
      if (matchedArea && !formData.neighborhood) {
        setFormData(prev => ({ ...prev, neighborhood: matchedArea }));
      }
    }
    
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
      zip_code: newZip || prev.zip_code,
    }));

    // Update property type if it's condo/co-op
    if (record.property_type && (
      record.property_type.toLowerCase().includes('condo') ||
      record.property_type.toLowerCase().includes('co-op')
    )) {
      setFormData(prev => ({ ...prev, property_type: 'condo' }));
    }
    
    // Set address verification status
    setAddressVerified(true);
    setVerificationMessage("Address verified via public records.");
    
    // Show ZIP change notification if needed
    if (newZip && oldZip && newZip !== oldZip) {
      const isLeadingZeroFix = oldZip.length === 4 && newZip === `0${oldZip}`;
      const message = isLeadingZeroFix
        ? `We corrected your ZIP code from ${oldZip} to ${newZip} to match USPS formatting.`
        : `Based on public records for this address, we updated the ZIP code from ${oldZip} to ${newZip}.`;
      
      toast.info("ZIP Code Updated", {
        description: message,
      });
    }
  };

  const handleImportAttomRecord = (record: any) => {
    applyAttomData(record);
    setIsAttomModalOpen(false);
    setAttomFetchStatus("Public record data loaded successfully.");
    setHasAutoFetched(true);
    toast.success("Property data imported from public records!");
  };

  // Auto-fetch when all location fields are filled
  useEffect(() => {
    const hasAllLocationData = 
      formData.address.trim() !== "" &&
      formData.state.trim() !== "" &&
      selectedCounty !== "" && selectedCounty !== "all" &&
      formData.city.trim() !== "" &&
      formData.zip_code.trim() !== "";

    if (hasAllLocationData && !hasAutoFetched && !autoFillLoading) {
      console.log("[AddListing] All location fields filled, triggering auto-fetch");
      handleAutoFillFromPublicRecords(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.address, formData.state, selectedCounty, formData.city, formData.zip_code, hasAutoFetched, autoFillLoading]);

  // Reset auto-fetch flag when address changes significantly
  useEffect(() => {
    if (formData.address || formData.city || formData.zip_code) {
      // If any key field changes after we've already fetched, reset the flag
      if (hasAutoFetched) {
        setHasAutoFetched(false);
        setAttomFetchStatus("");
        setAttomNeighborhoods([]);
      }
    }
  }, [formData.address, formData.city, formData.zip_code, hasAutoFetched]);

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
        county: selectedCounty !== "all" ? selectedCounty : null,
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

      // Validate county for MA
      if (formData.state === "MA" && (!selectedCounty || selectedCounty === "all")) {
        toast.error("Please select a county for Massachusetts listings.");
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
        county: selectedCounty !== "all" ? selectedCounty : null,
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
                    <Label htmlFor="go_live_date">Choose the date your listing will become Active (on MLS) *</Label>
                    <Input
                      id="go_live_date"
                      type="date"
                      value={formData.go_live_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, go_live_date: e.target.value }))}
                      className="mt-1"
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      On this date, the system will automatically change the status from Coming Soon to Active.
                    </p>
                  </div>
                )}

                {/* Address Section */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Property Location</Label>
                  
                  {/* Get Public Data Button - Above everything */}
                  <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <Button
                      type="button"
                      onClick={() => handleAutoFillFromPublicRecords(false)}
                      disabled={autoFillLoading}
                      variant="default"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      size="lg"
                    >
                      {autoFillLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Fetching...
                        </>
                      ) : (
                        "Get Public Data (Tax & Assessment Records)"
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Enter Street, State, County, City/Town, and ZIP, then click this button to pull public record data.
                    </p>
                    {attomFetchStatus && (
                      <p className={cn(
                        "text-sm text-center",
                        attomFetchStatus.includes("successfully") ? "text-green-600" : 
                        attomFetchStatus.includes("Fetching") ? "text-muted-foreground" : 
                        "text-orange-600"
                      )}>
                        {attomFetchStatus}
                      </p>
                    )}
                  </div>
                  
                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address *</Label>
                    <Input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="e.g. 123 Main Street"
                      required
                    />
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
                      <Label>County {selectedState === "MA" && "*"}</Label>
                      {!selectedState || availableCounties.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {!selectedState ? "Select a state first" : "No counties available"}
                        </p>
                      ) : (
                        <>
                          <Select
                            value={selectedCounty}
                            onValueChange={(value) => {
                              setSelectedCounty(value);
                              setFormData(prev => ({ ...prev, county: value }));
                            }}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder={selectedState === "MA" ? "Select county..." : "All Counties"} />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50 max-h-[300px]">
                              {selectedState !== "MA" && (
                                <SelectItem value="all">All Counties</SelectItem>
                              )}
                              {availableCounties.map((county) => (
                                <SelectItem key={county} value={county}>
                                  {county}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                    </div>
                  </div>

                  {/* City/Town Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="city">City/Town *</Label>
                    <Popover open={openCityCombo} onOpenChange={setOpenCityCombo}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCityCombo}
                          className="w-full justify-between bg-background"
                          disabled={selectedState === "MA" && !selectedCounty}
                        >
                          {cityChoice || (selectedState === "MA" && !selectedCounty ? "Select county first" : "Select city...")}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 bg-popover z-50" align="start">
                        <Command>
                          <CommandInput placeholder="Search city..." />
                          <CommandList>
                            <CommandEmpty>No city found.</CommandEmpty>
                            <CommandGroup>
                              {availableCities.map((city) => (
                                <CommandItem
                                  key={city}
                                  value={city}
                                  onSelect={(currentValue) => {
                                    setCityChoice(currentValue === cityChoice ? "" : currentValue);
                                    if (currentValue !== "Other") {
                                      setFormData(prev => ({ ...prev, city: currentValue }));
                                      setCustomCity("");
                                    } else {
                                      setFormData(prev => ({ ...prev, city: "" }));
                                    }
                                    setOpenCityCombo(false);
                                  }}
                                >
                                  {city}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    
                    {cityChoice === "Other" && (
                      <div className="space-y-2 mt-2">
                        <Label htmlFor="customCity">Specify City/Town</Label>
                        <Input
                          id="customCity"
                          type="text"
                          value={customCity}
                          onChange={(e) => {
                            setCustomCity(e.target.value);
                            setFormData(prev => ({ ...prev, city: e.target.value }));
                          }}
                          placeholder="Enter city name"
                          required
                        />
                      </div>
                    )}
                  </div>

                   {/* Neighborhood/Area - Enabled after ATTOM fetch */}
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Neighborhood/Area</Label>
                    <Select
                      value={formData.neighborhood}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, neighborhood: value }))}
                      disabled={!addressVerified}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={
                          !addressVerified
                            ? "Run public record lookup to verify the address, then choose Neighborhood/Area." 
                            : "Select neighborhood..."
                        } />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50 max-h-[300px]">
                        {attomNeighborhoods.map((neighborhood) => (
                          <SelectItem key={neighborhood} value={neighborhood}>
                            {neighborhood}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {verificationMessage && (
                      <p className="text-sm text-muted-foreground">
                        {verificationMessage}
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
            <DialogTitle>Multiple Public Records Found for This Address</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Please select the correct public record below. This will auto-fill property details based on official tax & assessment data.
            </p>
          </DialogHeader>
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
                          variant="default"
                          size="sm"
                          onClick={() => handleImportAttomRecord(record)}
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
