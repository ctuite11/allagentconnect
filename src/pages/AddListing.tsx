import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Loader2, Save, Eye, Upload, X, Image as ImageIcon, FileText, GripVertical, ArrowLeft, Cloud, ChevronDown, CheckCircle2, AlertCircle, Home, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { format, differenceInDays } from "date-fns";
import listingIcon from "@/assets/listing-creation-icon.png";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { getZipCodesForCity, hasZipCodeData } from "@/data/usZipCodesByCity";
import { bostonNeighborhoods } from "@/data/bostonNeighborhoods";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { cn } from "@/lib/utils";
import { 
  getCitiesForStateAndCounty, 
  getNeighborhoodsForLocation, 
  validateAndNormalizeCity,
  validateLocationCombo,
  type CityOption 
} from "@/lib/locationData";

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
  documentType?: string;
}

// Zod validation schema - year_built allows empty/undefined, only validates when value provided
const listingSchema = z.object({
  address: z.string().trim().min(1, "Address is required").max(500),
  city: z.string().trim().min(1, "City is required").max(200),
  state: z.string().trim().length(2, "State must be 2 characters"),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  price: z.number().min(100, "Price must be at least $100").max(100000000),
  property_type: z.string().optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().min(0).max(50).optional(),
  square_feet: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().min(1, "Square feet must be at least 1").max(100000, "Square feet must be less than 100,000").optional()
  ),
  year_built: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
    z.number().int().min(1800, "Year built must be 1800 or later").max(new Date().getFullYear() + 1, "Year cannot be in the future").nullable()
  ).optional(),
  lot_size: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
    z.number().min(0, "Lot size must be 0 or more").max(10000, "Lot size must be less than 10,000 acres").nullable()
  ).optional(),
  description: z.string().max(5000).optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

const AddListing = () => {
  const navigate = useNavigate();
  const { id: listingId } = useParams<{ id: string }>();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingListing, setIsLoadingListing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [attomId, setAttomId] = useState<string | null>(null);
  const [attomResults, setAttomResults] = useState<any[]>([]);
  const [isAttomModalOpen, setIsAttomModalOpen] = useState(false);
  const [hasAutoFetched, setHasAutoFetched] = useState(false);
  const [attomFetchStatus, setAttomFetchStatus] = useState<string>("");
  const [attomNeighborhoods, setAttomNeighborhoods] = useState<string[]>([]);
  const [addressVerified, setAddressVerified] = useState<boolean>(false);
  const [verificationMessage, setVerificationMessage] = useState<string>("");
  const [publicRecordStatus, setPublicRecordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // ATTOM address confirmation state
  const [attomPendingRecord, setAttomPendingRecord] = useState<any>(null);
  const [isAddressConfirmOpen, setIsAddressConfirmOpen] = useState(false);
  const [attomRejectedForAddress, setAttomRejectedForAddress] = useState<string>("");
  // Flag to track if ATTOM address has been confirmed (prevents auto-popup on edit/return)
  const [hasConfirmedAttomAddress, setHasConfirmedAttomAddress] = useState(false);
  
  // Ref to track when we're applying ATTOM data (to prevent re-triggering fetch)
  const isApplyingAttomDataRef = useRef(false);
  // State to track initial data loading (prevent ATTOM auto-fetch during load)
  // Using state instead of ref so that changes trigger re-renders and the useEffect re-runs
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Refs to track original values for change detection in edit mode
  const originalPriceRef = useRef<number | null>(null);
  const originalStatusRef = useRef<string | null>(null);

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
    // New date fields
    list_date: new Date().toISOString().split('T')[0],
    expiration_date: "",
    // Rental-specific
    monthly_rent: "",
    security_deposit: "",
    lease_term: "",
    available_date: "",
    // Multi-family specific (FOR SALE)
    num_units: "",
    gross_income: "",
    operating_expenses: "",
    total_rooms: "",
    total_bedrooms: "",
    total_full_baths: "",
    total_half_baths: "",
    total_fireplaces: "",
    total_monthly_rent: "",
    // New fields
    disclosures_other: "",
    listing_exclusions: "",
    property_website_url: "",
    virtual_tour_url: "",
    video_url: "",
    listing_agreement_type: "",
    // New rental & apartment fields
    unit_number: "",
    building_name: "",
    rental_fee: "",
    laundry_type: "none",
    pets_comment: "",
  });

  // Multi-family units state
  const [units, setUnits] = useState<Array<{
    unit_number: string;
    bedrooms: number;
    full_baths: number;
    half_baths: number;
    rent: number;
  }>>([]);

  // New state for rental multi-select fields
  const [depositRequirements, setDepositRequirements] = useState<string[]>([]);
  const [outdoorSpace, setOutdoorSpace] = useState<string[]>([]);
  const [storageOptions, setStorageOptions] = useState<string[]>([]);
  const [petOptions, setPetOptions] = useState<string[]>([]);
  const [leadPaint, setLeadPaint] = useState<string[]>([]);
  const [handicapAccessible, setHandicapAccessible] = useState<string>("");

  const [disclosures, setDisclosures] = useState<string[]>([]);
  const [propertyFeatures, setPropertyFeatures] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [otherAmenity, setOtherAmenity] = useState<string>("");
  const [areaAmenities, setAreaAmenities] = useState<string[]>([]);
  const [otherAreaAmenity, setOtherAreaAmenity] = useState<string>("");
  
  // New organized amenity categories (4 groups)
  const [interiorAmenities, setInteriorAmenities] = useState<string[]>([]);
  const [exteriorAmenities, setExteriorAmenities] = useState<string[]>([]);
  const [communityAmenities, setCommunityAmenities] = useState<string[]>([]);
  const [locationAmenities, setLocationAmenities] = useState<string[]>([]);
  const [otherAmenities, setOtherAmenities] = useState<string>("");
  const [multiFamilyFeatures, setMultiFamilyFeatures] = useState<string[]>([]);
  const [multiFamilyLaundry, setMultiFamilyLaundry] = useState<string[]>([]);
  const [rentalFeatures, setRentalFeatures] = useState<string[]>([]);
  
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
  const [availableCities, setAvailableCities] = useState<CityOption[]>([]);
  const [availableZips, setAvailableZips] = useState<string[]>([]);
  const [suggestedZips, setSuggestedZips] = useState<string[]>([]);
  const [suggestedZipsLoading, setSuggestedZipsLoading] = useState(false);
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [locationValidation, setLocationValidation] = useState<{ isValid: boolean; message?: string }>({ isValid: true });
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

  // Update available cities when state or county changes
  useEffect(() => {
    if (selectedState) {
      const cityOptions = getCitiesForStateAndCounty(selectedState, selectedCounty);
      
      // Clear city choice if it's not in the new filtered list
      const currentCityExists = cityOptions.some(
        c => c.name.toLowerCase() === cityChoice?.toLowerCase()
      );
      
      if (cityChoice && !currentCityExists) {
        setCityChoice("");
        setFormData(prev => ({ ...prev, city: "" }));
      }
      
      setAvailableCities(cityOptions);
      setAvailableZips([]);
    }
  }, [selectedState, selectedCounty]);

  // Validate location combination whenever it changes
  useEffect(() => {
    const validation = validateLocationCombo({
      state: selectedState,
      county: selectedCounty !== 'all' ? selectedCounty : undefined,
      city: formData.city
    });
    setLocationValidation(validation);
  }, [selectedState, selectedCounty, formData.city]);

  // Track form changes
  useEffect(() => {
    if (!user) return;
    const hasContent = formData.address || formData.city || formData.price || 
                       formData.bedrooms || formData.description;
    if (hasContent) {
      setHasUnsavedChanges(true);
    }
  }, [formData, user]);

  // Auto-save functionality - debounced on changes
  useEffect(() => {
    if (!user || !hasUnsavedChanges) return;
    
    // Debounce autosave to 3 seconds after last change
    const debounceTimeout = setTimeout(() => {
      handleSaveDraft(true);
    }, 3000);
    
    return () => clearTimeout(debounceTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hasUnsavedChanges, formData, photos, floorPlans, documents, disclosures, propertyFeatures, amenities]);

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

  // Fetch ZIP codes when city changes - uses static data, edge function, and Zippopotam.us fallback
  useEffect(() => {
    const fetchZipCodes = async () => {
      // Use cityChoice directly (no more "Other" option)
      const actualCity = cityChoice;
      
      if (selectedState && actualCity) {
        setSuggestedZipsLoading(true);
        try {
          // Preserve existing ZIP code from database when editing
          const existingZip = formData.zip_code;
          
          // Try static data first
          if (hasZipCodeData(actualCity, selectedState)) {
            const staticZips = getZipCodesForCity(actualCity, selectedState);
            // Include existing ZIP if not in list (for edit mode)
            const allZips = existingZip && !staticZips.includes(existingZip) 
              ? [...staticZips, existingZip] 
              : staticZips;
            setSuggestedZips(allZips);
            setAvailableZips(allZips);
            // Don't clear ZIP in edit mode
            if (!existingZip) {
              setFormData(prev => ({ ...prev, city: actualCity }));
            }
            setSuggestedZipsLoading(false);
            return;
          }
          
          // Try edge function second
          try {
            const { data, error } = await supabase.functions.invoke('get-city-zips', {
              body: { state: selectedState, city: actualCity }
            });
            if (!error && data?.zips?.length > 0) {
              const allZips = existingZip && !data.zips.includes(existingZip)
                ? [...data.zips, existingZip]
                : data.zips;
              setSuggestedZips(allZips);
              setAvailableZips(allZips);
              if (!existingZip) {
                setFormData(prev => ({ ...prev, city: actualCity }));
              }
              setSuggestedZipsLoading(false);
              return;
            }
          } catch (edgeFnError) {
            console.log("Edge function failed, trying Zippopotam.us fallback:", edgeFnError);
          }
          
          // Fallback to Zippopotam.us API
          try {
            const response = await fetch(`https://api.zippopotam.us/us/${selectedState}/${encodeURIComponent(actualCity)}`);
            if (response.ok) {
              const data = await response.json();
              const zips = data.places?.map((place: any) => place['post code']) || [];
              if (zips.length > 0) {
                const allZips = existingZip && !zips.includes(existingZip)
                  ? [...zips, existingZip]
                  : zips;
                setSuggestedZips(allZips);
                setAvailableZips(allZips);
                if (!existingZip) {
                  setFormData(prev => ({ ...prev, city: actualCity }));
                }
                setSuggestedZipsLoading(false);
                return;
              }
            }
          } catch (zippopotamError) {
            console.log("Zippopotam.us fallback failed:", zippopotamError);
          }
          
          // No ZIPs found - allow manual entry without error
          // But preserve existing ZIP if we have one
          if (existingZip) {
            setSuggestedZips([existingZip]);
            setAvailableZips([existingZip]);
          } else {
            setSuggestedZips([]);
            setAvailableZips([]);
            setFormData(prev => ({ ...prev, city: actualCity }));
          }
        } catch (error) {
          console.error("Error fetching ZIP codes:", error);
          // Don't show error toast - just allow manual entry
          // Preserve existing ZIP if we have one
          if (formData.zip_code) {
            setSuggestedZips([formData.zip_code]);
            setAvailableZips([formData.zip_code]);
          } else {
            setSuggestedZips([]);
            setAvailableZips([]);
          }
        } finally {
          setSuggestedZipsLoading(false);
        }
      } else {
        setSuggestedZips([]);
        // Don't clear ZIP if we have one (edit mode)
        if (!formData.zip_code) {
          setFormData(prev => ({ ...prev, zip_code: "" }));
        }
      }
    };
    fetchZipCodes();
  }, [selectedState, cityChoice]);

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
      // Set initial load flag to prevent ATTOM auto-fetch during data load
      setIsInitialLoad(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      
      // If we have a listingId in URL, load that listing's data
      if (listingId) {
        console.log('[AddListing] Loading listing from URL param:', listingId);
        await loadExistingListing(listingId);
      }
      
      setLoading(false);
      
      // Allow ATTOM auto-fetch after initial load completes (with small delay)
      setTimeout(() => {
        setIsInitialLoad(false);
        console.log('[AddListing] Initial load complete, ATTOM auto-fetch enabled');
      }, 500);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, listingId]);

  // Function to load existing listing data
  const loadExistingListing = async (id: string) => {
    setIsLoadingListing(true);
    try {
      console.log('[AddListing] Loading existing listing:', id);
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('[AddListing] Error loading listing:', error);
        toast.error('Failed to load listing data');
        setIsLoadingListing(false);
        return;
      }
      
      if (data) {
        const photosArray = Array.isArray(data.photos) ? data.photos : [];
        console.log('[AddListing] Loaded listing data:', {
          id: data.id,
          address: data.address,
          city: data.city,
          state: data.state,
          photos: photosArray.length
        });
        setDraftId(data.id);
        
        // Set state/county/city selectors FIRST (order matters for cascading selects)
        if (data.state) {
          setSelectedState(data.state);
        }
        if (data.county) {
          setSelectedCounty(data.county);
        }
        if (data.city) {
          setCityChoice(data.city);
        }
        
        // Set form data from loaded listing
        // Store original values for change tracking in edit mode
        originalPriceRef.current = data.price || null;
        originalStatusRef.current = (data.status || "new").toLowerCase();

        // Normalize status to lowercase to match Select options
        const normalizedStatus = (data.status || "new").toLowerCase();
        
        setFormData(prev => ({
          ...prev,
          status: normalizedStatus,
          listing_type: data.listing_type || "for_sale",
          property_type: data.property_type || "single_family",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zip_code: data.zip_code || "",
          county: data.county || "",
          neighborhood: data.neighborhood || "",
          latitude: data.latitude,
          longitude: data.longitude,
          bedrooms: data.bedrooms?.toString() || "",
          bathrooms: data.bathrooms?.toString() || "",
          square_feet: data.square_feet?.toString() || "",
          lot_size: data.lot_size?.toString() || "",
          year_built: data.year_built?.toString() || "",
          price: data.price?.toString() || "",
          description: data.description || "",
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
          tax_year: data.tax_year?.toString() || "",
          go_live_date: data.go_live_date || "",
          list_date: data.list_date || "",
          expiration_date: data.expiration_date || "",
          unit_number: data.unit_number || "",
          building_name: data.building_name || "",
          rental_fee: data.rental_fee?.toString() || "",
          laundry_type: data.laundry_type || "none",
          pets_comment: data.pets_comment || "",
          listing_agreement_type: Array.isArray(data.listing_agreement_types) && data.listing_agreement_types.length > 0 
            ? data.listing_agreement_types[0] as string 
            : "",
          // Additional fields that were missing
          listing_exclusions: data.listing_exclusions || "",
          property_website_url: data.property_website_url || "",
          virtual_tour_url: data.virtual_tour_url || "",
          video_url: data.video_url || "",
          disclosures_other: data.disclosures_other || "",
        }));
        
        // Load photos from database
        if (data.photos && Array.isArray(data.photos) && data.photos.length > 0) {
          console.log('[AddListing] Loading photos:', data.photos.length);
          const loadedPhotos: FileWithPreview[] = data.photos.map((photo: any, index: number) => ({
            file: new File([], ''),
            preview: typeof photo === 'string' ? photo : photo.url,
            id: `existing-photo-${index}`,
            uploaded: true,
            url: typeof photo === 'string' ? photo : photo.url
          }));
          setPhotos(loadedPhotos);
        } else {
          console.log('[AddListing] No photos found in listing');
          setPhotos([]);
        }
        
        // Load floor plans from database
        if (data.floor_plans && Array.isArray(data.floor_plans) && data.floor_plans.length > 0) {
          console.log('[AddListing] Loading floor plans:', data.floor_plans.length);
          const loadedFloorPlans: FileWithPreview[] = data.floor_plans.map((plan: any, index: number) => ({
            file: new File([], ''),
            preview: typeof plan === 'string' ? plan : plan.url,
            id: `existing-floor-${index}`,
            uploaded: true,
            url: typeof plan === 'string' ? plan : plan.url
          }));
          setFloorPlans(loadedFloorPlans);
        } else {
          console.log('[AddListing] No floor plans found in listing');
          setFloorPlans([]);
        }
        
        // Load documents from database
        if (data.documents && Array.isArray(data.documents) && data.documents.length > 0) {
          console.log('[AddListing] Loading documents:', data.documents.length);
          const loadedDocuments: FileWithPreview[] = data.documents.map((doc: any, index: number) => ({
            file: new File([], ''),
            preview: typeof doc === 'string' ? doc : doc.url,
            id: `existing-doc-${index}`,
            uploaded: true,
            url: typeof doc === 'string' ? doc : doc.url,
            documentType: doc.documentType || ''
          }));
          setDocuments(loadedDocuments);
        } else {
          console.log('[AddListing] No documents found in listing');
          setDocuments([]);
        }
        
        // Load other arrays (cast from Json[] to string[])
        if (data.disclosures && Array.isArray(data.disclosures)) {
          setDisclosures(data.disclosures as string[]);
        }
        
        // COMBINE property_features + amenities into one unified set (no duplicates)
        const dbPropertyFeatures = Array.isArray(data.property_features) ? data.property_features as string[] : [];
        const dbAmenities = Array.isArray(data.amenities) ? data.amenities as string[] : [];
        const combinedFeatures = Array.from(new Set([...dbPropertyFeatures, ...dbAmenities]));
        setPropertyFeatures(combinedFeatures);
        // Keep amenities in sync for backward compatibility
        setAmenities(combinedFeatures);
        
        if (data.deposit_requirements && Array.isArray(data.deposit_requirements)) {
          setDepositRequirements(data.deposit_requirements as string[]);
        }
        if (data.outdoor_space && Array.isArray(data.outdoor_space)) {
          setOutdoorSpace(data.outdoor_space as string[]);
        }
        if (data.storage_options && Array.isArray(data.storage_options)) {
          setStorageOptions(data.storage_options as string[]);
        }
        if (data.pet_options && Array.isArray(data.pet_options)) {
          setPetOptions(data.pet_options as string[]);
        }
        
        // Load lead_paint: stored as string in DB, but UI expects array
        if (data.lead_paint) {
          const leadPaintArray = typeof data.lead_paint === 'string'
            ? data.lead_paint.split(', ').filter(Boolean)
            : Array.isArray(data.lead_paint) ? data.lead_paint : [];
          setLeadPaint(leadPaintArray);
        }
        
        // Load handicap_accessible
        if (data.handicap_accessible !== undefined && data.handicap_accessible !== null) {
          setHandicapAccessible(data.handicap_accessible);
        }
        
        // Load area_amenities
        if (Array.isArray(data.area_amenities)) {
          setAreaAmenities(data.area_amenities as string[]);
        }
        
        // For edit mode: always prevent ATTOM auto-popup
        // Set hasConfirmedAttomAddress to true for existing listings
        setHasConfirmedAttomAddress(true);
        setHasAutoFetched(true);
        
        if (data.attom_id) {
          setAttomId(data.attom_id);
          console.log('[AddListing] Edit mode: Has ATTOM data, auto-popup disabled');
        } else {
          console.log('[AddListing] Edit mode: No ATTOM data, but auto-popup still disabled (user can manually trigger)');
        }
        
        setHasUnsavedChanges(false);
        console.log('[AddListing] Listing data loaded successfully');
      }
    } catch (err) {
      console.error('[AddListing] Error in loadExistingListing:', err);
      toast.error('Failed to load listing data');
    } finally {
      setIsLoadingListing(false);
    }
  };

  // Helper to build one-line address string from ATTOM record
  // ATTOM's address field (from oneLine) is already formatted as full address
  const buildAttomAddressString = (record: any): string => {
    return record.address || '';
  };

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
    
    console.log("[AddListing] ATTOM REQUEST:", payload);

    setPublicRecordStatus('loading');
    setAutoFillLoading(true);
    setAttomFetchStatus("Fetching public record data...");
    
    try {
      const { data, error } = await supabase.functions.invoke("fetch-property-data", {
        body: payload,
      });
      
      console.log("[AddListing] ATTOM RESPONSE:", { data, error });
      setAutoFillLoading(false);

      if (error || !data) {
        setPublicRecordStatus('error');
        setAttomFetchStatus("No matching public record found. You can enter details manually.");
        if (!isAutoTrigger) {
          toast.error("Could not fetch public record data.");
        }
        console.error("[AddListing] ATTOM error:", error || data);
        // Enable neighborhood dropdown even on failure
        const areas = getAreasForCity(formData.city, formData.state);
        setAttomNeighborhoods(areas);
        return;
      }

      const results = data.results || [];
      console.log("[AddListing] ATTOM results count:", results.length);

      if (results.length === 0) {
        setPublicRecordStatus('error');
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
        const record = results[0];
        const attomAddressKey = buildAttomAddressString(record);
        
        console.log("[AddListing] ATTOM single result found:", {
          address: attomAddressKey,
          record: record,
          rejectedAddress: attomRejectedForAddress
        });

        // If user already rejected this exact address, skip confirmation
        if (attomRejectedForAddress === attomAddressKey) {
          console.log("[AddListing] ATTOM address previously rejected, skipping confirmation");
          setPublicRecordStatus('idle');
          setAttomFetchStatus("");
          setHasAutoFetched(true);
          return;
        }

        // Show confirmation modal instead of auto-applying
        console.log("[AddListing] Opening ATTOM confirmation modal");
        setAttomPendingRecord(record);
        setIsAddressConfirmOpen(true);
        setPublicRecordStatus('idle');
        setAttomFetchStatus("Address found - please confirm.");
        return;
      } else {
        // Show modal to let user choose
        setAttomResults(results);
        setIsAttomModalOpen(true);
        setAttomFetchStatus("Multiple records found - please select one.");
        setPublicRecordStatus('idle'); // Reset to idle so user can select from modal
      }
    } catch (err) {
      console.error("[handleAutoFillFromPublicRecords] Error:", err);
      setPublicRecordStatus('error');
      setAutoFillLoading(false);
      if (!isAutoTrigger) {
        toast.error("An error occurred while fetching public record data.");
      }
    }
  };

  const applyAttomData = (record: any) => {
    // Mark that we're applying ATTOM data to prevent re-triggering fetch
    isApplyingAttomDataRef.current = true;
    
    setAttomId(record.attom_id ?? null);
    
    const oldZip = formData.zip_code;
    const newZip = record.zip;
    
    // OVERWRITE address fields with normalized ATTOM values
    // This corrects user typos in city/state/zip
    if (record.address) {
      setFormData(prev => ({ ...prev, address: record.address }));
    }
    
    if (record.state) {
      const attomState = record.state.trim();
      setSelectedState(attomState);
      setFormData(prev => ({ ...prev, state: attomState }));
    }
    
    // Handle city from ATTOM record - OVERWRITE with normalized value
    if (record.city) {
      const attomCity = record.city.trim();
      const attomCityLower = attomCity.toLowerCase();
      
      // Check if this is a Boston neighborhood (case-insensitive)
      const matchedBoston = bostonNeighborhoods.find(
        n => n.toLowerCase() === attomCityLower
      );
      
      if (matchedBoston) {
        // This is actually a Boston neighborhood, not a city
        setCityChoice("Boston");
        setCustomCity("");
        setFormData(prev => ({ 
          ...prev, 
          city: "Boston",
          neighborhood: matchedBoston
        }));
      } else {
        // Try to match city in available options
        const normalizedCity = validateAndNormalizeCity(
          attomCity,
          record.state || formData.state,
          selectedCounty !== 'all' ? selectedCounty : undefined
        );
        
        if (normalizedCity) {
          // Found a matching city - overwrite with normalized version
          setCityChoice(normalizedCity);
          setFormData(prev => ({ ...prev, city: normalizedCity }));
        } else {
          // No match found - use ATTOM city name directly
          setCityChoice(attomCity);
          setFormData(prev => ({ ...prev, city: attomCity }));
        }
      }
    }
    
    // Overwrite ZIP code with ATTOM value
    if (newZip) {
      setFormData(prev => ({ ...prev, zip_code: newZip }));
    }
    
    // Fill in property details
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

    // Update property type if it's condo/co-op and clear lot_size (not applicable for condos)
    if (record.property_type && (
      record.property_type.toLowerCase().includes('condo') ||
      record.property_type.toLowerCase().includes('co-op')
    )) {
      setFormData(prev => ({ ...prev, property_type: 'condo', lot_size: '' }));
    }
    
    // Set address verification status
    setAddressVerified(true);
    setVerificationMessage("Address verified via public records.");
    
    // Mark that ATTOM address has been confirmed
    setHasConfirmedAttomAddress(true);
    
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
    
    // Reset the flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isApplyingAttomDataRef.current = false;
    }, 100);
  };

  const handleImportAttomRecord = (record: any) => {
    applyAttomData(record);
    setIsAttomModalOpen(false);
    setPublicRecordStatus('success');
    setAttomFetchStatus("Public record data loaded successfully.");
    setHasAutoFetched(true);
    toast.success("Property data imported from public records!");
  };

  const handleConfirmAttomAddress = () => {
    if (attomPendingRecord) {
      applyAttomData(attomPendingRecord);
      setPublicRecordStatus('success');
      setAttomFetchStatus("Public record data loaded successfully.");
      toast.success("Property data loaded from public records!");
      setHasAutoFetched(true);
      setHasConfirmedAttomAddress(true);
    }
    setIsAddressConfirmOpen(false);
    setAttomPendingRecord(null);
  };

  const handleRejectAttomAddress = () => {
    if (attomPendingRecord) {
      const rejectedKey = buildAttomAddressString(attomPendingRecord);
      setAttomRejectedForAddress(rejectedKey);
    }
    setIsAddressConfirmOpen(false);
    setAttomPendingRecord(null);
    setPublicRecordStatus('idle');
    setAttomFetchStatus("");
    setHasAutoFetched(true);
    toast.info("Address not confirmed. You can enter details manually.");
  };

  // Auto-fetch when all location fields are filled - ONLY for new listings
  useEffect(() => {
    // Skip during initial data load to prevent ATTOM from triggering on loaded data
    if (isInitialLoad) {
      console.log("[AddListing] ATTOM auto-fetch skipped: initial load in progress");
      return;
    }
    
    // Skip if in edit mode (listingId present) or address already confirmed
    if (listingId || hasConfirmedAttomAddress) {
      console.log("[AddListing] ATTOM auto-fetch skipped: edit mode or address already confirmed");
      return;
    }
    
    // For MA, require county selection; for other states, county is optional
    const countyOk = formData.state === "MA" 
      ? (selectedCounty !== "" && selectedCounty !== "all")
      : true;
    
    const hasAllLocationData = 
      formData.address.trim() !== "" &&
      formData.state.trim() !== "" &&
      countyOk &&
      formData.city.trim() !== "" &&
      formData.zip_code.trim() !== "";
    
    console.log("[AddListing] ATTOM auto-fetch check:", {
      hasAllLocationData,
      hasAutoFetched,
      autoFillLoading,
      isAddressConfirmOpen,
      isApplyingAttom: isApplyingAttomDataRef.current,
      isInitialLoad,
      listingId,
      hasConfirmedAttomAddress,
      address: formData.address,
      state: formData.state,
      county: selectedCounty,
      city: formData.city,
      zip: formData.zip_code,
      countyOk
    });

    // Guard: Don't trigger if modal is already open or we're applying ATTOM data
    if (hasAllLocationData && !hasAutoFetched && !autoFillLoading && !isAddressConfirmOpen && !isApplyingAttomDataRef.current) {
      console.log("[AddListing] All location fields filled, triggering auto-fetch");
      handleAutoFillFromPublicRecords(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.address, formData.state, selectedCounty, formData.city, formData.zip_code, hasAutoFetched, autoFillLoading, isAddressConfirmOpen, isInitialLoad, listingId, hasConfirmedAttomAddress]);
  
  // Manual ATTOM lookup trigger
  const handleManualAttomLookup = () => {
    if (!formData.address || !formData.city || !formData.state) {
      toast.error("Please enter address, city, and state first.");
      return;
    }
    // Reset flags to allow a fresh lookup
    setHasAutoFetched(false);
    setAttomRejectedForAddress("");
    handleAutoFillFromPublicRecords(false);
  };

  // Reset auto-fetch flag when address changes significantly
  const prevAddressRef = useRef({ address: "", city: "", zip: "" });
  
  useEffect(() => {
    const currentAddress = formData.address;
    const currentCity = formData.city;
    const currentZip = formData.zip_code;
    
    // Only reset if values actually changed (not just set to same value)
    const addressChanged = prevAddressRef.current.address !== currentAddress && prevAddressRef.current.address !== "";
    const cityChanged = prevAddressRef.current.city !== currentCity && prevAddressRef.current.city !== "";
    const zipChanged = prevAddressRef.current.zip !== currentZip && prevAddressRef.current.zip !== "";
    
    // Only reset if the change was NOT from applying ATTOM data
    if ((addressChanged || cityChanged || zipChanged) && hasAutoFetched && !isApplyingAttomDataRef.current) {
      console.log("[AddListing] Address changed by user, resetting auto-fetch flag");
      setHasAutoFetched(false);
      setAttomFetchStatus("");
      setAttomNeighborhoods([]);
      setAttomRejectedForAddress(""); // Reset rejection flag for new address
    }
    
    // Update refs
    prevAddressRef.current = { address: currentAddress, city: currentCity, zip: currentZip };
  }, [formData.address, formData.city, formData.zip_code, hasAutoFetched]);

  const handleStatusChange = (value: string) => {
    // Ensure status is never empty - default to original or 'new'
    const newStatus = value || originalStatusRef.current || 'new';
    setFormData(prev => ({ ...prev, status: newStatus }));
    if (newStatus === "coming_soon") {
      setFormData(prev => ({ ...prev, auto_activate_on: null }));
    } else if (newStatus === "new" || newStatus === "active") {
      setFormData(prev => ({ ...prev, go_live_date: "" }));
    }
  };
  
  // Clear lot_size when property type changes to condo/apartment (not applicable)
  useEffect(() => {
    if (formData.property_type === 'condo' || formData.property_type === 'apartment') {
      setFormData(prev => ({ ...prev, lot_size: '' }));
    }
  }, [formData.property_type]);

  const handleFileSelect = async (files: FileList | null, type: 'photos' | 'floorplans' | 'documents') => {
    if (!files) return;
    
    // For photos, upload directly with spinner
    if (type === 'photos') {
      let targetListingId = listingId || draftId;
      
      // If new listing, ensure draft exists first using helper
      if (!targetListingId) {
        targetListingId = await ensureDraftListing();
        if (!targetListingId) {
          toast.error('Please wait - unable to create draft listing');
          return;
        }
        toast.success('Draft listing created');
      }
      
      // Set uploading state
      setIsUploadingPhotos(true);
      
      try {
        // Upload photos to storage
        const uploadedPhotos: { url: string; order: number }[] = [];
        
        // Get existing photos count for proper ordering
        const existingCount = photos.length;
        let uploadErrors = 0;
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const filePath = `${targetListingId}/${Date.now()}_${file.name}`;
          
          try {
            const { error: uploadError } = await supabase.storage
              .from('listing-photos')
              .upload(filePath, file);
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage
              .from('listing-photos')
              .getPublicUrl(filePath);
            
            uploadedPhotos.push({ url: publicUrl, order: existingCount + i });
          } catch (error) {
            console.error('[AddListing] Error uploading photo:', {
              listingId: targetListingId,
              fileName: file.name,
              error
            });
            uploadErrors++;
          }
        }
        
        // Save photos to database (merge with existing)
        if (uploadedPhotos.length > 0) {
          try {
            // Get existing photos first
            const { data: existingData } = await supabase
              .from('listings')
              .select('photos')
              .eq('id', targetListingId)
              .single();
            
            const existingPhotos = (existingData?.photos as any[]) || [];
            const mergedPhotos = [...existingPhotos, ...uploadedPhotos];
            
            const { error } = await supabase
              .from('listings')
              .update({ photos: mergedPhotos })
              .eq('id', targetListingId);
            
            if (error) {
              console.error('[AddListing] Error saving photos to database:', {
                listingId: targetListingId,
                photoCount: uploadedPhotos.length,
                error
              });
              throw error;
            }
            
            // Update local photo state with the merged photos
            const newLocalPhotos: FileWithPreview[] = mergedPhotos.map((photo: any, index: number) => ({
              file: new File([], ''),
              preview: typeof photo === 'string' ? photo : photo.url,
              id: `existing-${index}`,
              uploaded: true,
              url: typeof photo === 'string' ? photo : photo.url
            }));
            setPhotos(newLocalPhotos);
            
            if (uploadErrors > 0) {
              toast.warning(`${uploadedPhotos.length} photo(s) uploaded, ${uploadErrors} failed`);
            } else {
              toast.success(`${uploadedPhotos.length} photo(s) uploaded`);
            }
          } catch (error) {
            console.error('[AddListing] Error saving photos:', error);
            toast.error('Photo upload failed, please try again');
          }
        } else if (uploadErrors > 0) {
          toast.error('Photo upload failed, please try again');
        }
      } finally {
        setIsUploadingPhotos(false);
      }
      return;
    }
    
    // For floor plans and documents, keep existing behavior
    const fileArray = Array.from(files);
    const newFiles: FileWithPreview[] = fileArray.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      id: Math.random().toString(36).substr(2, 9),
    }));

    if (type === 'floorplans') {
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

  // Helper to ensure a draft listing exists before any save/upload operation
  const ensureDraftListing = async (): Promise<string | null> => {
    if (draftId) return draftId;
    
    if (!user) {
      console.error('ensureDraftListing: Cannot create draft - no user logged in');
      return null;
    }
    
    const minimalPayload = {
      agent_id: user.id,
      status: 'draft',
      address: formData.address || 'Draft',
      city: formData.city || 'TBD',
      state: formData.state || 'MA',
      zip_code: formData.zip_code || '00000',
      price: formData.price ? parseFloat(formData.price) : 0
    };
    
    console.log('ensureDraftListing: Creating initial draft with payload:', minimalPayload);
    
    const { data, error } = await supabase
      .from('listings')
      .insert(minimalPayload)
      .select()
      .single();
      
    if (error) {
      console.error('ensureDraftListing: Error creating initial draft:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        payload: minimalPayload
      });
      return null;
    }
    
    console.log('ensureDraftListing: Draft created successfully with id:', data.id);
    setDraftId(data.id);
    return data.id;
  };

  // Centralized helper to build listing payload from form data
  const buildListingDataFromForm = (
    uploadedMedia: { photos: any[]; floorPlans: any[]; documents: any[] },
    overrideStatus?: string
  ) => ({
    // Agent
    agent_id: user?.id,
    
    // Status & Type
    status: overrideStatus || formData.status,
    listing_type: formData.listing_type,
    property_type: formData.property_type || null,
    
    // Location
    address: (formData.address || "Draft").trim(),
    city: formData.city?.trim() || "TBD",
    state: formData.state?.trim() || "MA",
    zip_code: formData.zip_code?.trim() || "00000",
    county: selectedCounty !== "all" ? selectedCounty : null,
    neighborhood: formData.neighborhood || null,
    latitude: formData.latitude,
    longitude: formData.longitude,
    
    // Property Details ("meat and potatoes")
    price: formData.price ? parseFloat(formData.price) : 0,
    bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
    bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
    square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
    // Set lot_size to null for condos/apartments (not applicable)
    lot_size: (formData.property_type === 'condo' || formData.property_type === 'apartment') 
      ? null 
      : (formData.lot_size ? parseFloat(formData.lot_size) : null),
    year_built: formData.year_built ? parseInt(formData.year_built) : null,
    description: formData.description || null,
    
    // Features & Amenities - write combined set to BOTH columns for backward compatibility
    property_features: propertyFeatures,
    amenities: propertyFeatures, // Same as property_features - unified storage
    area_amenities: areaAmenities.length > 0 ? areaAmenities : null,
    disclosures: disclosures,
    
    // Media
    photos: uploadedMedia.photos,
    floor_plans: uploadedMedia.floorPlans,
    documents: uploadedMedia.documents,
    
    // Commission & Showing
    commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
    commission_type: formData.commission_type || null,
    commission_notes: formData.commission_notes || null,
    showing_instructions: formData.showing_instructions || null,
    lockbox_code: formData.lockbox_code || null,
    appointment_required: formData.appointment_required,
    showing_contact_name: formData.showing_contact_name || null,
    showing_contact_phone: formData.showing_contact_phone || null,
    additional_notes: formData.additional_notes || null,
    
    // Taxes & Dates
    annual_property_tax: formData.annual_property_tax ? parseFloat(formData.annual_property_tax) : null,
    tax_year: formData.tax_year ? parseInt(formData.tax_year) : null,
    list_date: formData.list_date || null,
    expiration_date: formData.expiration_date || null,
    go_live_date: formData.go_live_date || null,
    
    // Additional Info
    unit_number: formData.unit_number || null,
    building_name: formData.building_name || null,
    disclosures_other: formData.disclosures_other || null,
    listing_exclusions: formData.listing_exclusions || null,
    property_website_url: formData.property_website_url || null,
    virtual_tour_url: formData.virtual_tour_url || null,
    video_url: formData.video_url || null,
    listing_agreement_types: formData.listing_agreement_type ? [formData.listing_agreement_type] : null,
    attom_id: attomId,
    
    // Disclosures (lead_paint is stored as string, not array)
    lead_paint: leadPaint.length > 0 ? leadPaint.join(', ') : null,
    handicap_accessible: handicapAccessible || null,
    
    // Rental-specific (conditionally added in handlers)
    ...(formData.listing_type === "for_rent" ? {
      rental_fee: formData.rental_fee ? parseFloat(formData.rental_fee) : null,
      deposit_requirements: depositRequirements,
      outdoor_space: outdoorSpace,
      storage_options: storageOptions,
      laundry_type: formData.laundry_type || null,
      pets_comment: formData.pets_comment || null,
      pet_options: petOptions,
    } : {}),
  });

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

      // Upload files (preserves existing, uploads new)
      let uploaded = { photos: [] as any[], floorPlans: [] as any[], documents: [] as any[] };
      
      if (photos.length > 0 || floorPlans.length > 0 || documents.length > 0) {
        console.log('Uploading files for draft save:', { 
          photos: photos.length, 
          floorPlans: floorPlans.length, 
          documents: documents.length 
        });
        
        try {
          uploaded = await uploadFiles();
          console.log('Files uploaded successfully:', uploaded);
        } catch (uploadError: any) {
          console.error('Error uploading files during draft save:', uploadError);
          if (!isAutoSave) {
            toast.error(`Failed to upload files: ${uploadError.message}`);
          }
        }
      }

      // Use centralized helper to build payload
      const payload = buildListingDataFromForm(uploaded, "draft");

      console.log('Saving draft with payload:', { ...payload, photos: payload.photos?.length || 0 });

      // Remove agent_id from update payload (it's immutable after creation)
      const { agent_id, ...updatePayload } = payload;
      
      if (draftId) {
        const { error } = await supabase
          .from("listings")
          .update(updatePayload)
          .eq("id", draftId);
        if (error) {
          console.error('Error updating draft listing:', error);
          throw error;
        }
        console.log('Draft updated successfully, id:', draftId);
      } else {
        // Let the database generate listing_number using its default/sequence
        const { data, error } = await supabase
          .from("listings")
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error('Error inserting draft listing:', error);
          throw error;
        }

        if (data) {
          console.log('Draft created successfully, id:', data.id);
          setDraftId(data.id);
        }
      }


      // Mark all items as uploaded to prevent re-uploading on next save
      // (Don't clear arrays - this preserves data for continued editing)

      setHasUnsavedChanges(false);
      setLastAutoSave(new Date());
      
      if (!isAutoSave) {
        toast.success("Draft saved successfully!");
        navigate("/agent-dashboard", { state: { reload: true } });
      }
    } catch (error: any) {
      console.error("Error saving draft listing:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        draftId: draftId,
        userId: user?.id,
        payloadSummary: {
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          price: formData.price
        }
      });
      console.error("Full error object:", JSON.stringify(error, null, 2));
      if (!isAutoSave) {
        toast.error(`Failed to save draft: ${error.message || 'Unknown error'}`);
      }
      // Return early on error - don't update state or show success
      return;
    } finally {
      if (isAutoSave) {
        setAutoSaving(false);
      } else {
        setSubmitting(false);
      }
    }
  };

  // Helper to save form data and navigate to manage photos
  const handleNavigateToManagePhotos = async () => {
    let targetId = listingId || draftId;
    
    // Ensure draft exists
    if (!targetId) {
      targetId = await ensureDraftListing();
      if (!targetId) {
        toast.error('Unable to create draft listing');
        return;
      }
    }
    
    // Save current form data silently before navigating (don't overwrite media - photos page handles it)
    try {
      // Get current media from state to preserve it
      const currentPhotos = photos.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, name: p.file?.name || '' }));
      const currentFloorPlans = floorPlans.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, name: p.file?.name || '' }));
      const currentDocuments = documents.filter(d => d.uploaded && d.url).map(d => ({ url: d.url, name: d.file?.name || '' }));
      
      const payload = buildListingDataFromForm(
        { photos: currentPhotos, floorPlans: currentFloorPlans, documents: currentDocuments }
      );
      
      // Remove agent_id from update (it's immutable)
      const { agent_id, ...updatePayload } = payload;
      
      await supabase
        .from('listings')
        .update(updatePayload)
        .eq('id', targetId);
        
      console.log('[AddListing] Form data saved before navigating to photos');
    } catch (err) {
      console.error('[AddListing] Error saving before photo navigation:', err);
      // Continue anyway - photos page can still work
    }
    
    navigate(`/agent/listings/${targetId}/photos`);
  };

  // Helper to save form data and navigate to manage floor plans
  const handleNavigateToManageFloorPlans = async () => {
    let targetId = listingId || draftId;
    
    // Ensure draft exists
    if (!targetId) {
      targetId = await ensureDraftListing();
      if (!targetId) {
        toast.error('Unable to create draft listing');
        return;
      }
    }
    
    // Save current form data silently before navigating
    try {
      const currentPhotos = photos.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, name: p.file?.name || '' }));
      const currentFloorPlans = floorPlans.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, name: p.file?.name || '' }));
      const currentDocuments = documents.filter(d => d.uploaded && d.url).map(d => ({ url: d.url, name: d.file?.name || '' }));
      
      const payload = buildListingDataFromForm(
        { photos: currentPhotos, floorPlans: currentFloorPlans, documents: currentDocuments }
      );
      
      const { agent_id, ...updatePayload } = payload;
      
      await supabase
        .from('listings')
        .update(updatePayload)
        .eq('id', targetId);
        
      console.log('[AddListing] Form data saved before navigating to floor plans');
    } catch (err) {
      console.error('[AddListing] Error saving before floor plan navigation:', err);
    }
    
    navigate(`/agent/listings/${targetId}/floor-plans`);
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
      // Exclude lot_size for condos/apartments (not applicable)
      const isCondoOrApartment = formData.property_type === 'condo' || formData.property_type === 'apartment';
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
        // Skip lot_size validation for condos/apartments
        lot_size: isCondoOrApartment ? undefined : (formData.lot_size ? parseFloat(formData.lot_size) : undefined),
        description: formData.description || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };

      // Validate data with Zod
      const validatedData = listingSchema.parse(dataToValidate);

      // Upload files first
      toast.info("Uploading files...");
      const uploadedFiles = await uploadFiles();

      // Use centralized helper to build payload (same as handleSaveDraft for consistency)
      const listingData = buildListingDataFromForm(
        { photos: uploadedFiles.photos, floorPlans: uploadedFiles.floorPlans, documents: uploadedFiles.documents },
        publishNow ? formData.status : "draft"
      );
      
      // Override with validated data for consistency
      listingData.address = validatedData.address;
      listingData.city = validatedData.city;
      listingData.state = validatedData.state;
      listingData.zip_code = validatedData.zip_code;
      listingData.price = validatedData.price;
      listingData.bedrooms = validatedData.bedrooms || null;
      listingData.bathrooms = validatedData.bathrooms || null;
      listingData.square_feet = validatedData.square_feet || null;
      listingData.lot_size = validatedData.lot_size || null;
      listingData.year_built = validatedData.year_built || null;
      listingData.description = validatedData.description || null;
      
      // Add auto-activation fields
      (listingData as any).auto_activate_days = computedAutoActivateDays;
      (listingData as any).auto_activate_on = computedAutoActivateOn;

      // Add multi-family fields if applicable
      if (formData.property_type === "multi_family") {
        if (formData.num_units) (listingData as any).num_units = parseFloat(formData.num_units);
        if (formData.gross_income) (listingData as any).gross_income = parseFloat(formData.gross_income);
        if (formData.operating_expenses) (listingData as any).operating_expenses = parseFloat(formData.operating_expenses);
      }

      // Determine if we're in edit mode
      const isEditMode = !!listingId;
      const targetListingId = listingId || draftId;

      let resultListingId: string | null = null;

      if (isEditMode && targetListingId) {
        // UPDATE existing listing
        console.log("[AddListing] Updating existing listing:", targetListingId);
        
        const { error } = await supabase
          .from("listings")
          .update(listingData)
          .eq("id", targetListingId);

        if (error) throw error;
        resultListingId = targetListingId;

        // Track price changes
        const newPrice = validatedData.price;
        if (originalPriceRef.current !== null && originalPriceRef.current !== newPrice) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            await supabase.from("listing_price_history").insert({
              listing_id: targetListingId,
              old_price: originalPriceRef.current,
              new_price: newPrice,
              changed_by: userData?.user?.id ?? null,
              note: "Price updated",
            });
            console.log("[AddListing] Price change logged:", originalPriceRef.current, "->", newPrice);
          } catch (priceHistoryError) {
            console.error("[AddListing] Error logging price history:", priceHistoryError);
          }
        }

        // Track status changes
        const newStatus = formData.status;
        if (originalStatusRef.current !== null && originalStatusRef.current !== newStatus) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            await supabase.from("listing_status_history").insert({
              listing_id: targetListingId,
              old_status: originalStatusRef.current,
              new_status: newStatus,
              changed_by: userData?.user?.id ?? null,
              notes: "Status updated via edit form",
            });
            console.log("[AddListing] Status change logged:", originalStatusRef.current, "->", newStatus);
          } catch (statusHistoryError) {
            console.error("[AddListing] Error logging status history:", statusHistoryError);
          }
        }

        toast.success("Listing updated successfully!");
      } else {
        // INSERT new listing
        console.log("[AddListing] Creating new listing");
        
        const { data: insertedListing, error } = await supabase
          .from("listings")
          .insert(listingData)
          .select('id')
          .single();

        if (error) throw error;
        resultListingId = insertedListing?.id ?? null;

        // Log price history for new listing
        if (resultListingId) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            const currentUserId = userData?.user?.id ?? null;

            await supabase.from("listing_price_history").insert({
              listing_id: resultListingId,
              old_price: null,
              new_price: validatedData.price,
              changed_by: currentUserId,
              note: "Initial listing price",
            });

            // Log status history
            await supabase.from("listing_status_history").insert({
              listing_id: resultListingId,
              old_status: null,
              new_status: formData.status,
              changed_by: currentUserId,
              notes: "Listing created",
            });
          } catch (historyError) {
            console.error("[AddListing] Error logging initial history:", historyError);
          }

          // Auto-fetch ATTOM data
          try {
            console.log("[AddListing] Triggering auto-fetch-property-data for listing:", resultListingId);
            await supabase.functions.invoke('auto-fetch-property-data', {
              body: { listing_id: resultListingId }
            });
          } catch (fetchError) {
            console.error("[AddListing] Error fetching ATTOM data:", fetchError);
          }
        }

        toast.success("Listing created successfully!");
      }

      // Navigate to My Listings in edit mode, dashboard for new listings
      if (isEditMode) {
        navigate("/agent/listings");
      } else {
        navigate("/agent-dashboard", { state: { reload: true } });
      }
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

  if (loading || isLoadingListing) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">
          {isLoadingListing ? 'Loading listing data...' : 'Checking authentication...'}
        </p>
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
            {/* Navigation buttons */}
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="outline" 
                onClick={() => navigate("/agent/listings")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to My Listings
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/agent-dashboard")}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Success Hub
              </Button>
            </div>
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
                    <Select 
                      value={formData.status} 
                      onValueChange={handleStatusChange}
                      disabled={formData.status === 'cancelled' || formData.status === 'sold'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!listingId ? (
                          // CREATE MODE: Only New and Coming Soon
                          <>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="coming_soon">Coming Soon</SelectItem>
                          </>
                        ) : (
                          // EDIT MODE: All status options
                          <>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="coming_soon">Coming Soon</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="withdrawn">Withdrawn</SelectItem>
                            <SelectItem value="temporarily_withdrawn">Temporarily Withdrawn</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="sold">Sold</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {/* Warning for final status states */}
                    {(formData.status === 'cancelled' || formData.status === 'sold') && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        This is a final state. Status and price cannot be changed.
                      </p>
                    )}
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
                        {formData.listing_type === "for_rent" ? (
                          <>
                            <SelectItem value="apartment">Apartment</SelectItem>
                            <SelectItem value="condo">Condo</SelectItem>
                            <SelectItem value="single_family">Single Family</SelectItem>
                            <SelectItem value="multi_family">Multi-Family</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="single_family">Single Family</SelectItem>
                            <SelectItem value="condo">Condo</SelectItem>
                            <SelectItem value="multi_family">Multi-Family</SelectItem>
                          </>
                        )}
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

                {/* List Date & Expiration Date Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="list_date">List Date (On MLS)</Label>
                    <Input
                      id="list_date"
                      type="date"
                      value={formData.list_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, list_date: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      The date this listing was/will be added to the MLS.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration_date">Expiration Date</Label>
                    <Input
                      id="expiration_date"
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiration_date: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Listing will automatically change to "Expired" status on this date.
                    </p>
                  </div>
                </div>

                {/* Address Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Property Location</Label>
                    {/* Manual ATTOM lookup button - always available */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleManualAttomLookup}
                      disabled={autoFillLoading || !formData.address || !formData.city || !formData.state}
                      className="gap-2"
                    >
                      {autoFillLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Looking up...
                        </>
                      ) : (
                        <>
                          <Cloud className="h-4 w-4" />
                          {hasConfirmedAttomAddress ? "Re-verify with ATTOM" : "Verify with ATTOM"}
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Public Record Status - subtle feedback only on success */}
                  {publicRecordStatus === 'success' && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Public record data loaded successfully.</span>
                    </div>
                  )}
                  
                  {/* Street Address + Unit # */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className={cn("space-y-2", (formData.property_type === 'condo' || formData.property_type === 'apartment') ? "sm:col-span-2" : "sm:col-span-3")}>
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

                    {(formData.property_type === 'condo' || formData.property_type === 'apartment') && (
                      <div className="space-y-2">
                        <Label htmlFor="unit_number">Unit #</Label>
                        <Input
                          id="unit_number"
                          type="text"
                          value={formData.unit_number}
                          onChange={(e) => setFormData(prev => ({ ...prev, unit_number: e.target.value }))}
                          placeholder="3B"
                        />
                      </div>
                    )}
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
                              {availableCities.map((cityOption) => (
                                <CommandItem
                                  key={cityOption.name}
                                  value={cityOption.name}
                                  onSelect={(currentValue) => {
                                    setCityChoice(currentValue === cityChoice ? "" : currentValue);
                                    setFormData(prev => ({ ...prev, city: currentValue }));
                                    setOpenCityCombo(false);
                                  }}
                                >
                                  {cityOption.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    
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
                        <p className="text-sm text-muted-foreground">
                          Select a ZIP code below (even if there is only one option):
                        </p>
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
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 p-2 bg-primary/10 border border-primary/20 rounded text-sm text-primary">
                              <span>Selected: {formData.zip_code}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setFormData(prev => ({ ...prev, zip_code: "" }))}
                                className="h-6 w-6 p-0 hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <Input
                              type="text"
                              placeholder="Or type ZIP code manually"
                              value={formData.zip_code}
                              onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                              className="text-sm"
                            />
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

                  {/* Neighborhood/Area - Enabled for all states with data */}
                  {(() => {
                    const neighborhoods = getNeighborhoodsForLocation({
                      city: formData.city,
                      state: formData.state,
                      county: selectedCounty !== 'all' ? selectedCounty : undefined
                    });
                    
                    return neighborhoods.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="neighborhood">Neighborhood/Area</Label>
                        <Select
                          value={formData.neighborhood}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, neighborhood: value }))}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select neighborhood..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50 max-h-[300px]">
                            {neighborhoods.map((neighborhood) => (
                              <SelectItem key={neighborhood} value={neighborhood}>
                                {neighborhood}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      );
                  })()}

                  {/* Building / Complex Name - hidden for single-family */}
                  {formData.property_type !== 'single_family' && (
                    <div className="space-y-2">
                      <Label htmlFor="building_name">Building / Complex Name</Label>
                      <Input
                        id="building_name"
                        type="text"
                        value={formData.building_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, building_name: e.target.value }))}
                        placeholder="e.g. Harborview Towers"
                      />
                    </div>
                  )}
                </div>

                {/* Price Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-lg font-semibold">{formData.listing_type === "for_rent" ? "Pricing & Deposits" : "Pricing"}</Label>
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
                        disabled={formData.status === 'cancelled' || formData.status === 'sold'}
                      />
                      {(formData.status === 'cancelled' || formData.status === 'sold') && (
                        <p className="text-xs text-muted-foreground">
                          Price cannot be changed for {formData.status} listings.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Monthly Rent + Rental Fee */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          <Label htmlFor="rental_fee">Rental Fee (Commission)</Label>
                          <FormattedInput
                            id="rental_fee"
                            format="currency"
                            placeholder="e.g. 2500"
                            value={formData.rental_fee}
                            onChange={(value) => setFormData(prev => ({ ...prev, rental_fee: value }))}
                            decimals={0}
                          />
                          <p className="text-xs text-muted-foreground">Flat dollar amount</p>
                        </div>
                      </div>

                      {/* Deposit Requirements (multi-select) - Only for rentals */}
                      {formData.listing_type === "for_rent" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Deposit Requirements</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                              { key: 'first_month', label: 'First Month' },
                              { key: 'last_month', label: 'Last Month' },
                              { key: 'security_deposit', label: 'Security Deposit' },
                              { key: 'key_deposit', label: 'Key Deposit' },
                              { key: 'move_in_out_fee', label: 'Move-in / Move-out Fee' },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={depositRequirements.includes(key)}
                                  onCheckedChange={(isChecked) => {
                                    if (isChecked === true) {
                                      setDepositRequirements(prev => Array.from(new Set([...prev, key])));
                                    } else {
                                      setDepositRequirements(prev => prev.filter((v) => v !== key));
                                    }
                                  }}
                                />
                                <Label className="text-sm font-normal cursor-pointer">{label}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Commission & Compensation - For Sale only */}
                {formData.listing_type === "for_sale" && (
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
                          {formData.commission_type === 'percentage' ? 'Rate (%)' : 'Flat Amount ($)'}
                        </Label>
                        <Input
                          id="commission_rate"
                          name="buyer_agent_commission_rate"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max={formData.commission_type === 'percentage' ? "100" : undefined}
                          placeholder={formData.commission_type === 'percentage' ? '2.5' : '5000'}
                          value={formData.commission_rate}
                          onChange={(e) => setFormData(prev => ({ ...prev, commission_rate: e.target.value }))}
                          autoComplete="off"
                          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                )}

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

                {/* Multi-Family FOR SALE Fields */}
                {formData.listing_type === "for_sale" && formData.property_type === "multi_family" && (
                  <div className="space-y-6 border-t pt-6">
                    <Label className="text-xl font-semibold">Multi-Family Building Details</Label>
                    
                    {/* Number of Units */}
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="num_units">Number of Units *</Label>
                      <Input
                        id="num_units"
                        type="number"
                        min="2"
                        value={formData.num_units}
                        onChange={(e) => setFormData(prev => ({ ...prev, num_units: e.target.value }))}
                        placeholder="e.g. 3"
                        required
                      />
                    </div>

                    {/* Building Totals */}
                    <div className="space-y-4">
                      <Label className="text-lg font-medium">Building Totals</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="total_rooms">Total Rooms</Label>
                          <Input
                            id="total_rooms"
                            type="number"
                            min="0"
                            value={formData.total_rooms}
                            onChange={(e) => setFormData(prev => ({ ...prev, total_rooms: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="total_bedrooms">Total Bedrooms</Label>
                          <Input
                            id="total_bedrooms"
                            type="number"
                            min="0"
                            value={formData.total_bedrooms}
                            onChange={(e) => setFormData(prev => ({ ...prev, total_bedrooms: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="total_full_baths">Total Full Baths</Label>
                          <Input
                            id="total_full_baths"
                            type="number"
                            min="0"
                            value={formData.total_full_baths}
                            onChange={(e) => setFormData(prev => ({ ...prev, total_full_baths: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="total_half_baths">Total Half Baths</Label>
                          <Input
                            id="total_half_baths"
                            type="number"
                            min="0"
                            value={formData.total_half_baths}
                            onChange={(e) => setFormData(prev => ({ ...prev, total_half_baths: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="total_fireplaces">Total Fireplaces</Label>
                          <Input
                            id="total_fireplaces"
                            type="number"
                            min="0"
                            value={formData.total_fireplaces}
                            onChange={(e) => setFormData(prev => ({ ...prev, total_fireplaces: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="total_monthly_rent">Total Monthly Rent</Label>
                          <FormattedInput
                            id="total_monthly_rent"
                            format="currency"
                            value={formData.total_monthly_rent}
                            onChange={(value) => setFormData(prev => ({ ...prev, total_monthly_rent: value }))}
                            decimals={0}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Laundry */}
                    <div className="space-y-4">
                      <Label className="text-lg font-medium">Laundry</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'coin_op', label: 'Coin-Op Laundry' },
                          { key: 'wd_in_unit', label: 'Washer/Dryer in Unit' },
                          { key: 'wd_in_building', label: 'Washer/Dryer in Building' },
                          { key: 'hookups', label: 'Hook-ups' },
                          { key: 'none', label: 'None' },
                        ].map(({ key, label }) => {
                          const checked = multiFamilyLaundry.includes(key);

                          return (
                            <div key={key} className="flex items-center space-x-2">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  const next =
                                    isChecked === true
                                      ? Array.from(new Set([...multiFamilyLaundry, key]))
                                      : multiFamilyLaundry.filter(v => v !== key);
                                  setMultiFamilyLaundry(next);
                                }}
                              />
                              <span className="text-sm">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Unit Mix */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-lg font-medium">Unit Mix</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setUnits(prev => [...prev, {
                            unit_number: '',
                            bedrooms: 0,
                            full_baths: 0,
                            half_baths: 0,
                            rent: 0
                          }])}
                        >
                          Add Unit
                        </Button>
                      </div>
                      
                      {units.length === 0 && (
                        <p className="text-sm text-muted-foreground">No units added yet. Click "Add Unit" to begin.</p>
                      )}

                      <div className="space-y-3">
                        {units.map((unit, index) => (
                          <Card key={index} className="p-4">
                            <div className="grid grid-cols-5 gap-3 items-end">
                              <div className="space-y-2">
                                <Label htmlFor={`unit_${index}_number`}>Unit #</Label>
                                <Input
                                  id={`unit_${index}_number`}
                                  placeholder="1A"
                                  value={unit.unit_number}
                                  onChange={(e) => {
                                    const newUnits = [...units];
                                    newUnits[index].unit_number = e.target.value;
                                    setUnits(newUnits);
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`unit_${index}_bedrooms`}>Beds</Label>
                                <Input
                                  id={`unit_${index}_bedrooms`}
                                  type="number"
                                  min="0"
                                  value={unit.bedrooms}
                                  onChange={(e) => {
                                    const newUnits = [...units];
                                    newUnits[index].bedrooms = parseInt(e.target.value) || 0;
                                    setUnits(newUnits);
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`unit_${index}_full_baths`}>Full Baths</Label>
                                <Input
                                  id={`unit_${index}_full_baths`}
                                  type="number"
                                  min="0"
                                  value={unit.full_baths}
                                  onChange={(e) => {
                                    const newUnits = [...units];
                                    newUnits[index].full_baths = parseInt(e.target.value) || 0;
                                    setUnits(newUnits);
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`unit_${index}_half_baths`}>Half Baths</Label>
                                <Input
                                  id={`unit_${index}_half_baths`}
                                  type="number"
                                  min="0"
                                  value={unit.half_baths}
                                  onChange={(e) => {
                                    const newUnits = [...units];
                                    newUnits[index].half_baths = parseInt(e.target.value) || 0;
                                    setUnits(newUnits);
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`unit_${index}_rent`}>Rent/Mo</Label>
                                <div className="flex gap-2">
                                  <FormattedInput
                                    id={`unit_${index}_rent`}
                                    format="currency"
                                    value={unit.rent.toString()}
                                    onChange={(value) => {
                                      const newUnits = [...units];
                                      newUnits[index].rent = parseFloat(value) || 0;
                                      setUnits(newUnits);
                                    }}
                                    decimals={0}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setUnits(prev => prev.filter((_, i) => i !== index))}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rental Features & Details Section - Only for rentals */}
                {formData.listing_type === "for_rent" && (
                  <div className="space-y-4 border-t pt-6">
                    <Label className="text-lg font-semibold">Rental Features & Details</Label>

                    {/* Private Outdoor Space (multi-select) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Private outdoor space</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'deck', label: 'Deck' },
                          { key: 'balcony', label: 'Balcony' },
                          { key: 'roof_deck', label: 'Roof Deck' },
                          { key: 'yard', label: 'Yard' },
                          { key: 'patio', label: 'Patio' },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              checked={outdoorSpace.includes(key)}
                              onCheckedChange={(isChecked) => {
                                if (isChecked === true) {
                                  setOutdoorSpace(prev => Array.from(new Set([...prev, key])));
                                } else {
                                  setOutdoorSpace(prev => prev.filter((v) => v !== key));
                                }
                              }}
                            />
                            <Label className="text-sm font-normal cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Storage (multi-select checkboxes) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Storage</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'yes', label: 'Yes' },
                          { key: 'no', label: 'No' },
                          { key: 'private', label: 'Private' },
                          { key: 'common', label: 'Common' },
                          { key: 'available_for_rent', label: 'Available for rent' },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              checked={storageOptions.includes(key)}
                              onCheckedChange={(isChecked) => {
                                if (isChecked === true) {
                                  setStorageOptions(prev => Array.from(new Set([...prev, key])));
                                } else {
                                  setStorageOptions(prev => prev.filter((v) => v !== key));
                                }
                              }}
                            />
                            <Label className="text-sm font-normal cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Laundry options */}
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="laundry_type">Laundry</Label>
                      <Select
                        value={formData.laundry_type}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, laundry_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select laundry option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="in_unit">In Unit</SelectItem>
                          <SelectItem value="in_building">In Building</SelectItem>
                          <SelectItem value="hookups">Hook-ups</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Pets */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Pets</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'cats_ok', label: 'Cats OK' },
                          { key: 'dogs_ok', label: 'Dogs OK' },
                          { key: 'negotiable', label: 'Pets Negotiable' },
                          { key: 'no_pets', label: 'No Pets' },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              checked={petOptions.includes(key)}
                              onCheckedChange={(isChecked) => {
                                if (isChecked === true) {
                                  setPetOptions(prev => Array.from(new Set([...prev, key])));
                                } else {
                                  setPetOptions(prev => prev.filter((v) => v !== key));
                                }
                              }}
                            />
                            <Label className="text-sm font-normal cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <Label htmlFor="pets_comment">Pets - Notes / Restrictions</Label>
                        <Textarea
                          id="pets_comment"
                          rows={3}
                          placeholder="e.g. Cats OK, small dogs only, no aggressive breeds..."
                          value={formData.pets_comment}
                          onChange={(e) => setFormData(prev => ({ ...prev, pets_comment: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Rental Features (utility inclusions only) */}
                    <div className="space-y-2">
                      <Label className="text-base font-medium">Rental Features</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {["Heat Included", "Hot Water Included", "Electricity Included", "Internet Included", "No Smoking", "Short-Term Considered"].map((amenity) => (
                          <div key={amenity} className="flex items-center space-x-2">
                            <Checkbox
                              id={`rental-${amenity}`}
                              checked={rentalFeatures.includes(amenity)}
                              onCheckedChange={(isChecked) => {
                                if (isChecked === true) {
                                  setRentalFeatures(prev => Array.from(new Set([...prev, amenity])));
                                } else {
                                  setRentalFeatures(prev => prev.filter((a) => a !== amenity));
                                }
                              }}
                            />
                            <Label htmlFor={`rental-${amenity}`} className="font-normal cursor-pointer">
                              {amenity}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Property Features - Unified Section */}
                <div className="space-y-6 border-t pt-6">
                  <Label className="text-xl font-semibold">Property Features</Label>
                  
                  {/* Basic Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Basic Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        'Hardwood floors', 'Granite countertops', 'Stainless appliances',
                        'Updated kitchen', 'Updated bathrooms', 'Fireplace', 'Central air',
                        'Forced air heating', 'Basement', 'Finished basement', 'Attic',
                        'Garage', 'Carport', 'Energy efficient', 'Smart home features'
                      ].map((feature) => (
                        <div key={feature} className="flex items-center space-x-2">
                          <Checkbox
                            id={feature}
                            checked={propertyFeatures.includes(feature)}
                            onCheckedChange={(isChecked) => {
                              if (isChecked === true) {
                                setPropertyFeatures(prev => Array.from(new Set([...prev, feature])));
                              } else {
                                setPropertyFeatures(prev => prev.filter(f => f !== feature));
                              }
                            }}
                          />
                          <Label htmlFor={feature} className="font-normal cursor-pointer">
                            {feature}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interior Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Interior Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {["Air Conditioning", "Central Air", "Window AC", "Ceiling Fans", "Wood Stove", "High Ceilings", "Walk-In Closet", "Pantry", "Sunroom", "Bonus Room / Office", "Wet Bar", "Sauna", "Central Vacuum", "Skylights", "Home Office", "Mudroom", "In-Home Laundry", "Shared Laundry"].map((feature) => (
                        <div key={feature} className="flex items-center space-x-2">
                          <Checkbox
                            id={`interior-${feature}`}
                            checked={propertyFeatures.includes(feature)}
                            onCheckedChange={(isChecked) => {
                              if (isChecked === true) {
                                setPropertyFeatures(prev => Array.from(new Set([...prev, feature])));
                              } else {
                                setPropertyFeatures(prev => prev.filter((a) => a !== feature));
                              }
                            }}
                          />
                          <Label htmlFor={`interior-${feature}`} className="font-normal cursor-pointer">
                            {feature}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exterior Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Exterior Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {["Deck", "Patio", "Porch", "Balcony", "Fenced Yard", "Private Yard", "Garden Area", "Sprinkler System", "Outdoor Shower", "Pool", "Hot Tub", "Shed", "Gazebo", "Fire Pit", "Outdoor Kitchen", "Greenhouse", "Boat Dock (or Dock Rights)"].map((feature) => (
                        <div key={feature} className="flex items-center space-x-2">
                          <Checkbox
                            id={`exterior-${feature}`}
                            checked={propertyFeatures.includes(feature)}
                            onCheckedChange={(isChecked) => {
                              if (isChecked === true) {
                                setPropertyFeatures(prev => Array.from(new Set([...prev, feature])));
                              } else {
                                setPropertyFeatures(prev => prev.filter((a) => a !== feature));
                              }
                            }}
                          />
                          <Label htmlFor={`exterior-${feature}`} className="font-normal cursor-pointer">
                            {feature}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Community Features - Only for condo and multi_family */}
                  {(formData.property_type === "condo" || formData.property_type === "multi_family") && (
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Community Features</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {["Elevator", "Storage", "Roof Deck", "Fitness Center", "Clubhouse / Community Room", "Bike Storage", "Security System", "On-Site Management", "Concierge", "Dog Park", "Trash Removal", "Snow Removal", "Professional Landscaping", "EV Charging", "Package Room"].map((feature) => (
                          <div key={feature} className="flex items-center space-x-2">
                            <Checkbox
                              id={`community-${feature}`}
                              checked={propertyFeatures.includes(feature)}
                              onCheckedChange={(isChecked) => {
                                if (isChecked === true) {
                                  setPropertyFeatures(prev => Array.from(new Set([...prev, feature])));
                                } else {
                                  setPropertyFeatures(prev => prev.filter((a) => a !== feature));
                                }
                              }}
                            />
                            <Label htmlFor={`community-${feature}`} className="font-normal cursor-pointer">
                              {feature}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Location Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Location Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {["Public Transportation", "Walk/Jog Trails", "Public Park", "Playground", "Water View", "Waterfront", "Beach Access", "Marina", "Golf Course", "University Nearby", "Public School Nearby", "Private School Nearby", "Shopping Nearby", "Highway Access"].map((feature) => (
                        <div key={feature} className="flex items-center space-x-2">
                          <Checkbox
                            id={`location-${feature}`}
                            checked={propertyFeatures.includes(feature)}
                            onCheckedChange={(isChecked) => {
                              if (isChecked === true) {
                                setPropertyFeatures(prev => Array.from(new Set([...prev, feature])));
                              } else {
                                setPropertyFeatures(prev => prev.filter((a) => a !== feature));
                              }
                            }}
                          />
                          <Label htmlFor={`location-${feature}`} className="font-normal cursor-pointer">
                            {feature}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Other Features Text Field */}
                  <div className="space-y-2">
                    <Label htmlFor="other_features">Other Features (optional)</Label>
                    <Textarea
                      id="other_features"
                      placeholder="List any additional features not covered above..."
                      value={otherAmenities}
                      onChange={(e) => setOtherAmenities(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Multi-Family Features - Only show for multi_family */}
                  {formData.property_type === "multi_family" && (
                    <div className="space-y-3 border-t pt-6">
                      <Label className="text-base font-medium">Multi-Family Features</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {["Coin-Op Laundry", "Separate Utilities", "Owner's Unit", "Long-Term Tenant Opportunity", "Strong Rental History", "Lockable Storage Units", "Shared Yard", "Shared Patio/Deck"].map((feature) => (
                          <div key={feature} className="flex items-center space-x-2">
                            <Checkbox
                              id={`multifamily-${feature}`}
                              checked={propertyFeatures.includes(feature)}
                              onCheckedChange={(isChecked) => {
                                if (isChecked === true) {
                                  setPropertyFeatures(prev => Array.from(new Set([...prev, feature])));
                                } else {
                                  setPropertyFeatures(prev => prev.filter((a) => a !== feature));
                                }
                              }}
                            />
                            <Label htmlFor={`multifamily-${feature}`} className="font-normal cursor-pointer">
                              {feature}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Disclosures - Simplified */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Disclosures</Label>
                  
                  {/* Lead Paint (multi-select) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Lead Paint</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { key: 'yes', label: 'Yes' },
                        { key: 'no', label: 'No' },
                        { key: 'unknown', label: 'Unknown' },
                        { key: 'certified_lead_free', label: 'Certified lead free' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            checked={leadPaint.includes(key)}
                            onCheckedChange={(isChecked) => {
                              if (isChecked === true) {
                                setLeadPaint(prev => Array.from(new Set([...prev, key])));
                              } else {
                                setLeadPaint(prev => prev.filter((v) => v !== key));
                              }
                            }}
                          />
                          <Label className="text-sm font-normal cursor-pointer">{label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Handicap Accessible (select) */}
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="handicap_accessible">Handicap Accessible</Label>
                    <Select
                      value={handicapAccessible}
                      onValueChange={(value) => setHandicapAccessible(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Listing Agreement Type */}
                <div className="space-y-2 border-t pt-6">
                  <Label className="text-xl font-semibold">Listing Agreement</Label>
                  <div className="space-y-2 max-w-md">
                    <Label htmlFor="listing_agreement_type">Type of Listing Agreement</Label>
                    <Select
                      value={formData.listing_agreement_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, listing_agreement_type: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select agreement type..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="exclusive_right_to_sell">Exclusive Right to Sell</SelectItem>
                        <SelectItem value="exclusive_agency">Exclusive Agency</SelectItem>
                        <SelectItem value="entry_only">Entry Only</SelectItem>
                        <SelectItem value="open_listing">Open Listing</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Exclusions - Not for Multi-Family FOR SALE */}
                {!(formData.listing_type === "for_sale" && formData.property_type === "multi_family") && (
                  <div className="space-y-2 border-t pt-6">
                    <Label htmlFor="listing_exclusions">Exclusions</Label>
                    <p className="text-sm text-muted-foreground">Items excluded from the sale</p>
                    <Textarea
                      id="listing_exclusions"
                      placeholder="Items excluded from the sale (e.g. dining room chandelier, washer/dryer)..."
                      value={formData.listing_exclusions}
                      onChange={(e) => setFormData(prev => ({ ...prev, listing_exclusions: e.target.value }))}
                      rows={3}
                    />
                  </div>
                )}

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
                          type="text"
                          placeholder="1234"
                          value={formData.lockbox_code}
                          onChange={(e) => setFormData(prev => ({ ...prev, lockbox_code: e.target.value }))}
                          autoComplete="off"
                          data-form-type="other"
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
                      <Checkbox
                        id="appointment_required"
                        checked={formData.appointment_required}
                        onCheckedChange={(isChecked) =>
                          setFormData(prev => ({ ...prev, appointment_required: isChecked === true }))
                        }
                      />
                      <Label htmlFor="appointment_required" className="font-normal cursor-pointer">
                        Appointment required for showing
                      </Label>
                    </div>
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
                  
                  {/* Property Links */}
                  <div className="space-y-4">
                    <Label className="text-lg font-medium">Property Links</Label>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="property_website_url">Property Website URL</Label>
                        <Input
                          id="property_website_url"
                          type="url"
                          placeholder="https://www.example.com/listing/123"
                          value={formData.property_website_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, property_website_url: e.target.value }))}
                        />
                        {formData.property_website_url && !/^https?:\/\/.+\..+/.test(formData.property_website_url) && (
                          <p className="text-sm text-destructive">Please enter a valid URL</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="virtual_tour_url">Virtual Tour URL</Label>
                        <Input
                          id="virtual_tour_url"
                          type="url"
                          placeholder="https://vimeo.com/... or Matterport link"
                          value={formData.virtual_tour_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, virtual_tour_url: e.target.value }))}
                        />
                        {formData.virtual_tour_url && !/^https?:\/\/.+\..+/.test(formData.virtual_tour_url) && (
                          <p className="text-sm text-destructive">Please enter a valid URL</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="video_url">Video URL</Label>
                        <Input
                          id="video_url"
                          type="url"
                          placeholder="https://youtu.be/..."
                          value={formData.video_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                        />
                        {formData.video_url && !/^https?:\/\/.+\..+/.test(formData.video_url) && (
                          <p className="text-sm text-destructive">Please enter a valid URL</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Property Photos - Auto-Navigate to Management Page */}
                  {/* Photos Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-lg font-medium">Property Photos</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Upload and manage photos on a dedicated page.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('photo-upload')?.click()}
                          disabled={isUploadingPhotos}
                        >
                          {isUploadingPhotos ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Photos
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleNavigateToManagePhotos}
                          disabled={isUploadingPhotos}
                        >
                          Manage Photos
                        </Button>
                      </div>
                    </div>
                    
                    <input
                      id="photo-upload"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e.target.files, 'photos')}
                      className="hidden"
                      disabled={isUploadingPhotos}
                    />
                    
                    {/* Display existing photos */}
                    {photos.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-primary">
                          {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {photos.slice(0, 4).map((photo, index) => (
                            <div key={photo.id} className="relative aspect-video rounded-lg overflow-hidden border">
                              <img 
                                src={photo.preview || photo.url} 
                                alt={`Photo ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {index === 0 && (
                                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                                  Main
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {photos.length > 4 && (
                          <p className="text-sm text-muted-foreground">
                            +{photos.length - 4} more photo{photos.length - 4 !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Click "Upload Photos" to add photos. You'll be taken to a dedicated page to manage, reorder, and delete photos.
                      </p>
                    )}
                  </div>

                  {/* Floor Plans */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-medium">Floor Plans</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('floorplan-upload')?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Floor Plans
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleNavigateToManageFloorPlans}
                        >
                          Manage Floor Plans
                        </Button>
                      </div>
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
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Select the document type for each uploaded file
                        </p>
                        {documents.map((doc) => (
                          <div key={doc.id} className="space-y-2 p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
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
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <Select
                                  value={doc.documentType || ''}
                                  onValueChange={(value) => {
                                    setDocuments(documents.map(d => 
                                      d.id === doc.id ? { ...d, documentType: value } : d
                                    ));
                                  }}
                                >
                                  <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Select document type..." />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background z-50">
                                    <SelectItem value="purchase_and_sale">Purchase & Sale Agreement</SelectItem>
                                    <SelectItem value="lead_paint">Lead Paint Disclosure</SelectItem>
                                    <SelectItem value="property_disclosure">Property Disclosure</SelectItem>
                                    <SelectItem value="inspection_report">Inspection Report</SelectItem>
                                    <SelectItem value="title_report">Title Report</SelectItem>
                                    <SelectItem value="survey">Survey</SelectItem>
                                    <SelectItem value="hoa_docs">HOA Documents</SelectItem>
                                    <SelectItem value="deed">Deed</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {doc.documentType === 'other' && (
                                <div className="flex-1">
                                  <Input
                                    placeholder="Specify document type..."
                                    value={(doc as any).customDocType || ''}
                                    onChange={(e) => {
                                      setDocuments(documents.map(d => 
                                        d.id === doc.id ? { ...d, customDocType: e.target.value } as any : d
                                      ));
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t pt-6 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const targetId = listingId || draftId;
                      if (targetId) {
                        window.open(`/listing/${targetId}`, '_blank');
                      } else {
                        toast.error("Please save the listing first to preview it.");
                      }
                    }}
                    disabled={submitting || autoSaving}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSaveDraft(false)}
                    disabled={submitting || autoSaving}
                  >
                    {autoSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {listingId ? "Save Changes" : "Save Draft"}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting || autoSaving}
                    onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      listingId ? "Save & Publish" : "Publish Listing"
                    )}
                  </Button>
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

      {/* ATTOM Address Confirmation Modal - Single instance, controlled */}
      {isAddressConfirmOpen && attomPendingRecord && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) handleRejectAttomAddress(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Address</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-3">
                We found this property in public records:
              </p>

              <p className="font-medium text-base bg-muted p-3 rounded-md">
                {buildAttomAddressString(attomPendingRecord)}
              </p>

              <p className="text-sm text-muted-foreground mt-3">
                Is this address correct?
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={handleRejectAttomAddress}>
                No, I'll enter it manually
              </Button>

              <Button type="button" onClick={handleConfirmAttomAddress}>
                Yes, use this address
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AddListing;
