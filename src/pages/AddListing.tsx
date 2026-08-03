import { useState, useEffect, useRef, useMemo } from "react";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { agentSectionTitle } from "@/lib/agentUi";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { supabase } from "@/integrations/supabase/client";
// Navigation removed - rendered globally in App.tsx
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
import { Loader2, Save, Eye, Upload, X, Image as ImageIcon, FileText, GripVertical, Cloud, ChevronDown, CheckCircle2, AlertCircle, Home, CalendarIcon, Lock, RefreshCw } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { format, differenceInDays } from "date-fns";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
// ZIP code data imports removed — AddListing uses simple text input now
import { getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";
import { bostonNeighborhoods } from "@/data/bostonNeighborhoods";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { cn } from "@/lib/utils";
import {
  listingAgreementOptions,
  listingAgreementSectionTitle,
  listingAgreementTypeLabel,
} from "@/lib/listingAgreement";
import { 
  getCitiesForStateAndCounty, 
  getNeighborhoodsForLocation, 
  validateAndNormalizeCity,
  validateLocationCombo,
  type CityOption 
} from "@/lib/locationData";
import { 
  LISTING_STATUS, 
  ADD_LISTING_CREATE_STATUSES, 
  ADD_LISTING_EDIT_STATUSES 
} from "@/constants/status";
import { createAddListingDraftSession } from "@/lib/addListingDraftSession";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { normalizeGooglePlace } from "@/lib/google-address";
import { checkDuplicateListing, isLiveStatus } from "@/lib/checkDuplicateListing";
import { formHasValidListingPricing } from "@/lib/listingPricingValidation";
import { dcmlsPublishSnapshot, dcmlsShowOnFromRecord } from "@/lib/dcmlsPublishPayload";
import { Seo } from "@/components/Seo";
import { Skeleton } from "@/components/ui/skeleton";
import { DcmlsPublishingIntroOverlay, DcmlsLaunchingSoonReminder } from "@/components/add-listing/DcmlsPublishingIntroOverlay";
import { AddListingStatusHelp } from "@/components/add-listing/AddListingStatusHelp";
import { AddListingStatusIntroOverlay } from "@/components/add-listing/AddListingStatusIntroOverlay";
import { useAddListingStatusIntro } from "@/hooks/useAddListingStatusIntro";
import { useAddListingDcmlsIntro } from "@/hooks/useAddListingDcmlsIntro";
import { canonicalizeListingFormState, describeMediaCollection } from "@/lib/listingFormDirtyState";

// State name to abbreviation mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  Massachusetts: "MA",
  "New Hampshire": "NH",
  "Rhode Island": "RI",
  Connecticut: "CT",
  Vermont: "VT",
  Maine: "ME",
};

const ATTOM_ENABLED = false;

/** Neutral focus rings on this surface (avoid primary/blue chrome on inputs & select chevrons). */
const addListingFormChrome =
  "[&_input]:focus-visible:border-zinc-900 [&_input]:focus-visible:ring-1 [&_input]:focus-visible:ring-zinc-300/80 [&_input]:focus-visible:shadow-none [&_textarea]:focus-visible:border-zinc-900 [&_textarea]:focus-visible:ring-1 [&_textarea]:focus-visible:ring-zinc-300/80 [&_textarea]:shadow-none [&_button[role=combobox]_svg]:text-zinc-500";

/** Shared outline `Button` class for media uploads on Add Listing (Photos, Floor Plans, Documents). */
const ADD_LISTING_MEDIA_OUTLINE_BUTTON_CLASS = "border-zinc-200";

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
  uploaded?: boolean;
  url?: string;
  documentType?: string;
  /** When `documentType` is `other`, user-provided label stored in DB as `customLabel` on the document JSON. */
  customDocumentLabel?: string;
}

/** Labels for listing documents (Add Listing) — matches Select values below. */
const ADD_LISTING_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  purchase_and_sale: "Purchase & Sale Agreement",
  lead_paint: "Lead Paint Disclosure",
  property_disclosure: "Property Disclosure",
  inspection_report: "Inspection Report",
  title_report: "Title Report",
  survey: "Survey",
  hoa_docs: "HOA Documents",
  deed: "Deed",
  other: "Other",
};

function addListingDocumentTypeDisplay(doc: Pick<FileWithPreview, "documentType" | "customDocumentLabel">): string {
  const key = doc.documentType || "";
  const base = ADD_LISTING_DOCUMENT_TYPE_LABELS[key] || (key ? key.replace(/_/g, " ") : "Document");
  if (key === "other" && doc.customDocumentLabel?.trim()) {
    return `${base}: ${doc.customDocumentLabel.trim()}`;
  }
  return base;
}

function listingDocumentToPayload(doc: FileWithPreview): {
  url: string;
  name?: string;
  documentType?: string;
  customLabel?: string;
} {
  const base: { url: string; name?: string; documentType?: string; customLabel?: string } = {
    url: doc.url!,
    name: doc.file?.name || "",
    documentType: doc.documentType || "",
  };
  if (doc.documentType === "other" && doc.customDocumentLabel?.trim()) {
    base.customLabel = doc.customDocumentLabel.trim();
  }
  return base;
}

// Zod validation schema - year_built allows empty/undefined, only validates when value provided
const listingSchema = z.object({
  address: z.string().trim().min(1, "Address is required").max(500),
  city: z.string().trim().min(1, "City is required").max(200),
  state: z.string().trim().length(2, "State must be 2 characters"),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  price: z.number().min(100, "Price must be at least $100").max(100000000).optional(),
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
  price_range_min: z.number().min(100).max(100000000).optional(),
  price_range_max: z.number().min(100).max(100000000).optional(),
  description: z.string().max(5000).optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
}).refine(
  (d) => d.price != null || d.price_range_min != null || d.price_range_max != null,
  { message: "Please enter a Listing Price or a Price Range.", path: ["price"] }
).refine(
  (d) => d.price_range_min == null || d.price_range_max == null || d.price_range_min <= d.price_range_max,
  { message: "Price Range Min must be <= Price Range Max.", path: ["price_range_min"] }
);

/**
 * Map Add Listing form `status` → `listings.status` values allowed by `chk_listing_status`.
 * UI uses {@link LISTING_STATUS.NEW} ("new") for "New (Active)"; the DB stores `active`.
 */
function addListingFormStatusToDbStatus(formStatus: string): string {
  const key = (formStatus || "").trim().toLowerCase();
  if (key === LISTING_STATUS.NEW || key === "new") return LISTING_STATUS.ACTIVE;
  if (key === LISTING_STATUS.CANCELED || key === "canceled") return LISTING_STATUS.CANCELLED;
  return key;
}

/** `example.com`, `www.example.com`, or full URL → stored with `https://` when missing scheme. */
function normalizeOptionalWebUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^(mailto:|tel:)/i.test(t)) return t;
  const collapsed = t.replace(/\s+/g, "");
  if (/^https?:\/\//i.test(collapsed)) return collapsed;
  return `https://${collapsed}`;
}

/** Inline validation: scheme optional; must resolve to a host with a dot. */
function isPlausibleWebUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^(mailto:|tel:)/i.test(t)) return true;
  const candidate = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(candidate);
    return Boolean(u.hostname && u.hostname.includes("."));
  } catch {
    return /^[\w.-]+\.\w{2,}(\/.*)?$/i.test(t);
  }
}

/** Flat fee `commission_rate` is digits-only in form state (e.g. "5000") so saves use `parseFloat` unchanged. */
function commissionFlatFeeDigitsFromNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.round(n));
}

/** Strip grouping/non-digits from flat-fee typing; normalize to whole dollars as digits. */
function commissionFlatFeeDigitsFromInput(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d === "") return "";
  const n = Number(d);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.floor(n));
}

function commissionFlatFeeDisplay(digits: string): string {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US");
}

function resolveAddListingReturnTo(
  location: ReturnType<typeof useLocation>,
  searchParams: URLSearchParams,
): string {
  const stateFrom = (location.state as { from?: string } | null)?.from;
  if (stateFrom) return stateFrom;
  const paramFrom = searchParams.get("from");
  if (paramFrom?.startsWith("/")) return paramFrom;
  return ROUTES.MY_LISTINGS;
}

const AddListing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: listingId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const addListingBackTo = useMemo(
    () => resolveAddListingReturnTo(location, searchParams),
    [location, searchParams],
  );
  const initialStatus = searchParams.get("status") || "new";
  const [user, setUser] = useState<any>(null);
  const { introVisible, showComingSoonRow, handleGotIt } = useAddListingDcmlsIntro(user);
  const { introVisible: statusIntroVisible, handleGotIt: handleStatusGotIt } =
    useAddListingStatusIntro(user);
  const [loading, setLoading] = useState(true);
  const [isLoadingListing, setIsLoadingListing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Create flow: manual Save Draft only (Publish uses `submitting`). */
  const [savingDraft, setSavingDraft] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  /** Canonical snapshot of the last clean (hydrated or saved) state; null until hydration settles. */
  const baselineSnapshotRef = useRef<string | null>(null);
  const formSnapshotRef = useRef<string>("");
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  /** React state for rendering only — insert-vs-update uses draftSession.getDraftId(). */
  const [draftId, setDraftIdState] = useState<string | null>(null);
  const draftSessionRef = useRef<ReturnType<typeof createAddListingDraftSession> | null>(null);
  if (!draftSessionRef.current) {
    draftSessionRef.current = createAddListingDraftSession((id) => {
      setDraftIdState(id);
    });
  }
  const draftSession = draftSessionRef.current;
  const setDraftId = (id: string | null) => {
    draftSession.setDraftId(id);
  };
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
  
  // Track the context that was verified with ATTOM to detect when fields change
  const [attomVerifiedContext, setAttomVerifiedContext] = useState<{
    property_type: string;
    address: string;
    city: string;
    zip_code: string;
    state: string;
    county: string;
    unit_number: string;
    attom_id: string | null; // Track which property was verified
  } | null>(null);
  
  // Ref to track when we're applying ATTOM data (to prevent re-triggering fetch)
  const isApplyingAttomDataRef = useRef(false);
  // State to track initial data loading (prevent ATTOM auto-fetch during load)
  // Using state instead of ref so that changes trigger re-renders and the useEffect re-runs
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Refs to track original values for change detection in edit mode
   const originalPriceRef = useRef<number | null>(null);
   const originalStatusRef = useRef<string | null>(null);
   const backendStatusRef = useRef<string | null>(null);

  // Clone listing state (set when navigating from AgentListingDetail "Clone as New Listing")
  const [isRelisting, setIsRelisting] = useState(false);
  const [originalListingId, setOriginalListingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    status: initialStatus,
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
    additional_notes: "",
    go_live_date: "",
    auto_activate_on: null as Date | null,
    // DCMLS publish decision
    show_on_dcmls: false as boolean,
    // New date fields
    list_date: new Date().toLocaleDateString('en-CA'),
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
    
    property_website_url: "",
    virtual_tour_url: "",
    video_url: "",
    listing_agreement_type: "",
    // New rental & apartment fields
    unit_number: "",
    building_name: "",
    rental_fee: "",
    rental_fee_text: "",
    laundry_type: "none",
    pets_comment: "",
    // Parking fields
    parking_spaces: "",
    total_parking_spaces: "",
    garage_spaces: "",
    parking_comments: "",
    garage_comments: "",
    // Price range fields
    price_range_min: "",
    price_range_max: "",
    // Tax information fields
    annual_property_tax: "",
    assessed_value: "",
    fiscal_year: "",
    residential_exemption: "",
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
  const [parkingFeatures, setParkingFeatures] = useState<string[]>([]);
  const [garageFeatures, setGarageFeatures] = useState<string[]>([]);
  const [garageAdditionalFeatures, setGarageAdditionalFeatures] = useState<string[]>([]);
  
  const [photos, setPhotos] = useState<FileWithPreview[]>([]);
  const [floorPlans, setFloorPlans] = useState<FileWithPreview[]>([]);
  const [documents, setDocuments] = useState<FileWithPreview[]>([]);
  /** Staged document: not added to `documents` until user clicks Add. */
  const [pendingDocumentType, setPendingDocumentType] = useState<string>("");
  const [pendingDocumentFile, setPendingDocumentFile] = useState<File | null>(null);
  const [pendingDocumentCustomLabel, setPendingDocumentCustomLabel] = useState("");
  const pendingDocumentInputRef = useRef<HTMLInputElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Address dropdown state
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const [availableCounties, setAvailableCounties] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<CityOption[]>([]);
  const [locationValidation, setLocationValidation] = useState<{ isValid: boolean; message?: string }>({ isValid: true });
  const [validationErrors, setValidationErrors] = useState<{ field: string; label: string }[]>([]);
  const validationSummaryRef = useRef<HTMLDivElement>(null);
  
  // Flag to prevent cascading useEffects from clearing values during initial data load
  const isHydratingLocationRef = useRef(false);

  // Update available counties when state changes
  useEffect(() => {
    if (selectedState) {
      const counties = getCountiesForState(selectedState);
      setAvailableCounties(counties);
      
      // Skip clearing if we're hydrating existing data
      if (isHydratingLocationRef.current) {
        return;
      }
      
      // For MA, don't default to "all" since we require county selection
      if (selectedState === "MA") {
        setSelectedCounty("");
      } else {
        setSelectedCounty("all");
      }
      setAvailableCities([]);
      setFormData(prev => ({ ...prev, city: "", state: selectedState, zip_code: "", county: "" }));
    }
  }, [selectedState]);

  // Update available cities when state or county changes
  useEffect(() => {
    if (selectedState) {
      const cityOptions = getCitiesForStateAndCounty(selectedState, selectedCounty);
      
      // Skip clearing if we're hydrating existing data
      if (isHydratingLocationRef.current) {
        setAvailableCities(cityOptions);
        return;
      }
      
      // Clear city if it's not in the new filtered list
      const currentCityExists = cityOptions.some(
        c => c.name.toLowerCase() === formData.city?.toLowerCase()
      );
      
      if (formData.city && !currentCityExists) {
        setFormData(prev => ({ ...prev, city: "" }));
      }
      
      setAvailableCities(cityOptions);
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

  // Track form changes against the post-hydration baseline.
  // Normalizing backend values while loading is NOT a user edit, so dirty state is
  // a comparison against a snapshot taken once hydration has settled.
  const formSnapshot = useMemo(
    () =>
      canonicalizeListingFormState({
        formData,
        photos: describeMediaCollection(photos),
        floorPlans: describeMediaCollection(floorPlans),
        documents: describeMediaCollection(documents),
        disclosures,
        propertyFeatures,
        amenities,
      }),
    [formData, photos, floorPlans, documents, disclosures, propertyFeatures, amenities],
  );

  // Establish the clean baseline once auth + any listing hydration has finished.
  // A short settle delay lets dependent cascades (state/county -> city lists) finish first.
  useEffect(() => {
    if (!user || loading || isLoadingListing) return;
    if (baselineSnapshotRef.current !== null) return;
    const settleTimeout = setTimeout(() => {
      baselineSnapshotRef.current = formSnapshotRef.current;
      setHasUnsavedChanges(false);
    }, 600);
    return () => clearTimeout(settleTimeout);
  }, [user, loading, isLoadingListing]);

  useEffect(() => {
    formSnapshotRef.current = formSnapshot;
    if (!user || baselineSnapshotRef.current === null) return;
    setHasUnsavedChanges(formSnapshot !== baselineSnapshotRef.current);
  }, [formSnapshot, user]);

  // Auto-save functionality - debounced on changes
  useEffect(() => {
    if (!user || !hasUnsavedChanges) return;
    
    // Debounce autosave to 14 seconds after last change
    const debounceTimeout = setTimeout(() => {
      // Skip this tick while a save or draft creation is already running
      if (draftSession.shouldSkipAutosaveTick()) return;

      // In edit mode for non-draft listings, use handleSaveChanges to preserve status
      if (listingId && backendStatusRef.current && backendStatusRef.current !== "draft") {
        handleSaveChanges(true); // silent auto-save preserving current status
      } else {
        handleSaveDraft(true);
      }
    }, 14000);
    
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
      } else if (location.state?.clonedListing) {
        // Clone path — pre-fill form from cloned data without setting draftId/listingId
        console.log('[AddListing] Hydrating from clonedListing state');
        const cloned = location.state.clonedListing as Record<string, any>;

        // Mark as relisting
        setIsRelisting(true);
        setOriginalListingId(cloned.original_listing_id ?? null);

        // Set hydration flag to prevent cascading useEffects from clearing values
        isHydratingLocationRef.current = true;

        // Location selectors
        if (cloned.state) {
          setSelectedState(cloned.state);
          const counties = getCountiesForState(cloned.state);
          setAvailableCounties(counties);
        }
        if (cloned.county) setSelectedCounty(cloned.county);
        if (cloned.city) {
          const cityOptions = getCitiesForStateAndCounty(cloned.state || "", cloned.county || "all");
          setAvailableCities(cityOptions);
        }

        setTimeout(() => { isHydratingLocationRef.current = false; }, 100);

        // Form data
        setFormData(prev => ({
          ...prev,
          status: "draft",
          listing_type: cloned.listing_type || "for_sale",
          property_type: cloned.property_type || "single_family",
          address: cloned.address || "",
          city: cloned.city || "",
          state: cloned.state || "",
          zip_code: cloned.zip_code || "",
          county: cloned.county || "",
          neighborhood: cloned.neighborhood || "",
          latitude: cloned.latitude ?? null,
          longitude: cloned.longitude ?? null,
          bedrooms: cloned.bedrooms?.toString() || "",
          bathrooms: cloned.bathrooms?.toString() || "",
          square_feet: cloned.square_feet?.toString() || "",
          lot_size: cloned.lot_size?.toString() || "",
          year_built: cloned.year_built?.toString() || "",
          price: "", // Agent should set new price
          description: cloned.description || "",
          additional_notes: cloned.additional_notes || "",
          unit_number: cloned.unit_number || "",
          building_name: cloned.building_name || "",
          laundry_type: cloned.laundry_type || "none",
          video_url: cloned.video_url || "",
          virtual_tour_url: cloned.virtual_tour_url || "",
          property_website_url: cloned.property_website_url || "",
          parking_spaces: (cloned as any).parking_spaces?.toString() || "",
          total_parking_spaces: cloned.total_parking_spaces?.toString() || "",
          garage_spaces: cloned.garage_spaces?.toString() || "",
          parking_comments: cloned.parking_comments || "",
          garage_comments: cloned.garage_comments || "",
        }));

        // Photos — existing storage URLs
        if (cloned.photos && Array.isArray(cloned.photos) && cloned.photos.length > 0) {
          const loadedPhotos: FileWithPreview[] = cloned.photos.map((photo: any, i: number) => ({
            file: new File([], ''),
            preview: typeof photo === 'string' ? photo : photo.url,
            id: `cloned-photo-${i}`,
            uploaded: true,
            url: typeof photo === 'string' ? photo : photo.url,
          }));
          setPhotos(loadedPhotos);
        }

        if (cloned.floor_plans && Array.isArray(cloned.floor_plans) && cloned.floor_plans.length > 0) {
          const loadedFloorPlans: FileWithPreview[] = cloned.floor_plans.map((plan: any, i: number) => ({
            file: new File([], ''),
            preview: typeof plan === 'string' ? plan : plan.url,
            id: `cloned-floor-${i}`,
            uploaded: true,
            url: typeof plan === 'string' ? plan : plan.url,
          }));
          setFloorPlans(loadedFloorPlans);
        }

        // Feature arrays
        if (cloned.property_features) setPropertyFeatures(Array.isArray(cloned.property_features) ? cloned.property_features : []);
        if (cloned.amenities) setAmenities(Array.isArray(cloned.amenities) ? cloned.amenities : []);
        if (cloned.heating_types) setInteriorAmenities(prev => [...prev]); // keep existing
        if (cloned.lead_paint) setLeadPaint(typeof cloned.lead_paint === 'string' ? cloned.lead_paint.split(', ').filter(Boolean) : []);
        if (cloned.has_basement !== undefined) {} // form will pick up from property_features
        if (cloned.parking_features_list) setParkingFeatures(cloned.parking_features_list);
        if (cloned.garage_features_list) setGarageFeatures(cloned.garage_features_list);
        if (cloned.handicap_accessible) setHandicapAccessible(cloned.handicap_accessible);
        if (cloned.area_amenities) setAreaAmenities(Array.isArray(cloned.area_amenities) ? cloned.area_amenities : []);

        // Set ATTOM ID if available
        if (cloned.attom_id) setAttomId(cloned.attom_id);
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
        
        // Set flag to prevent cascading useEffects from clearing location values
        isHydratingLocationRef.current = true;
        
        // Set state/county/city selectors FIRST (order matters for cascading selects)
        if (data.state) {
          setSelectedState(data.state);
          // Also populate counties for this state immediately
          const counties = getCountiesForState(data.state);
          setAvailableCounties(counties);
        }
        if (data.county) {
          setSelectedCounty(data.county);
        }
        if (data.city) {
          // Populate cities for this state/county immediately
          const cityOptions = getCitiesForStateAndCounty(data.state || "", data.county || "all");
          setAvailableCities(cityOptions);
        }
        
        // Clear the hydration flag after a tick to allow useEffects to run
        setTimeout(() => {
          isHydratingLocationRef.current = false;
        }, 100);
        
        // Set form data from loaded listing
        // Store original values for change tracking in edit mode
        originalPriceRef.current = data.price || null;
        
        // Store the true backend status before normalization (for draft detection)
        const rawStatus = (data.status || "new").toLowerCase();
        backendStatusRef.current = rawStatus;
        
        // Normalize status to lowercase to match Select options
        // If status is "draft", convert to "new" (draft isn't a valid UI option for edit)
        let normalizedStatus = rawStatus;
        if (normalizedStatus === "draft") {
          normalizedStatus = "new";
        }
        originalStatusRef.current = normalizedStatus;
        
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
          commission_type: data.commission_type || "percentage",
          commission_rate:
            data.commission_type === "flat_fee"
              ? commissionFlatFeeDigitsFromNumber(data.commission_rate)
              : data.commission_rate != null
                ? String(data.commission_rate)
                : "",
          commission_notes: data.commission_notes || "",
          showing_instructions: data.showing_instructions || "",
          lockbox_code: data.lockbox_code || "",
          appointment_required: data.appointment_required || false,
          additional_notes: data.additional_notes || "",
          go_live_date: data.go_live_date || "",
          list_date: data.list_date || "",
          expiration_date: data.expiration_date || "",
          unit_number: data.unit_number || "",
          building_name: data.building_name || "",
          rental_fee: data.rental_fee?.toString() || "",
          rental_fee_text: data.rental_fee_text || "",
          laundry_type: data.laundry_type || "none",
          pets_comment: data.pets_comment || "",
          listing_agreement_type: Array.isArray(data.listing_agreement_types) && data.listing_agreement_types.length > 0 
            ? data.listing_agreement_types[0] as string 
            : "",
          // Additional fields that were missing
          
          property_website_url: data.property_website_url || "",
          virtual_tour_url: data.virtual_tour_url || "",
          video_url: data.video_url || "",
          disclosures_other: data.disclosures_other || "",
          price_range_min: (data as any).price_range_min?.toString() || "",
          price_range_max: (data as any).price_range_max?.toString() || "",
          annual_property_tax: (data as any).annual_property_tax?.toString() || "",
          assessed_value: (data as any).assessed_value?.toString() || "",
          fiscal_year: (data as any).fiscal_year?.toString() || "",
          residential_exemption: (data as any).residential_exemption || "",
          // Preserve existing DB publish state when editing to avoid accidental resets.
          show_on_dcmls: dcmlsShowOnFromRecord(data as { publish_to_dcmls?: boolean; dcmls_status?: string | null }),
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
          const loadedDocuments: FileWithPreview[] = data.documents.map((doc: any, index: number) => {
            // Extract URL - handle both string format and object format
            const docUrl = typeof doc === 'string' ? doc : doc.url;
            // Extract filename from URL or use stored name
            const docName = doc.name || (docUrl ? decodeURIComponent(docUrl.split('/').pop() || '').replace(/^\d+_/, '') : `Document ${index + 1}`);
            const docType = doc.documentType || '';
            const custom =
              typeof doc.customLabel === "string"
                ? doc.customLabel
                : typeof doc.customDocumentLabel === "string"
                  ? doc.customDocumentLabel
                  : undefined;

            return {
              file: new File([], docName), // Create file with name for display
              preview: docUrl,
              id: `existing-doc-${index}`,
              uploaded: true,
              url: docUrl,
              documentType: docType,
              customDocumentLabel: custom?.trim() || undefined,
            };
          });
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
        
        // Extract otherAmenities from the special __OTHER__ entry if present
        const otherEntry = combinedFeatures.find(f => f.startsWith('__OTHER__:'));
        if (otherEntry) {
          setOtherAmenities(otherEntry.replace('__OTHER__:', ''));
        }
        
        // Filter out the __OTHER__ entry from displayed features
        const displayFeatures = combinedFeatures.filter(f => !f.startsWith('__OTHER__:'));
        setPropertyFeatures(displayFeatures);
        // Keep amenities in sync for backward compatibility
        setAmenities(displayFeatures);
        
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
        
        // Load parking fields
        if ((data as any).parking_spaces != null) {
          setFormData(prev => ({ ...prev, parking_spaces: String((data as any).parking_spaces) }));
        }
        if (data.total_parking_spaces != null) {
          setFormData(prev => ({ ...prev, total_parking_spaces: String(data.total_parking_spaces) }));
        }
        if (data.garage_spaces != null) {
          setFormData(prev => ({ ...prev, garage_spaces: String(data.garage_spaces) }));
        }
        if (data.parking_comments) {
          setFormData(prev => ({ ...prev, parking_comments: data.parking_comments }));
        }
        if (data.garage_comments) {
          setFormData(prev => ({ ...prev, garage_comments: data.garage_comments }));
        }
        if (Array.isArray(data.parking_features_list)) {
          setParkingFeatures(data.parking_features_list as string[]);
        }
        if (Array.isArray(data.garage_features_list)) {
          setGarageFeatures(data.garage_features_list as string[]);
        }
        if (Array.isArray(data.garage_additional_features_list)) {
          setGarageAdditionalFeatures(data.garage_additional_features_list as string[]);
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

  // =====================================================================
  // DCMLS PORT: ATTOM ADDRESS STRING FORMAT
  // Format: "STREET_ADDRESS UNIT, CITY, STATE ZIP5"
  // Examples: "44 Prince St 401, Boston, MA 02113"
  //           "300 Commercial Street 3B, Boston, MA 02109"
  // NOTE: NO # prefix for unit - DCMLS uses space only
  // =====================================================================
  const buildDcmlsAttomAddress = (
    streetAddress: string,
    city: string,
    stateCode: string,
    zip5: string,
    unitNumber?: string,
    isCondo?: boolean
  ): string => {
    let addressLine = streetAddress;
    
    // For condos with unit, append unit with space (NO # prefix per DCMLS)
    if (isCondo && unitNumber && unitNumber.trim()) {
      const cleanUnit = unitNumber.trim().replace(/^#/, '');
      // Check if address already includes unit (avoid duplication)
      const addressLower = streetAddress.toLowerCase();
      const unitLower = cleanUnit.toLowerCase();
      if (!addressLower.includes(` ${unitLower}`) && !addressLower.includes(`#${unitLower}`)) {
        addressLine = `${streetAddress} ${cleanUnit}`;
      }
    }
    
    // Normalize ZIP to 5 digits
    const normalizedZip = zip5 ? zip5.substring(0, 5) : '';
    
    return `${addressLine}, ${city}, ${stateCode} ${normalizedZip}`;
  };

  // Helper to build one-line address string from ATTOM record (for comparison/rejection tracking)
  const buildAttomAddressString = (record: any, unitNumber?: string): string => {
    const baseAddress = record.address || '';
    
    if (unitNumber && unitNumber.trim()) {
      const unit = unitNumber.trim();
      const commaIndex = baseAddress.indexOf(',');
      if (commaIndex > 0) {
        const street = baseAddress.substring(0, commaIndex);
        const rest = baseAddress.substring(commaIndex);
        return `${street} ${unit}${rest}`; // DCMLS: space, not #
      }
      return `${baseAddress} ${unit}`;
    }
    
    return baseAddress;
  };

  // =====================================================================
  // DCMLS PORT: ATTOM TRIGGER RULES
  // - Single Family: Unit NOT required, ATTOM can fire immediately
  // - Condo/Co-op/Apartment: Unit REQUIRED before ATTOM fires
  // =====================================================================
  const handleAutoFillFromPublicRecords = async (isAutoTrigger = false) => {
    if (!ATTOM_ENABLED) {
      if (!isAutoTrigger) {
        toast.info("Public record lookup is temporarily disabled.");
      }
      return;
    }

    if (!formData.address || !formData.city || !formData.state) {
      if (!isAutoTrigger) {
        toast.error("Please enter address, city, and state first.");
      }
      return;
    }

    // DCMLS PORT: Condo/Apartment requires unit number before ATTOM fires
    const isCondo = formData.property_type === 'condo' || formData.property_type === 'apartment';
    const hasUnit = formData.unit_number?.trim() !== '';
    
    if (isCondo && !hasUnit) {
      console.log('[DCMLS] ATTOM blocked: Condo/Apartment requires unit number');
      if (!isAutoTrigger) {
        toast.info("Please enter unit number before verifying condo address.");
      }
      setPublicRecordStatus('idle');
      setAttomFetchStatus("Unit number required for condo/apartment records.");
      return;
    }

    // Normalize state to 2-letter code for ATTOM
    const stateCode = STATE_ABBREVIATIONS[formData.state] || formData.state;
    const zip5 = formData.zip_code ? formData.zip_code.substring(0, 5) : '';
    
    // DCMLS PORT: Build address string per DCMLS format
    // Format: "STREET_ADDRESS UNIT, CITY, STATE ZIP5" (no # prefix for unit)
    const queryAddress = buildDcmlsAttomAddress(
      formData.address,
      formData.city,
      stateCode,
      zip5,
      isCondo ? formData.unit_number : undefined,
      isCondo
    );
    
    console.log('[DCMLS] ATTOM query address:', queryAddress);
    
    const payload = {
      address: isCondo && formData.unit_number?.trim() 
        ? `${formData.address} ${formData.unit_number.trim().replace(/^#/, '')}` // Space, not #
        : formData.address,
      city: formData.city,
      state: stateCode,
      zip: zip5,
    };
    
    console.log("[AddListing] ATTOM REQUEST:", payload);

    setPublicRecordStatus('loading');
    setAutoFillLoading(true);
    setAttomFetchStatus("Fetching public record data...");
    
    try {
      let data: any = null;
      let error: any = null;
      
      try {
        const response = await supabase.functions.invoke("fetch-property-data", {
          body: payload,
        });
        data = response.data;
        error = response.error;
      } catch (fetchError) {
        console.error("[AddListing] ATTOM fetch exception:", fetchError);
        error = fetchError;
      }
      
      console.log("[AddListing] ATTOM RESPONSE:", { data, error });
      setAutoFillLoading(false);

      if (error || !data) {
        setPublicRecordStatus('error');
        setAttomFetchStatus("Could not connect to public records. You can enter details manually.");
        if (!isAutoTrigger) {
          toast.error("Could not fetch public record data. Please try again.");
        }
        console.error("[AddListing] ATTOM error:", error || "No data returned");
        // Enable neighborhood dropdown even on failure
        try {
          const areas = getAreasForCity(formData.city, formData.state);
          setAttomNeighborhoods(areas);
        } catch (areaError) {
          console.error("[AddListing] Error getting areas:", areaError);
        }
        return;
      }

      // Safely extract results with defensive checks
      const results = Array.isArray(data?.results) ? data.results : [];
      console.log("[AddListing] ATTOM results count:", results.length);

      if (results.length === 0) {
        setPublicRecordStatus('error');
        setAttomFetchStatus("No matching public record found. You can enter details manually.");
        
        // Set verification status - enable neighborhood even on failure
        setAddressVerified(true);
        setVerificationMessage("Public record not found – please verify address and choose Neighborhood/Area manually.");
        
        // Enable neighborhood dropdown even on failure
        try {
          const areas = getAreasForCity(formData.city, formData.state);
          setAttomNeighborhoods(areas);
        } catch (areaError) {
          console.error("[AddListing] Error getting areas:", areaError);
        }
        
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

        // =====================================================================
        // DCMLS PORT: UNIT VERIFICATION FOR CONDOS
        // If user entered a unit number but ATTOM didn't return unit-specific data,
        // this means we only found the building, NOT the specific unit.
        // Per DCMLS: We must NOT show a green "confirm" state for a non-verified unit.
        // This is a data integrity boundary condition.
        // =====================================================================
        const userRequestedUnit = formData.unit_number?.trim();
        const attomReturnedUnit = record.unit_number?.trim();
        const isCondoType = formData.property_type === 'condo' || formData.property_type === 'apartment';
        
        if (isCondoType && userRequestedUnit && !attomReturnedUnit) {
          // User asked for unit #X, but ATTOM only returned building-level data
          // This means the unit could NOT be verified - DO NOT confirm
          console.log("[DCMLS] UNIT VERIFICATION FAILED - building found but unit not verified:", {
            userRequestedUnit,
            attomReturnedUnit,
            isCondoType
          });
          
          // DCMLS PORT: Set to ERROR state (not idle or success)
          setPublicRecordStatus('error');
          setAttomFetchStatus(`We found the building at ${record.address?.split(',')[0] || formData.address}, but we could not verify unit #${userRequestedUnit}.`);
          setAddressVerified(false);
          setVerificationMessage(`Unit #${userRequestedUnit} could not be verified. Please confirm the unit exists.`);
          
          // Enable neighborhood dropdown for manual entry
          try {
            const areas = getAreasForCity(formData.city, formData.state);
            setAttomNeighborhoods(areas);
          } catch (areaError) {
            console.error("[DCMLS] Error getting areas:", areaError);
          }
          
          toast.warning(`Building found but unit #${userRequestedUnit} could not be verified.`, {
            description: "The unit number may not exist. Please verify or enter details manually.",
          });
          
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
      setAttomFetchStatus("An error occurred. You can enter details manually.");
      if (!isAutoTrigger) {
        toast.error("An error occurred while fetching public record data. Please try again.");
      }
      // Enable neighborhood dropdown even on error
      try {
        const areas = getAreasForCity(formData.city, formData.state);
        setAttomNeighborhoods(areas);
      } catch (areaError) {
        console.error("[AddListing] Error getting areas:", areaError);
      }
    }
  };

  // =====================================================================
  // DCMLS PORT: ATTOM DATA APPLICATION
  // Per DCMLS: New ATTOM verification = SOURCE OF TRUTH
  // Always overwrite core public-record fields on confirmation:
  //   beds, full baths, half baths, square feet, year built, lot size,
  //   annual property tax, tax year, assessed value
  // This matches DCMLS: listingInfo = { ...listingInfo, ...attomData }
  // =====================================================================
  const applyAttomData = (record: any, forceOverwrite: boolean = true) => {
    // Defensive null check - never crash on missing record
    if (!record || typeof record !== 'object') {
      console.error('[ATTOM] applyAttomData called with invalid record:', record);
      setPublicRecordStatus('error');
      setAttomFetchStatus("Invalid data received. Please try again.");
      toast.error("Invalid property data received.");
      return;
    }
    
    // DCMLS PORT: forceOverwrite defaults to TRUE - new verification always overwrites
    console.log('[DCMLS] applyAttomData called with record:', JSON.stringify(record, null, 2), 'forceOverwrite:', forceOverwrite);
    
    // Mark that we're applying ATTOM data to prevent re-triggering fetch
    isApplyingAttomDataRef.current = true;
    // ALSO set hydration flag to prevent cascading useEffects from clearing values
    isHydratingLocationRef.current = true;
    
    setAttomId(record.attom_id ?? null);
    
    const oldZip = formData.zip_code;
    const newZip = record.zip;
    
    // Preserve user-entered unit number - ATTOM data should NOT clear it
    const existingUnit = formData.unit_number;
    
    // Handle state first (for dropdown sync)
    if (record.state) {
      const attomState = record.state.trim();
      setSelectedState(attomState);
    }
    
    // Handle city dropdown sync
    let finalCity = formData.city;
    let finalNeighborhood = formData.neighborhood;
    
    if (record.city) {
      const attomCity = record.city.trim();
      const attomCityLower = attomCity.toLowerCase();
      
      // Check if this is a Boston neighborhood (case-insensitive)
      const matchedBoston = bostonNeighborhoods.find(
        n => n.toLowerCase() === attomCityLower
      );
      
      if (matchedBoston) {
        // This is actually a Boston neighborhood, not a city
        finalCity = "Boston";
        finalNeighborhood = matchedBoston;
      } else {
        // Try to match city in available options
        const normalizedCity = validateAndNormalizeCity(
          attomCity,
          record.state || formData.state,
          selectedCounty !== 'all' ? selectedCounty : undefined
        );
        
        finalCity = normalizedCity || attomCity;
      }
    }
    
    // SINGLE consolidated setFormData call to apply ALL ATTOM data at once
    // This prevents race conditions between multiple setFormData calls
    setFormData(prev => {
      const updates: Partial<typeof prev> = {};
      
      // ===== ADDRESS FIELDS =====
      if (record.address) {
        updates.address = record.address;
        console.log('[ATTOM] Setting address:', record.address);
      }
      
      if (record.state) {
        updates.state = record.state.trim();
        console.log('[ATTOM] Setting state:', record.state.trim());
      }
      
      // City and neighborhood from above logic
      if (finalCity) {
        updates.city = finalCity;
        console.log('[ATTOM] Setting city:', finalCity);
      }
      if (finalNeighborhood && finalNeighborhood !== prev.neighborhood) {
        updates.neighborhood = finalNeighborhood;
        console.log('[ATTOM] Setting neighborhood:', finalNeighborhood);
      }
      
      if (newZip) {
        updates.zip_code = newZip;
        console.log('[ATTOM] Setting zip_code:', newZip);
      }
      
      // Handle unit number: only set from ATTOM if user hasn't entered one
      if (record.unit_number && !existingUnit) {
        updates.unit_number = record.unit_number;
        console.log('[ATTOM] Setting unit_number from ATTOM:', record.unit_number);
      }
      
      // ===== PROPERTY DETAILS =====
      // When forceOverwrite is true (address changed), overwrite core public-record fields
      // Otherwise, only fill if empty (preserve agent edits)
      
      // Bedrooms - overwrite if force, otherwise only fill if empty
      if (record.beds && (forceOverwrite || !prev.bedrooms)) {
        updates.bedrooms = record.beds.toString();
        console.log('[ATTOM] Setting bedrooms:', record.beds, forceOverwrite ? '(forced)' : '');
      }
      
      // Bathrooms - overwrite if force, otherwise only fill if empty
      if (record.baths && (forceOverwrite || !prev.bathrooms)) {
        updates.bathrooms = record.baths.toString();
        console.log('[ATTOM] Setting bathrooms:', record.baths, forceOverwrite ? '(forced)' : '');
      }
      
      // Square feet - overwrite if force, otherwise only fill if empty
      if (record.sqft && (forceOverwrite || !prev.square_feet)) {
        updates.square_feet = record.sqft.toString();
        console.log('[ATTOM] Setting square_feet:', record.sqft, forceOverwrite ? '(forced)' : '');
      }
      
      // Lot size - overwrite if force, otherwise only fill if empty (skip for condos)
      const isCondo = prev.property_type === 'condo' || 
        (record.property_type && (
          record.property_type.toLowerCase().includes('condo') ||
          record.property_type.toLowerCase().includes('co-op')
        ));
      if (record.lotSizeSqft && !isCondo && (forceOverwrite || !prev.lot_size)) {
        updates.lot_size = record.lotSizeSqft.toString();
        console.log('[ATTOM] Setting lot_size:', record.lotSizeSqft, forceOverwrite ? '(forced)' : '');
      }
      
      // Year built - overwrite if force, otherwise only fill if empty
      if (record.yearBuilt && (forceOverwrite || !prev.year_built)) {
        updates.year_built = record.yearBuilt.toString();
        console.log('[ATTOM] Setting year_built:', record.yearBuilt, forceOverwrite ? '(forced)' : '');
      }
      
      // Tax fields removed from form — ATTOM data still populates DB via edge function
      // but these fields are no longer exposed in the UI or form state
      
      
      // Latitude/longitude - always update if ATTOM provides them
      if (record.latitude != null) {
        updates.latitude = record.latitude;
        console.log('[ATTOM] Setting latitude:', record.latitude);
      }
      if (record.longitude != null) {
        updates.longitude = record.longitude;
        console.log('[ATTOM] Setting longitude:', record.longitude);
      }
      
      // Update property type if it's condo/co-op
      if (record.property_type && (
        record.property_type.toLowerCase().includes('condo') ||
        record.property_type.toLowerCase().includes('co-op')
      )) {
        updates.property_type = 'condo';
        updates.lot_size = ''; // Clear lot_size for condos
        console.log('[ATTOM] Setting property_type to condo');
      }
      
      // Log summary
      console.log('[ATTOM] Record data available:', {
        address: record.address,
        city: record.city,
        state: record.state,
        zip: record.zip,
        beds: record.beds,
        baths: record.baths,
        sqft: record.sqft,
        lotSizeSqft: record.lotSizeSqft,
        yearBuilt: record.yearBuilt,
        taxAmount: record.taxAmount,
        taxYear: record.taxYear,
        assessedValue: record.assessedValue,
        marketValue: record.marketValue,
        latitude: record.latitude,
        longitude: record.longitude,
        property_type: record.property_type
      });
      console.log('[ATTOM] ALL updates being applied to form:', updates);
      
      const newState = { ...prev, ...updates };
      console.log('[ATTOM] New formData state:', {
        address: newState.address,
        city: newState.city,
        state: newState.state,
        zip_code: newState.zip_code,
        bedrooms: newState.bedrooms,
        bathrooms: newState.bathrooms,
        square_feet: newState.square_feet,
        year_built: newState.year_built,
      });
      
      return newState;
    });
    
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
    
    // Reset flags after a short delay to allow state updates to complete
    setTimeout(() => {
      isApplyingAttomDataRef.current = false;
      isHydratingLocationRef.current = false;
    }, 100);
  };

  // =====================================================================
  // DCMLS PORT: handleImportAttomRecord
  // Per DCMLS: New verification = SOURCE OF TRUTH, always overwrite
  // Simplified states: Success, Warning, or Error only
  // =====================================================================
  const handleImportAttomRecord = (record: any) => {
    // Get unit from ATTOM record (if any)
    const attomUnit = record.unit_number || '';
    
    // Preserve existing unit_number if ATTOM doesn't provide one
    const existingUnit = formData.unit_number || '';
    const finalUnit = attomUnit.trim() !== '' ? attomUnit : existingUnit;
    
    console.log('[DCMLS] handleImportAttomRecord:', { attomUnit, existingUnit, finalUnit });
    
    // DCMLS: Always force overwrite on new verification
    applyAttomData(record, true);
    
    // Set unit_number using merge logic
    setFormData(prev => ({ 
      ...prev, 
      unit_number: finalUnit
    }));
    
    setIsAttomModalOpen(false);
    
    // DCMLS PORT: Simplified outcome states - only Success, Warning, or Error
    const isCondo = formData.property_type === 'condo' || formData.property_type === 'apartment';
    const hasUnit = finalUnit.trim() !== '';
    const hasTaxData = record.taxAmount != null || record.assessedValue != null;
    
    if (isCondo && hasUnit && !hasTaxData) {
      // WARNING: Address verified but no tax data available
      console.log('[DCMLS] Warning: Condo verified but no tax data');
      setPublicRecordStatus('success');
      setAttomFetchStatus("Address verified. Tax records not available for this unit.");
      toast.warning("Tax records not available for this unit. You may enter tax data manually.");
    } else {
      // SUCCESS: Full data loaded
      setPublicRecordStatus('success');
      setAttomFetchStatus("Public record data loaded successfully.");
      toast.success("Property data imported from public records!");
    }
    
    setHasAutoFetched(true);
    
    // Store verified context
    setAttomVerifiedContext({
      property_type: formData.property_type,
      address: record.address || formData.address,
      city: record.city || formData.city,
      zip_code: record.zip || formData.zip_code,
      state: record.state || formData.state,
      county: formData.county,
      unit_number: finalUnit,
      attom_id: record.attom_id || null,
    });
  };

  // =====================================================================
  // DCMLS PORT: handleConfirmAttomAddress
  // Per DCMLS: New verification = SOURCE OF TRUTH, always overwrite
  // Confirmation popup is just a review step, not a validator
  // Simplified states: Success, Warning, or Error only
  // =====================================================================
  const handleConfirmAttomAddress = () => {
    if (!attomPendingRecord) {
      setIsAddressConfirmOpen(false);
      return;
    }
    
    const record = attomPendingRecord;
    
    // Get unit from ATTOM record (if any)
    const attomUnit = record.unit_number || '';
    
    // Preserve existing unit_number if ATTOM doesn't provide one
    const existingUnit = formData.unit_number || '';
    const finalUnit = attomUnit.trim() !== '' ? attomUnit : existingUnit;
    
    console.log('[DCMLS] handleConfirmAttomAddress:', { attomUnit, existingUnit, finalUnit });
    
    // DCMLS: Always force overwrite on confirmation
    applyAttomData(record, true);
    
    // Set unit_number using merge logic
    setFormData(prev => ({ 
      ...prev, 
      unit_number: finalUnit
    }));
    
    // DCMLS PORT: Simplified outcome states - only Success, Warning, or Error
    const isCondo = formData.property_type === 'condo' || formData.property_type === 'apartment';
    const hasUnit = finalUnit.trim() !== '';
    const hasTaxData = record.taxAmount != null || record.assessedValue != null;
    
    if (isCondo && hasUnit && !hasTaxData) {
      // WARNING: Address verified but no tax data available
      console.log('[DCMLS] Warning: Condo verified but no tax data');
      setPublicRecordStatus('success');
      setAttomFetchStatus("Address verified. Tax records not available for this unit.");
      toast.warning("Tax records not available for this unit. You may enter tax data manually.");
    } else {
      // SUCCESS: Full data loaded
      setPublicRecordStatus('success');
      setAttomFetchStatus("Public record data loaded successfully.");
      toast.success("Property data loaded from public records!");
    }
    
    setHasAutoFetched(true);
    setHasConfirmedAttomAddress(true);
    
    // Store verified context
    setAttomVerifiedContext({
      property_type: formData.property_type,
      address: record.address || formData.address,
      city: record.city || formData.city,
      zip_code: record.zip || formData.zip_code,
      state: record.state || formData.state,
      county: formData.county,
      unit_number: finalUnit,
      attom_id: record.attom_id || null,
    });
    
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
    if (!ATTOM_ENABLED) return;

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
  
  // Manual ATTOM lookup trigger (temporary off switch controlled by ATTOM_ENABLED)
  const handleManualAttomLookup = () => {
    if (!ATTOM_ENABLED) {
      toast.info("Public record lookup is temporarily disabled.");
      return;
    }

    if (!formData.address || !formData.city || !formData.state) {
      toast.error("Please enter address, city, and state first.");
      return;
    }
    // Reset flags to allow a fresh lookup
    setHasAutoFetched(false);
    setAttomRejectedForAddress("");
    setAttomVerifiedContext(null); // Clear stale context
    handleAutoFillFromPublicRecords(false);
  };
  
  // Track whether ATTOM has ever been successfully verified in this session
  // This is separate from publicRecordStatus to ensure we only show warnings AFTER a verification has occurred
  const hasEverVerifiedWithAttom = attomVerifiedContext !== null && publicRecordStatus === 'success';
  
  // Compute if ATTOM verification is stale (context changed since verification)
  const isAttomVerificationStale = useMemo(() => {
    // CRITICAL: Only consider stale if we have ACTUALLY verified before
    // Return false if: no verified context, OR status is not success
    if (!attomVerifiedContext) return false;
    if (publicRecordStatus !== 'success') return false;
    
    const ctx = attomVerifiedContext;
    // Check if any key field has changed from verified context
    // Use null-safe comparisons to prevent crashes
    const ctxPropertyType = (ctx.property_type || '').toLowerCase().trim();
    const formPropertyType = (formData.property_type || '').toLowerCase().trim();
    const ctxAddress = (ctx.address || '').toLowerCase().trim();
    const formAddress = (formData.address || '').toLowerCase().trim();
    const ctxCity = (ctx.city || '').toLowerCase().trim();
    const formCity = (formData.city || '').toLowerCase().trim();
    const ctxZip = (ctx.zip_code || '').trim();
    const formZip = (formData.zip_code || '').trim();
    const ctxState = (ctx.state || '').trim();
    const formState = (formData.state || '').trim();
    const ctxCounty = (ctx.county || '').toLowerCase().trim();
    const formCounty = (formData.county || '').toLowerCase().trim();
    const ctxUnit = (ctx.unit_number || '').toLowerCase().trim();
    const formUnit = (formData.unit_number || '').toLowerCase().trim();
    
    // Only return true if ANY of these fields have actually changed
    const hasChanged = (
      ctxPropertyType !== formPropertyType ||
      ctxAddress !== formAddress ||
      ctxCity !== formCity ||
      ctxZip !== formZip ||
      ctxState !== formState ||
      ctxCounty !== formCounty ||
      ctxUnit !== formUnit
    );
    
    return hasChanged;
  }, [attomVerifiedContext, publicRecordStatus, formData.property_type, formData.address, formData.city, formData.zip_code, formData.state, formData.county, formData.unit_number]);
  
  // Detect if user switched to condo after single-family verification
  const isSwitchedToCondo = useMemo(() => {
    // Only check if we've actually verified
    if (!attomVerifiedContext) return false;
    if (publicRecordStatus !== 'success') return false;
    
    const verifiedType = (attomVerifiedContext.property_type || '').toLowerCase().trim();
    const wasSingleFamily = verifiedType === 'single_family' || verifiedType === 'townhouse';
    const isNowCondo = formData.property_type === 'condo' || formData.property_type === 'apartment';
    return wasSingleFamily && isNowCondo;
  }, [attomVerifiedContext, publicRecordStatus, formData.property_type]);
  
  // Detect if condo/apartment is selected but unit number is missing
  // This means ATTOM data is incomplete for unit-level verification
  const isCondoMissingUnit = useMemo(() => {
    const isCondo = formData.property_type === 'condo' || formData.property_type === 'apartment';
    const hasUnit = (formData.unit_number || '').trim() !== '';
    return isCondo && !hasUnit;
  }, [formData.property_type, formData.unit_number]);

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
    // Ensure status is never empty - default to original or LISTING_STATUS.NEW
    const newStatus = value || originalStatusRef.current || LISTING_STATUS.NEW;
    setFormData(prev => ({ ...prev, status: newStatus }));
    if (newStatus === LISTING_STATUS.COMING_SOON) {
      setFormData(prev => ({ ...prev, auto_activate_on: null }));
    } else if (newStatus === LISTING_STATUS.NEW || newStatus === LISTING_STATUS.ACTIVE) {
      setFormData(prev => ({ ...prev, go_live_date: "" }));
    }
  };
  
  // ===== HARD RESET: Property Type Change =====
  // When property_type changes between condo/apartment ↔ single_family/townhouse/multi_family,
  // we MUST reset ALL ATTOM-related state to prevent stale data corruption
  // CRITICAL: Skip this during initial load (edit mode) to preserve loaded data
  const prevPropertyTypeRef = useRef(formData.property_type);
  const hasUserInteractedWithPropertyType = useRef(false);
  
  useEffect(() => {
    const prevType = prevPropertyTypeRef.current;
    const newType = formData.property_type;
    
    // Skip if same property type
    if (prevType === newType) return;
    
    // CRITICAL: Skip reset during initial load (edit mode hydration)
    // This prevents loadExistingListing from triggering a reset that clears unit_number
    if (isInitialLoad) {
      console.log('[ATTOM] Property type change during initial load - skipping reset (edit mode)');
      prevPropertyTypeRef.current = newType;
      return;
    }
    
    // Mark that user has interacted
    hasUserInteractedWithPropertyType.current = true;
    
    // Determine if we're switching between condo/apartment and other types
    const wasCondoLike = prevType === 'condo' || prevType === 'apartment';
    const isCondoLike = newType === 'condo' || newType === 'apartment';
    const typeChanged = wasCondoLike !== isCondoLike;
    
    console.log('[ATTOM] Property type changed by USER:', prevType, '->', newType, 'Major switch:', typeChanged);
    
    // ALWAYS clear lot_size for condos (existing behavior)
    if (isCondoLike) {
      setFormData(prev => ({ ...prev, lot_size: '' }));
    }
    
    // HARD RESET: If switching between condo and non-condo types, clear ALL ATTOM state
    // This prevents stale unit numbers and tax data from persisting
    if (typeChanged) {
      console.log('[ATTOM] HARD RESET: Clearing all ATTOM state for property type switch');
      
      // Clear unit number when switching FROM condo TO non-condo
      if (wasCondoLike && !isCondoLike) {
        setFormData(prev => ({
          ...prev,
          unit_number: '',
        }));
      }
      
      // Clear all verification state
      setAttomVerifiedContext(null);
      setPublicRecordStatus('idle');
      setAttomFetchStatus('');
      setHasAutoFetched(false);
      setHasConfirmedAttomAddress(false);
      setAttomPendingRecord(null);
      setAddressVerified(false);
      setVerificationMessage('');
    }
    
    // Update ref for next comparison
    prevPropertyTypeRef.current = newType;
  }, [formData.property_type, isInitialLoad]);

  const handleFileSelect = async (files: FileList | null, type: "photos" | "floorplans") => {
    if (!files) return;
    
    // For photos, upload directly with spinner
    if (type === 'photos') {
      let targetListingId = listingId || draftSession.getDraftId();
      
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
            if (uploadedPhotos.length > 0) {
              setValidationErrors(prev => prev.filter(err => err.field !== "photos"));
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
    
    // Floor plans: add locally (upload on save). Documents use staged picker + Add above.
    const fileArray = Array.from(files);
    const newFiles: FileWithPreview[] = fileArray.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      id: Math.random().toString(36).substr(2, 9),
    }));

    if (type === 'floorplans') {
      setFloorPlans(prev => [...prev, ...newFiles]);
    }
    // Documents use staged type + file + explicit Add (see Documents section).
  };

  const handleRemoveFile = (id: string, type: 'photos' | 'floorplans' | 'documents') => {
    if (type === 'photos') {
      void handleRemovePhoto(id);
    } else if (type === 'floorplans') {
      setFloorPlans(prev => {
        const file = prev.find(f => f.id === id);
        if (file?.preview) URL.revokeObjectURL(file.preview);
        return prev.filter(f => f.id !== id);
      });
    } else {
      setDocuments((prev) => {
        const file = prev.find((f) => f.id === id);
        if (file?.preview) URL.revokeObjectURL(file.preview);
        return prev.filter((f) => f.id !== id);
      });
    }
  };

  const handleRemovePhoto = async (id: string) => {
    const removed = photos.find((p) => p.id === id);
    if (removed?.preview && removed.preview.startsWith("blob:")) {
      URL.revokeObjectURL(removed.preview);
    }

    const updatedPhotos = photos.filter((p) => p.id !== id);
    setPhotos(updatedPhotos);

    const targetListingId = listingId || draftSession.getDraftId();
    if (!targetListingId) return;

    const dbPhotos = updatedPhotos
      .filter((p) => p.uploaded && p.url)
      .map((photo, index) => ({
        url: photo.url!,
        order: index,
      }));

    try {
      const { error } = await supabase
        .from("listings")
        .update({ photos: dbPhotos })
        .eq("id", targetListingId);

      if (error) throw error;
    } catch (error) {
      console.error("[AddListing] Error removing photo:", { listingId: targetListingId, error });
      toast.error("Could not remove photo. Please try again.");
    }
  };

  const handlePendingDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingDocumentFile(file);
    e.target.value = "";
  };

  const handleAddPendingDocument = () => {
    if (!pendingDocumentType) {
      toast.error("Select a document type");
      return;
    }
    if (!pendingDocumentFile) {
      toast.error("Choose a file to add");
      return;
    }
    if (pendingDocumentType === "other" && !pendingDocumentCustomLabel.trim()) {
      toast.error("Enter a name for this document");
      return;
    }
    const id = Math.random().toString(36).slice(2, 11);
    const preview = pendingDocumentFile.type.startsWith("image/")
      ? URL.createObjectURL(pendingDocumentFile)
      : "";
    setDocuments((prev) => [
      ...prev,
      {
        file: pendingDocumentFile,
        preview,
        id,
        documentType: pendingDocumentType,
        customDocumentLabel:
          pendingDocumentType === "other" ? pendingDocumentCustomLabel.trim() : undefined,
      },
    ]);
    setPendingDocumentFile(null);
    setPendingDocumentType("");
    setPendingDocumentCustomLabel("");
  };

  const canAddPendingDocument =
    Boolean(pendingDocumentType) &&
    Boolean(pendingDocumentFile) &&
    (pendingDocumentType !== "other" || pendingDocumentCustomLabel.trim().length > 0);

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
    documents: { url: string; name?: string; documentType?: string; customLabel?: string }[];
  }> => {
    if (!user) {
      console.warn("uploadFiles called without user - aborting");
      return { photos: [], floorPlans: [], documents: [] };
    }

    const uploadedPhotos: { url: string; name?: string }[] = [];
    const uploadedFloorPlans: { url: string; name?: string }[] = [];
    const uploadedDocuments: { url: string; name?: string; documentType?: string; customLabel?: string }[] = [];

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
        uploadedDocuments.push(listingDocumentToPayload({ ...doc, url: doc.url } as FileWithPreview));
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

      uploadedDocuments.push(
        listingDocumentToPayload({ ...doc, url: publicUrl, uploaded: true } as FileWithPreview),
      );
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

  // Helper to ensure a draft listing exists before any save/upload operation.
  // Concurrent callers share one in-flight create; decisions use draftSession ref, not React state alone.
  const ensureDraftListing = async (): Promise<string | null> => {
    return draftSession.ensureDraftListing(async () => {
      if (!user) {
        console.error('ensureDraftListing: Cannot create draft - no user logged in');
        return null;
      }

      const dcmlsSnapshot = dcmlsPublishSnapshot(false);

      const draftPrice =
        formData.listing_type === "for_rent"
          ? (() => {
              const r = parseFloat(String(formData.monthly_rent ?? "").trim());
              return Number.isFinite(r) ? r : 0;
            })()
          : formData.price
            ? parseFloat(formData.price)
            : 0;

      const minimalPayload = {
        agent_id: user.id,
        status: 'draft',
        address: formData.address || 'Draft',
        city: formData.city || 'TBD',
        state: formData.state || 'MA',
        zip_code: formData.zip_code || '00000',
        price: draftPrice,
        ...dcmlsSnapshot,
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
      return { id: data.id };
    });
  };

  // Helper to get fresh user from server - single source of truth for identity
  // Uses auth.getUser() which is server-verified, NOT cached state
  const getFreshUserOrRedirect = async () => {
    const { data: { user: freshUser }, error } = await supabase.auth.getUser();
    if (error || !freshUser) {
      toast.error("Session expired. Please log in again.");
      navigate("/auth");
      return null;
    }
    return freshUser;
  };

  // Centralized helper to build listing payload from form data
  // IMPORTANT: agentId is now a REQUIRED parameter - must come from getFreshUserOrRedirect()
  const buildListingDataFromForm = (
    uploadedMedia: { photos: any[]; floorPlans: any[]; documents: any[] },
    overrideStatus?: string,
    agentId?: string
  ) => {
    // Hard guard - agent_id is required
    if (!agentId) {
      throw new Error("Missing agentId for listing save - session may have expired");
    }

    // Normalize Boston neighborhoods at save time - safety net for all code paths
    let finalCity = formData.city?.trim() || "TBD";
    let finalNeighborhood = formData.neighborhood || null;

    // Check if the "city" is actually a Boston neighborhood
    if (finalCity && bostonNeighborhoods.some(n => n.toLowerCase() === finalCity.toLowerCase())) {
      const matchedNeighborhood = bostonNeighborhoods.find(
        n => n.toLowerCase() === finalCity.toLowerCase()
      );
      finalNeighborhood = matchedNeighborhood || finalCity;
      finalCity = "Boston";
    }

    return {
      // Agent - from verified session, not cached state
      agent_id: agentId,
      
      // Status & Type (DB check constraint — never persist UI-only aliases like "new")
      status: addListingFormStatusToDbStatus(overrideStatus || formData.status),
      listing_type: formData.listing_type,
      property_type: formData.property_type || null,
      
      // Location
      address: (formData.address || "Draft").trim(),
      city: finalCity,
      state: formData.state?.trim() || "MA",
      zip_code: formData.zip_code?.trim() || "00000",
      county: selectedCounty !== "all" ? selectedCounty : null,
      neighborhood: finalNeighborhood,
    latitude: formData.latitude,
    longitude: formData.longitude,
    
    // Property Details ("meat and potatoes")
    price:
      formData.listing_type === "for_rent"
        ? (() => {
            const r = parseFloat(String(formData.monthly_rent ?? "").trim());
            return Number.isFinite(r) ? r : 0;
          })()
        : formData.price
          ? parseFloat(formData.price)
          : 0,
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
    // Include otherAmenities in property_features as a special entry if present
    property_features: otherAmenities?.trim() 
      ? [...propertyFeatures, `__OTHER__:${otherAmenities.trim()}`] 
      : propertyFeatures,
    amenities: propertyFeatures, // Same as property_features - unified storage
    area_amenities: areaAmenities.length > 0 ? areaAmenities : null,
    disclosures: disclosures,
    broker_comments: formData.additional_notes || null, // Broker remarks
    
    // Media
    photos: uploadedMedia.photos,
    floor_plans: uploadedMedia.floorPlans,
    documents: uploadedMedia.documents,
    
    // Commission & Showing
    commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
    commission_type: formData.commission_type || null,
    commission_notes: formData.commission_notes || null,
    showing_instructions: formData.showing_instructions || null,
    lockbox_code: null,
    appointment_required: formData.appointment_required,
    additional_notes: formData.additional_notes || null,
    
    // Dates
    list_date: formData.list_date || null,
    expiration_date: formData.expiration_date || null,
    go_live_date: formData.go_live_date || null,
    
    // Additional Info
    unit_number: formData.unit_number || null,
    building_name: formData.building_name || null,
    disclosures_other: formData.disclosures_other || null,
    
    property_website_url: normalizeOptionalWebUrl(formData.property_website_url),
    virtual_tour_url: normalizeOptionalWebUrl(formData.virtual_tour_url),
    video_url: normalizeOptionalWebUrl(formData.video_url),
    listing_agreement_types: formData.listing_agreement_type ? [formData.listing_agreement_type] : null,
    attom_id: attomId,
    price_range_min: formData.price ? null : (formData.price_range_min ? parseFloat(formData.price_range_min) : null),
    price_range_max: formData.price ? null : (formData.price_range_max ? parseFloat(formData.price_range_max) : null),
    
    // Parking & Garage
    parking_spaces: (() => { const n = Number(formData.parking_spaces); return Number.isFinite(n) ? n : null; })(),
    total_parking_spaces: (() => { const p = Number(formData.parking_spaces) || 0; const g = Number(formData.garage_spaces) || 0; const t = p + g; return t > 0 ? t : null; })(),
    garage_spaces: (() => { const n = Number(formData.garage_spaces); return Number.isFinite(n) ? n : null; })(),
    parking_features_list: parkingFeatures.length > 0 ? parkingFeatures : null,
    garage_features_list: garageFeatures.length > 0 ? garageFeatures : null,
    garage_additional_features_list: garageAdditionalFeatures.length > 0 ? garageAdditionalFeatures : null,
    parking_comments: formData.parking_comments?.trim() || null,
    garage_comments: formData.garage_comments?.trim() || null,
    
    // Tax Information (sales only)
    ...(formData.listing_type === "for_sale" ? {
      annual_property_tax: formData.annual_property_tax ? parseFloat(formData.annual_property_tax) : null,
      assessed_value: formData.assessed_value ? parseFloat(formData.assessed_value) : null,
      fiscal_year: formData.fiscal_year ? parseInt(formData.fiscal_year) : null,
      residential_exemption: formData.residential_exemption || null,
    } : {}),
    
    // Disclosures (lead_paint is stored as string, not array)
    lead_paint: leadPaint.length > 0 ? leadPaint.join(', ') : null,
    handicap_accessible: handicapAccessible || null,
    
    // Rental-specific (conditionally added in handlers)
    ...(formData.listing_type === "for_rent" ? {
      deposit_requirements: depositRequirements,
      outdoor_space: outdoorSpace,
      storage_options: storageOptions,
      laundry_type: formData.laundry_type || null,
      pets_comment: formData.pets_comment || null,
      pet_options: petOptions,
    } : {}),

    // DCMLS: gated until AAC launch — always persist internal-only snapshot (publish_to_dcmls false).
    ...dcmlsPublishSnapshot(false),

    // Clone / relisting metadata (only set when cloning from an expired/cancelled listing)
    ...(isRelisting ? {
      is_relisting: true,
      original_listing_id: originalListingId,
    } : {}),
    };
  };

  const handleSaveDraft = async (isAutoSave = false) => {
    draftSession.beginSave();
    try {
      // Get fresh user from server - single source of truth
      const freshUser = await getFreshUserOrRedirect();
      if (!freshUser) {
        if (!isAutoSave) {
          // getFreshUserOrRedirect already shows toast and redirects
        }
        return;
      }
      
      if (isAutoSave) {
        setAutoSaving(true);
      } else {
        setSavingDraft(true);
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

      // Use centralized helper to build payload with FRESH user ID
      const payload = buildListingDataFromForm(uploaded, "draft", freshUser.id);

      console.log('Saving draft with payload:', { ...payload, photos: payload.photos?.length || 0, agent_id: payload.agent_id });

      // Remove agent_id from update payload (it's immutable after creation)
      const { agent_id, ...updatePayload } = payload;

      // All draft creation goes through ensureDraftListing (shared in-flight lock).
      // Once an id exists (ref), always update — never insert a second draft.
      let targetId = listingId || draftSession.getDraftId();
      if (!targetId) {
        targetId = await ensureDraftListing();
        if (!targetId) {
          throw new Error("Unable to create draft listing");
        }
      }

      const { data: updatedDraft, error } = await supabase
        .from("listings")
        .update(updatePayload)
        .eq("id", targetId)
        .select("id")
        .maybeSingle();
      if (error) {
        console.error('Error updating draft listing:', error);
        throw error;
      }
      if (!updatedDraft) {
        throw new Error("Draft update was blocked or not found.");
      }
      console.log('Draft updated successfully, id:', targetId);


      // Mark all items as uploaded to prevent re-uploading on next save
      // (Don't clear arrays - this preserves data for continued editing)

      // Saving establishes a new clean baseline.
      baselineSnapshotRef.current = formSnapshotRef.current;
      setHasUnsavedChanges(false);
      setLastAutoSave(new Date());

      if (isAutoSave) {
        toast.success("Auto-saved", {
          id: "add-listing-autosave",
          duration: 2600,
          description: "Your draft was saved in the background.",
        });
      }

      if (!isAutoSave) {
        toast.success("Draft saved successfully!");
        navigate(`${ROUTES.MY_LISTINGS}?status=draft`);
      }
    } catch (error: any) {
      console.error("Error saving draft listing:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        draftId: draftSession.getDraftId(),
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
      draftSession.endSave();
      if (isAutoSave) {
        setAutoSaving(false);
      } else {
        setSavingDraft(false);
      }
    }
  };

  // Centralized validation — single source of truth for required fields
  const getValidationErrors = (opts: {
    requirePhotos?: boolean;
    requirePricing?: boolean;
  } = {}): { field: string; label: string }[] => {
    const { requirePhotos = false, requirePricing = false } = opts;
    const errors: { field: string; label: string }[] = [];

    if (!formData.address.trim()) errors.push({ field: "address", label: "Street Address" });
    if (!formData.city.trim()) errors.push({ field: "city", label: "City/Town" });
    if (!formData.state.trim()) errors.push({ field: "state", label: "State" });
    if (!formData.zip_code.trim()) errors.push({ field: "zip_code", label: "ZIP Code" });

    if (requirePricing) {
      if (formData.listing_type === "for_sale" || formData.listing_type === "for_private_sale") {
        const hasPrice = formData.price && String(formData.price).trim() !== "" && Number(formData.price) > 0;
        const hasValidRange = formData.price_range_min && String(formData.price_range_min).trim() !== "" && Number(formData.price_range_min) > 0
          && formData.price_range_max && String(formData.price_range_max).trim() !== "" && Number(formData.price_range_max) > 0;
        if (!hasPrice && !hasValidRange) {
          errors.push({ field: "price", label: "Listing Price or Price Range" });
        }
      } else if (formData.listing_type === "for_rent") {
        if (!formData.monthly_rent || String(formData.monthly_rent).trim() === "" || Number(formData.monthly_rent) === 0) {
          errors.push({ field: "monthly_rent", label: "Monthly Rent" });
        }
      }
    }

    if (!formData.listing_agreement_type.trim()) {
      errors.push({
        field: "listing_agreement_type",
        label: listingAgreementTypeLabel(formData.listing_type),
      });
    }

    if (formData.state === "MA" && (!selectedCounty || selectedCounty === "all")) {
      errors.push({ field: "county", label: "County (required for MA)" });
    }

    if (formData.status === "coming_soon" && !formData.go_live_date.trim()) {
      errors.push({ field: "go_live_date", label: "Go-Live Date (required for Coming Soon)" });
    }

    if (requirePhotos && photos.length === 0) {
      errors.push({ field: "photos", label: "At least one listing photo" });
    }

    return errors;
  };

  // Helper: check if a field has a validation error
  const hasFieldError = (field: string) => validationErrors.some(err => err.field === field);

  // Helper: clear a specific field error when value becomes valid
  const clearFieldError = (field: string) => {
    setValidationErrors(prev => prev.filter(err => err.field !== field));
  };

  // Handler for "Save Changes" in edit mode - preserves current status (does NOT force draft)
  const handleSaveChanges = async (isAutoSave = false) => {
    // Get fresh user from server - single source of truth
    const freshUser = await getFreshUserOrRedirect();
    if (!freshUser) {
      return; // getFreshUserOrRedirect already shows toast and redirects
    }

    const targetId = listingId || draftSession.getDraftId();
    if (!targetId) {
      if (!isAutoSave) toast.error("No listing to update. Please use Save Draft for new listings.");
      return;
    }

    draftSession.beginSave();
    if (isAutoSave) {
      setAutoSaving(true);
    } else {
      setSubmitting(true);
    }

    // --- Centralized validation (manual save only; autosave handled below) ---
    if (!isAutoSave) {
      const targetIsDraft = !formData.status || formData.status === "draft";
      const errors = getValidationErrors({
        requirePhotos: isLiveStatus(formData.status),
        requirePricing: !targetIsDraft,
      });
      if (errors.length > 0) {
        setValidationErrors(errors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        validationSummaryRef.current?.scrollIntoView({ behavior: 'smooth' });
        draftSession.endSave();
        setSubmitting(false);
        return;
      }
      setValidationErrors([]);
    } else {
      // Autosave must never persist an invalid non-draft pricing state.
      // Skip silently and keep the last valid saved state (no toast noise).
      const targetIsDraft = !formData.status || formData.status === "draft";
      if (
        !targetIsDraft &&
        !formHasValidListingPricing({
          listing_type: formData.listing_type,
          price: formData.price,
          price_range_min: formData.price_range_min,
          price_range_max: formData.price_range_max,
          monthly_rent: formData.monthly_rent,
        })
      ) {
        draftSession.endSave();
        setAutoSaving(false);
        return;
      }
    }
    // --- End validation ---

    // --- Duplicate listing check (only for live statuses, skip for auto-save) ---
    if (!isAutoSave && isLiveStatus(formData.status)) {
      const dupResult = await checkDuplicateListing({
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip_code,
        excludeListingId: listingId || draftSession.getDraftId() || undefined,
      });
      if (dupResult.found) {
        const statusLabel = (dupResult.status || "").replace(/_/g, " ");
        toast.error(
          `A listing at this address is already "${statusLabel}". You cannot create a duplicate. If the existing listing is expired, canceled, sold, rented, or withdrawn, you may proceed.`
        );
        draftSession.endSave();
        setSubmitting(false);
        return;
      }
    }

    try {
      // Upload any new files
      let uploaded: {
        photos: { url: string; name: string }[];
        floorPlans: { url: string; name: string }[];
        documents: { url: string; name?: string; documentType?: string; customLabel?: string }[];
      } = {
        photos: photos.filter(p => p.uploaded && p.url).map(p => ({ url: p.url!, name: p.file?.name || '' })),
        floorPlans: floorPlans.filter(p => p.uploaded && p.url).map(p => ({ url: p.url!, name: p.file?.name || '' })),
        documents: documents
          .filter((d) => d.uploaded && d.url)
          .map((d) => listingDocumentToPayload({ ...d, url: d.url! } as FileWithPreview)),
      };

      const hasNewFilesToUpload = 
        photos.some(p => p.file && p.file.size > 0 && !p.uploaded) ||
        floorPlans.some(p => p.file && p.file.size > 0 && !p.uploaded) ||
        documents.some(d => d.file && d.file.size > 0 && !d.uploaded);

      if (hasNewFilesToUpload) {
        try {
          const uploadResult = await uploadFiles();
          uploaded = {
            photos: uploadResult.photos.map(p => ({ url: p.url, name: p.name || '' })),
            floorPlans: uploadResult.floorPlans.map(p => ({ url: p.url, name: p.name || '' })),
            documents: uploadResult.documents.map((d) => ({
              url: d.url,
              name: d.name || '',
              documentType: d.documentType || '',
              ...(d.customLabel ? { customLabel: d.customLabel } : {}),
            })),
          };
          console.log('[handleSaveChanges] Files uploaded successfully:', uploaded);
        } catch (uploadError: any) {
          console.error('[handleSaveChanges] Error uploading files:', uploadError);
          toast.error(`Failed to upload files: ${uploadError.message}`);
          return;
        }
      }

      // Use centralized helper WITHOUT overriding status - keeps current form status
      // IMPORTANT: Use fresh user ID from server-verified session
      const payload = buildListingDataFromForm(uploaded, undefined, freshUser.id);

      console.log('[handleSaveChanges] Saving with status:', payload.status, 'agent_id:', payload.agent_id);

      // Remove agent_id from update payload (it's immutable after creation)
      const { agent_id, ...updatePayload } = payload;

      const { data: updatedListing, error } = await supabase
        .from("listings")
        .update(updatePayload)
        .eq("id", targetId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error('[handleSaveChanges] Error updating listing:', error);
        throw error;
      }
      if (!updatedListing) {
        throw new Error("Listing update was blocked or not found.");
      }

      // Track price changes if applicable
      const newPrice = payload.price;
      if (originalPriceRef.current !== null && originalPriceRef.current !== newPrice) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from("listing_price_history").insert({
            listing_id: targetId,
            old_price: originalPriceRef.current,
            new_price: newPrice,
            changed_by: userData?.user?.id ?? null,
            note: "Price updated via Save Changes",
          });
          console.log("[handleSaveChanges] Price change logged:", originalPriceRef.current, "->", newPrice);
        } catch (priceHistoryError) {
          console.error("[handleSaveChanges] Error logging price history:", priceHistoryError);
        }
      }

      // Track status changes if applicable
      const newStatus = payload.status;
      if (originalStatusRef.current !== null && originalStatusRef.current !== newStatus) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from("listing_status_history").insert({
            listing_id: targetId,
            old_status: originalStatusRef.current,
            new_status: newStatus,
            changed_by: userData?.user?.id ?? null,
            notes: "Status updated via Save Changes",
          });
          console.log("[handleSaveChanges] Status change logged:", originalStatusRef.current, "->", newStatus);
        } catch (statusHistoryError) {
          console.error("[handleSaveChanges] Error logging status history:", statusHistoryError);
        }
      }

      // Saving establishes a new clean baseline.
      baselineSnapshotRef.current = formSnapshotRef.current;
      setHasUnsavedChanges(false);
      if (isAutoSave) {
        setLastAutoSave(new Date());
        toast.success("Auto-saved", {
          id: "add-listing-autosave",
          duration: 2600,
          description: "Your changes were saved in the background.",
        });
      } else {
        toast.success("Listing changes saved!");
        navigate(addListingBackTo);
      }
    } catch (error: any) {
      console.error("[handleSaveChanges] Error:", error);
      if (!isAutoSave) {
        toast.error(`Failed to save changes: ${error.message || 'Unknown error'}`);
      }
    } finally {
      draftSession.endSave();
      if (isAutoSave) {
        setAutoSaving(false);
      } else {
        setSubmitting(false);
      }
    }
  };

  // Helper to save form data and navigate to manage photos
  const handleNavigateToManagePhotos = async () => {
    let targetId = listingId || draftSession.getDraftId();
    
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
      // Get fresh user for consistency (though we're only updating, not inserting)
      const freshUser = await getFreshUserOrRedirect();
      if (!freshUser) return;
      
      // Get current media from state to preserve it
      const currentPhotos = photos.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, name: p.file?.name || '' }));
      const currentFloorPlans = floorPlans.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, name: p.file?.name || '' }));
      const currentDocuments = documents
        .filter((d) => d.uploaded && d.url)
        .map((d) => listingDocumentToPayload({ ...d, url: d.url! } as FileWithPreview));

      const payload = buildListingDataFromForm(
        { photos: currentPhotos, floorPlans: currentFloorPlans, documents: currentDocuments },
        undefined,
        freshUser.id
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
    let targetId = listingId || draftSession.getDraftId();
    
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
      // Get fresh user for consistency
      const freshUser = await getFreshUserOrRedirect();
      if (!freshUser) return;
      
      const currentPhotos = photos.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, name: p.file?.name || '' }));
      const currentFloorPlans = floorPlans.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, name: p.file?.name || '' }));
      const currentDocuments = documents
        .filter((d) => d.uploaded && d.url)
        .map((d) => listingDocumentToPayload({ ...d, url: d.url! } as FileWithPreview));

      const payload = buildListingDataFromForm(
        { photos: currentPhotos, floorPlans: currentFloorPlans, documents: currentDocuments },
        undefined,
        freshUser.id
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
      // Get fresh user from server FIRST - single source of truth for identity
      const freshUser = await getFreshUserOrRedirect();
      if (!freshUser) {
        setSubmitting(false);
        return; // getFreshUserOrRedirect already shows toast and redirects
      }

      // Centralized validation
      const errors = getValidationErrors({
        requirePhotos: publishNow,
        requirePricing: publishNow,
      });
      if (errors.length > 0) {
        setValidationErrors(errors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        validationSummaryRef.current?.scrollIntoView({ behavior: 'smooth' });
        setSubmitting(false);
        return;
      }
      setValidationErrors([]);

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
        price: (() => { const v = parseFloat(formData.listing_type === "for_sale" ? formData.price : formData.monthly_rent); return Number.isFinite(v) ? v : undefined; })(),
        price_range_min: (() => { const v = parseFloat(formData.price_range_min); return Number.isFinite(v) ? v : undefined; })(),
        price_range_max: (() => { const v = parseFloat(formData.price_range_max); return Number.isFinite(v) ? v : undefined; })(),
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

      // --- Duplicate listing check (only for live statuses) ---
      const targetStatus = publishNow
        ? (formData.status === "draft" || !formData.status ? "new" : formData.status)
        : "draft";
      if (isLiveStatus(targetStatus)) {
        const dupResult = await checkDuplicateListing({
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip_code,
          excludeListingId: listingId || draftSession.getDraftId() || undefined,
        });
        if (dupResult.found) {
          const statusLabel = (dupResult.status || "").replace(/_/g, " ");
          toast.error(
            `A listing at this address is already "${statusLabel}". You cannot create a duplicate. If the existing listing is expired, canceled, sold, rented, or withdrawn, you may proceed.`
          );
          setSubmitting(false);
          return;
        }
      }

      // Upload files first
      toast.info("Uploading files...");
      const uploadedFiles = await uploadFiles();

      // Use centralized helper to build payload with FRESH user ID
      // When publishing, ensure we never save "draft" - default to "new" if somehow still draft
      const statusForPublish = (formData.status === "draft" || !formData.status) ? "new" : formData.status;
      const listingData = buildListingDataFromForm(
        { photos: uploadedFiles.photos, floorPlans: uploadedFiles.floorPlans, documents: uploadedFiles.documents },
        publishNow ? statusForPublish : "draft",
        freshUser.id  // Use fresh user ID from server-verified session
      );
      
      const isRangeOnlySalePricing =
        formData.listing_type === "for_sale" &&
        validatedData.price == null &&
        (validatedData.price_range_min != null || validatedData.price_range_max != null);

      // Override with validated data for consistency
      listingData.address = validatedData.address;
      listingData.city = validatedData.city;
      listingData.state = validatedData.state;
      listingData.zip_code = validatedData.zip_code;
      // For range-only sale listings, keep the price derived in buildListingDataFromForm.
      if (!isRangeOnlySalePricing) {
        listingData.price = validatedData.price ?? listingData.price;
      }
      const effectivePrice = Number(listingData.price ?? 0);
      listingData.price = Number.isFinite(effectivePrice) ? effectivePrice : 0;
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

      // Determine if we're in edit mode (use sync draft ref, not React state alone)
      const resolvedDraftId = draftSession.getDraftId();
      const isEditMode = !!(listingId || resolvedDraftId);
      const targetListingId = listingId || resolvedDraftId;

      let resultListingId: string | null = null;

      if (isEditMode && targetListingId) {
        // UPDATE existing listing
        console.log("[AddListing] Updating existing listing:", targetListingId);
        
        const { data: updatedListing, error } = await supabase
          .from("listings")
          .update(listingData)
          .eq("id", targetListingId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!updatedListing) {
          throw new Error("Listing update was blocked or not found.");
        }
        resultListingId = targetListingId;

        // Track price changes
        const newPrice = effectivePrice;
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

        // Track status changes (log persisted DB status, not UI-only values like "new")
        const newStatus = listingData.status;
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
              new_price: effectivePrice,
              changed_by: currentUserId,
              note: "Initial listing price",
            });

            // Log status history (match row written to `listings`)
            await supabase.from("listing_status_history").insert({
              listing_id: resultListingId,
              old_status: null,
              new_status: listingData.status,
              changed_by: currentUserId,
              notes: isRelisting && originalListingId
                ? `Cloned from ${originalListingId}`
                : "Listing created",
            });
          } catch (historyError) {
            console.error("[AddListing] Error logging initial history:", historyError);
          }

          // Auto-fetch ATTOM data
          if (ATTOM_ENABLED) {
            try {
              console.log("[AddListing] Triggering auto-fetch-property-data for listing:", resultListingId);
              await supabase.functions.invoke('auto-fetch-property-data', {
                body: { listing_id: resultListingId }
              });
            } catch (fetchError) {
              console.error("[AddListing] Error fetching ATTOM data:", fetchError);
            }
          }
        }

        toast.success("Listing created successfully!");
      }

      // Clear draft state on publish success to prevent duplicate re-entries
      if (draftSession.getDraftId()) {
        setDraftId(null);
      }

      navigate(addListingBackTo);
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
      <>
        <Seo title="Add Listing" />
        <div className="min-h-0 bg-white pb-10" aria-busy="true" role="status">
          <span className="sr-only">
            {isLoadingListing ? "Loading listing data…" : "Preparing listing form…"}
          </span>
          <div className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-md bg-zinc-100" />
              </div>
              <Skeleton className="h-4 w-64 max-w-[90%] rounded-md bg-zinc-100" />
              <Skeleton className="h-10 w-full rounded-lg bg-zinc-100" />
              <Skeleton className="h-[min(52vh,440px)] w-full rounded-xl bg-zinc-100" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-32 rounded-xl bg-zinc-100" />
                <Skeleton className="h-32 rounded-xl bg-zinc-100" />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title="Add Listing" />
      <DcmlsPublishingIntroOverlay open={introVisible} onGotIt={handleGotIt} />
      <AddListingStatusIntroOverlay
        open={statusIntroVisible && !introVisible}
        onGotIt={handleStatusGotIt}
      />
      <div className="min-h-0 bg-white pb-10">
      <div className="container mx-auto px-4 pb-6">
        <div className="max-w-5xl mx-auto">
          <AgentPageHeader
            withTopPadding
            title={listingId ? "Edit listing" : "Add listing"}
            backTo={addListingBackTo}
            actions={
              user?.email ? (
                <span className="max-w-[14rem] truncate text-xs text-neutral-500 sm:max-w-xs" title={user.email}>
                  Signed in as <span className="font-medium text-zinc-700">{user.email}</span>
                </span>
              ) : null
            }
          />

          {/* Action Buttons - Sticky Top Bar */}
          <div className="-mx-4 sticky top-0 z-10 mb-6 border-b border-zinc-200/90 bg-white/95 px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/90">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                {autoSaving && (
                  <div className="flex items-center gap-1.5 text-xs font-medium leading-snug text-neutral-600">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-neutral-500" aria-hidden />
                    <span>Auto-saving…</span>
                  </div>
                )}
                {!autoSaving && hasUnsavedChanges && (
                  <div className="flex items-center gap-1.5 text-xs font-medium leading-snug text-amber-800/90">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>Unsaved changes</span>
                  </div>
                )}
                {!autoSaving && !hasUnsavedChanges && lastAutoSave && (
                  <div className="flex items-center gap-1.5 text-xs font-medium leading-snug text-neutral-600">
                    <Cloud className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
                    <span>Auto-saved {lastAutoSave.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-stretch gap-1.5 sm:ml-auto sm:items-end">
                {showComingSoonRow ? <DcmlsLaunchingSoonReminder /> : null}

                <div className="flex flex-wrap items-center gap-2">
              {/* Edit mode: Preview + Save Changes only */}
              {listingId ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/listing/${listingId}`, "_blank")}
                    type="button"
                    className="gap-1.5 border-zinc-200"
                  >
                    <Eye className="h-4 w-4 shrink-0" />
                    Preview
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSaveChanges()}
                    type="button"
                    disabled={submitting}
                    className="gap-1.5"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        {backendStatusRef.current === "draft" && formData.status !== "draft" ? "Publishing…" : "Saving…"}
                      </>
                    ) : backendStatusRef.current === "draft" && formData.status !== "draft" ? (
                      <>
                        <Upload className="h-4 w-4 shrink-0" />
                        Publish
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        {backendStatusRef.current === "draft" ? "Save Draft" : "Save Changes"}
                      </>
                    )}
                  </Button>
                </>
              ) : (
                /* Create mode: Save Draft, Preview, Publish */
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveDraft(false)}
                    type="button"
                    disabled={savingDraft || submitting}
                    className="gap-1.5 border-zinc-200"
                  >
                    {savingDraft ? (
                      <>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        Save Draft
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePreview} type="button" className="gap-1.5 border-zinc-200">
                    <Eye className="h-4 w-4 shrink-0" />
                    Preview
                  </Button>
                  <Button variant="default" size="sm" onClick={(e) => handleSubmit(e, true)} type="button" disabled={submitting || savingDraft} className="gap-1.5">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        Publishing…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 shrink-0" />
                        Publish Listing
                      </>
                    )}
                  </Button>
                </>
              )}
                </div>
              </div>
            </div>
          </div>

          {/* Validation Summary */}
          {validationErrors.length > 0 && (
            <Alert
              variant="destructive"
              ref={validationSummaryRef}
              className="mb-4 border-red-200 bg-white text-red-900 shadow-none [&>svg]:text-red-600"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Please complete the following required fields:</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {validationErrors.map((err) => (
                    <li key={err.field}>{err.label} is required</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Form Card */}
          <Card className="border-zinc-200/95">
            <CardContent className={cn("pt-6", addListingFormChrome)}>
              <h2 className={cn(agentSectionTitle, "mb-5")}>Listing details</h2>
              
              <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
                {/* Status & Type Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-zinc-100 pb-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="status">Status *</Label>
                      <AddListingStatusHelp />
                    </div>
                    <Select 
                      value={formData.status} 
                      onValueChange={handleStatusChange}
                      disabled={formData.status === LISTING_STATUS.CANCELLED || formData.status === LISTING_STATUS.SOLD}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(!listingId ? ADD_LISTING_CREATE_STATUSES : ADD_LISTING_EDIT_STATUSES).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(formData.status === LISTING_STATUS.CANCELLED || formData.status === LISTING_STATUS.SOLD) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        Final state — status and price cannot be changed.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="listing_type">Listing Category *</Label>
                    <Select
                      value={formData.listing_type}
                      onValueChange={(value) => {
                        setFormData((prev) => {
                          const validValues = listingAgreementOptions(value).map((option) => option.value);
                          const listing_agreement_type = validValues.includes(prev.listing_agreement_type)
                            ? prev.listing_agreement_type
                            : "";
                          return { ...prev, listing_type: value, listing_agreement_type };
                        });
                      }}
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

                {/* Date Section - shown for all statuses */}
                <div className={`grid grid-cols-1 ${formData.status === "coming_soon" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4 border-b border-zinc-100 pb-6`}>
                  <div className="space-y-2">
                    <Label htmlFor="list_date">AAC List Date</Label>
                    <Input
                      id="list_date"
                      type="date"
                      value={formData.list_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, list_date: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      The date this listing was added to AAC.
                    </p>
                  </div>
                  {formData.status === "coming_soon" && (
                    <div className={cn("space-y-2", hasFieldError("go_live_date") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-2 shadow-none")}>
                      <Label htmlFor="go_live_date">On MLS Date *</Label>
                      <Input
                        id="go_live_date"
                        type="date"
                        value={formData.go_live_date}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, go_live_date: e.target.value }));
                          if (e.target.value.trim()) clearFieldError("go_live_date");
                        }}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        On this date, the listing goes live on MLS and DCMLS — status changes from Coming Soon to On MLS.
                      </p>
                    </div>
                  )}
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
                  <Label className={agentSectionTitle}>Property location</Label>
                  
                  {/* Street Address + Unit # */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className={cn("space-y-2", (formData.property_type === 'condo' || formData.property_type === 'apartment') ? "sm:col-span-2" : "sm:col-span-3", hasFieldError("address") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-2 shadow-none")}>
                      <Label htmlFor="address">Street Address *</Label>
                      <AddressAutocomplete
                        value={formData.address}
                        onChange={(val: string) => { setFormData(prev => ({ ...prev, address: val })); if (val.trim()) clearFieldError("address"); }}
                        onPlaceSelect={(place) => {
                          const normalized = normalizeGooglePlace(place);
                          const placeComponents = (place as { address_components?: Array<{ long_name?: string; types?: string[] }> }).address_components || [];
                          const getGoogleLongName = (type: string) =>
                            placeComponents.find((component) => component.types?.includes(type))?.long_name || "";

                          const preferredCity =
                            getGoogleLongName("locality") ||
                            getGoogleLongName("postal_town") ||
                            getGoogleLongName("sublocality_level_1") ||
                            normalized.city;

                          const normalizedState = normalized.state || formData.state;
                          const normalizedCity = preferredCity || formData.city;
                          const normalizedZip = normalized.zip || formData.zip_code;

                          // Infer county from state+city when mapping data exists.
                          let inferredCounty = "";
                          if (normalizedState && normalizedCity && hasCountyCityMapping(normalizedState)) {
                            const matchingCounties = getCountiesForState(normalizedState).filter((county) => {
                              const countyCities = getCitiesForCounty(normalizedState, county);
                              return countyCities.some(city => city.toLowerCase() === normalizedCity.toLowerCase());
                            });

                            if (matchingCounties.length === 1) {
                              inferredCounty = matchingCounties[0];
                            }
                          }

                          // Keep dropdown UI and formData in sync with a single place-selection update.
                          isHydratingLocationRef.current = true;

                          const didStateChange = Boolean(normalizedState && normalizedState !== selectedState);
                          const nextCounty = inferredCounty || (didStateChange
                            ? (normalizedState === "MA" ? "" : "all")
                            : selectedCounty);

                          if (normalizedState) {
                            setSelectedState(normalizedState);
                            setAvailableCounties(getCountiesForState(normalizedState));
                          }

                          // If state changed, clear stale county/city values before applying new location.
                          if (didStateChange) {
                            setSelectedCounty(normalizedState === "MA" ? "" : "all");
                            setAvailableCities([]);
                          }

                          setSelectedCounty(nextCounty);

                          if (normalizedState) {
                            setAvailableCities(getCitiesForStateAndCounty(normalizedState, nextCounty));
                          }

                          setFormData(prev => ({
                            ...prev,
                            address: normalized.address_line1 || prev.address,
                            city: normalizedCity,
                            state: normalizedState,
                            county: nextCounty !== "all" ? nextCounty : "",
                            zip_code: normalizedZip,
                            latitude: normalized.lat ?? prev.latitude,
                            longitude: normalized.lng ?? prev.longitude,
                          }));

                          setTimeout(() => {
                            isHydratingLocationRef.current = false;
                          }, 100);
                        }}
                        placeholder="Start typing an address..."
                        types={["address"]}
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

                  {/* Row 2: City + State */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={cn("space-y-2", hasFieldError("city") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-2 shadow-none")}>
                      <Label htmlFor="city">City/Town *</Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder="Enter city"
                        value={formData.city}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, city: e.target.value }));
                          if (e.target.value.trim()) clearFieldError("city");
                        }}
                        required
                      />
                    </div>
                    <div className={cn("space-y-2", hasFieldError("state") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-2 shadow-none")}>
                      <Label htmlFor="state">State *</Label>
                      <Select
                        value={selectedState}
                        onValueChange={(value) => {
                          setSelectedState(value);
                          setFormData(prev => ({ ...prev, state: value }));
                          if (value.trim()) clearFieldError("state");
                        }}
                      >
                        <SelectTrigger className="bg-white border-neutral-200">
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
                  </div>

                  {/* Row 3: ZIP Code + County + Neighborhood */}
                  {(() => {
                    const neighborhoods = getNeighborhoodsForLocation({
                      city: formData.city,
                      state: formData.state,
                      county: selectedCounty !== 'all' ? selectedCounty : undefined
                    });
                    const showNeighborhoods = neighborhoods.length > 0;
                    
                    return (
                      <div className={cn("grid grid-cols-1 gap-4", showNeighborhoods ? "md:grid-cols-3" : "md:grid-cols-2")}>
                        <div className={cn("space-y-2", hasFieldError("zip_code") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-2 shadow-none")}>
                          <Label htmlFor="zip_code">ZIP Code *</Label>
                          <Input
                            id="zip_code"
                            type="text"
                            placeholder="Enter ZIP code"
                            value={formData.zip_code}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, zip_code: e.target.value }));
                              if (e.target.value.trim()) clearFieldError("zip_code");
                            }}
                            required
                          />
                        </div>
                        <div className={cn("space-y-2", hasFieldError("county") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-2 shadow-none")}>
                          <Label>County {selectedState === "MA" && "*"}</Label>
                          {!selectedState || availableCounties.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {!selectedState ? "Select a state first" : "No counties available"}
                            </p>
                          ) : (
                            <Select
                              value={selectedCounty}
                              onValueChange={(value) => {
                                setSelectedCounty(value);
                                setFormData(prev => ({ ...prev, county: value }));
                                if (value && value !== "all") clearFieldError("county");
                              }}
                            >
                              <SelectTrigger className="bg-white border-neutral-200">
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
                          )}
                        </div>
                        {showNeighborhoods && (
                          <div className="space-y-2">
                            <Label htmlFor="neighborhood">Neighborhood/Area</Label>
                            <Select
                              value={formData.neighborhood}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, neighborhood: value }))}
                            >
                              <SelectTrigger className="bg-white border-neutral-200">
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
                        )}
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
                <div className="space-y-4 border-t border-zinc-100 pt-6">
                  <Label className={agentSectionTitle}>
                    {formData.listing_type === "for_rent" ? "Pricing & deposits" : "Pricing"}
                  </Label>
                  {formData.listing_type === "for_sale" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={cn("space-y-2", hasFieldError("price") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-2 shadow-none")}>
                        <Label htmlFor="price">Listing Price <span className="text-xs font-normal text-muted-foreground">(or enter Price Range)</span></Label>
                        <FormattedInput
                          id="price"
                          format="currency"
                          placeholder="500000"
                          value={formData.price}
                            onChange={(value) => {
                             setFormData(prev => ({ ...prev, price: value, price_range_min: "", price_range_max: "" }));
                             if (value && String(value).trim() !== "" && Number(value) > 0) clearFieldError("price");
                           }}
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
                      <div className="space-y-2">
                        <Label>Price Range (optional)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <FormattedInput
                            id="price_range_min"
                            format="currency"
                            placeholder="Low end (e.g. 350000)"
                            value={formData.price_range_min}
                             onChange={(value) => {
                               setFormData(prev => {
                                 const next = { ...prev, price_range_min: value, price: "" };
                                 if (value && Number(value) > 0 && next.price_range_max && Number(next.price_range_max) > 0) clearFieldError("price");
                                 return next;
                               });
                             }}
                             decimals={0}
                          />
                          <FormattedInput
                            id="price_range_max"
                            format="currency"
                            placeholder="High end (e.g. 425000)"
                            value={formData.price_range_max}
                             onChange={(value) => {
                               setFormData(prev => {
                                 const next = { ...prev, price_range_max: value, price: "" };
                                 if (value && Number(value) > 0 && next.price_range_min && Number(next.price_range_min) > 0) clearFieldError("price");
                                 return next;
                               });
                             }}
                             decimals={0}
                          />
                        </div>
                         <p className="text-xs text-muted-foreground">Entering a range will clear the list price (and vice versa)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={cn("space-y-2 max-w-xs", hasFieldError("monthly_rent") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-2 shadow-none")}>
                        <Label htmlFor="monthly_rent">Monthly Rent *</Label>
                        <FormattedInput
                          id="monthly_rent"
                          format="currency"
                          placeholder="2000"
                          value={formData.monthly_rent}
                          onChange={(value) => {
                            setFormData(prev => ({ ...prev, monthly_rent: value }));
                            if (value && String(value).trim() !== "" && Number(value) > 0) clearFieldError("monthly_rent");
                          }}
                          decimals={0}
                          required
                        />
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

                {/* Property Details */}
                <div className="space-y-4 border-t border-zinc-100 pt-6">
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
                  <div className="mt-6 space-y-3 pb-10">
                    <Label htmlFor="description">Property Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={6}
                      placeholder="Describe the property features, location highlights, and any special details..."
                      className="min-h-[9.75rem]"
                    />
                  </div>
                </div>

                {/* Tax Information Section — sales only */}
                {formData.listing_type === "for_sale" && (
                <div className="space-y-4 border-t border-zinc-100 pt-6">
                  <Label className={agentSectionTitle}>Tax Information</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="annual_property_tax">Taxes</Label>
                      <FormattedInput
                        id="annual_property_tax"
                        format="currency"
                        value={formData.annual_property_tax}
                        onChange={(val) => setFormData(prev => ({ ...prev, annual_property_tax: val }))}
                        placeholder="$0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="assessed_value">Assessed Value</Label>
                      <FormattedInput
                        id="assessed_value"
                        format="currency"
                        value={formData.assessed_value}
                        onChange={(val) => setFormData(prev => ({ ...prev, assessed_value: val }))}
                        placeholder="$0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fiscal_year">Fiscal Year</Label>
                      <Input
                        id="fiscal_year"
                        type="number"
                        value={formData.fiscal_year}
                        onChange={(e) => setFormData(prev => ({ ...prev, fiscal_year: e.target.value }))}
                        placeholder="2025"
                        min="1900"
                        max="2100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="residential_exemption">Residential Exemption</Label>
                      <Select
                        value={formData.residential_exemption}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, residential_exemption: val }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                )}

                {/* Multi-Family FOR SALE Fields */}
                {formData.listing_type === "for_sale" && formData.property_type === "multi_family" && (
                  <div className="space-y-6 border-t border-zinc-100 pt-6">
                    <Label className={agentSectionTitle}>Multi-Family Building Details</Label>
                    
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
                      <Label className={agentSectionTitle}>Building Totals</Label>
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
                      <Label className={agentSectionTitle}>Laundry</Label>
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
                        <Label className={agentSectionTitle}>Unit Mix</Label>
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
                          <Card key={index} className="rounded-xl border-zinc-200/95 p-4">
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
                  <div className="space-y-4 border-t border-zinc-100 pt-6">
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
                      <Label className={agentSectionTitle}>Rental Features</Label>
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
                <div className="space-y-6 border-t border-zinc-100 pt-6">
                  <Label className={agentSectionTitle}>Property Features</Label>
                  
                  {/* Basic Features */}
                  <div className="space-y-3">
                    <Label className={agentSectionTitle}>Basic Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        'Hardwood floors', 'Granite countertops', 'Stainless appliances',
                        'Updated kitchen', 'Updated bathrooms', 'Fireplace',
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
                    <Label className={agentSectionTitle}>Interior Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {["Air Conditioning", "Window AC", "Ceiling Fans", "Wood Stove", "High Ceilings", "Walk-In Closet", "Pantry", "Sunroom", "Bonus Room / Office", "Wet Bar", "Sauna", "Central Vacuum", "Skylights", "Mudroom", "In-Home Laundry"].map((feature) => (
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
                    <Label className={agentSectionTitle}>Exterior Features</Label>
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
                      <Label className={agentSectionTitle}>Community Features</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {["Elevator", "Storage", "Roof Deck", "Fitness Center", "Clubhouse / Community Room", "Bike Storage", "Security System", "On-Site Management", "Concierge", "Dog Park", "Trash Removal", "Snow Removal", "Professional Landscaping", "EV Charging", "Package Room", "Common Laundry"].map((feature) => (
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
                    <Label className={agentSectionTitle}>Location Features</Label>
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
                    <div className="space-y-3 border-t border-zinc-100 pt-6">
                      <Label className={agentSectionTitle}>Multi-Family Features</Label>
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

                {/* Parking Section */}
                <div className="space-y-4 border-t border-zinc-100 pt-6">
                  <Label className={agentSectionTitle}>Parking</Label>
                  
                  {/* # of Parking Spaces */}
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="parking_spaces"># of Parking Spaces</Label>
                    <Input
                      id="parking_spaces"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.parking_spaces}
                      onChange={(e) => setFormData(prev => ({ ...prev, parking_spaces: e.target.value }))}
                    />
                  </div>

                  {/* Parking Features */}
                  <div className="space-y-3">
                    <Label className={agentSectionTitle}>Parking Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {["Assigned", "Deeded", "Off-Street", "On-Street", "Tandem", "Valet", "Carport", "Covered", "Uncovered", "Guest Parking"].map((feature) => (
                        <div key={feature} className="flex items-center space-x-2">
                          <Checkbox
                            id={`parking-${feature}`}
                            checked={parkingFeatures.includes(feature)}
                            onCheckedChange={(isChecked) => {
                              if (isChecked === true) {
                                setParkingFeatures(prev => Array.from(new Set([...prev, feature])));
                              } else {
                                setParkingFeatures(prev => prev.filter(f => f !== feature));
                              }
                            }}
                          />
                          <Label htmlFor={`parking-${feature}`} className="font-normal cursor-pointer">
                            {feature}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Parking Comments */}
                  <div className="space-y-2">
                    <Label htmlFor="parking_comments">Parking Comments (optional)</Label>
                    <Textarea
                      id="parking_comments"
                      placeholder="Additional parking notes..."
                      value={formData.parking_comments}
                      onChange={(e) => setFormData(prev => ({ ...prev, parking_comments: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  {/* # of Garage Spaces */}
                  <div className="space-y-2 max-w-xs border-t border-zinc-100 pt-4">
                    <Label htmlFor="garage_spaces"># of Garage Spaces</Label>
                    <Input
                      id="garage_spaces"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.garage_spaces}
                      onChange={(e) => setFormData(prev => ({ ...prev, garage_spaces: e.target.value }))}
                    />
                  </div>

                  {/* Garage Features */}
                  <div className="space-y-3">
                    <Label className={agentSectionTitle}>Garage Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {["Attached", "Detached", "Heated", "Under", "Oversized", "Electric Door", "Storage Above", "EV Charger"].map((feature) => (
                        <div key={feature} className="flex items-center space-x-2">
                          <Checkbox
                            id={`garage-${feature}`}
                            checked={garageFeatures.includes(feature)}
                            onCheckedChange={(isChecked) => {
                              if (isChecked === true) {
                                setGarageFeatures(prev => Array.from(new Set([...prev, feature])));
                              } else {
                                setGarageFeatures(prev => prev.filter(f => f !== feature));
                              }
                            }}
                          />
                          <Label htmlFor={`garage-${feature}`} className="font-normal cursor-pointer">
                            {feature}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Garage Comments */}
                  <div className="space-y-2">
                    <Label htmlFor="garage_comments">Garage Comments (optional)</Label>
                    <Textarea
                      id="garage_comments"
                      placeholder="Additional garage notes..."
                      value={formData.garage_comments}
                      onChange={(e) => setFormData(prev => ({ ...prev, garage_comments: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  {/* Total Parking (computed) */}
                  <div className="space-y-2 max-w-xs border-t border-zinc-100 pt-4">
                    <Label htmlFor="total_parking">Total Parking</Label>
                    <Input
                      id="total_parking"
                      type="number"
                      readOnly
                      className="border-zinc-200 bg-zinc-50 text-zinc-800"
                      value={(Number(formData.parking_spaces) || 0) + (Number(formData.garage_spaces) || 0) || ""}
                    />
                  </div>
                </div>

                {/* Disclosures - Simplified */}
                <div className="space-y-4 border-t border-zinc-100 pt-6">
                  <Label className={agentSectionTitle}>Disclosures</Label>
                  
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

                {/* Listing / Rental Agreement Type */}
                <div className="space-y-2 border-t border-zinc-100 pt-6">
                  <Label className={agentSectionTitle}>{listingAgreementSectionTitle(formData.listing_type)}</Label>
                  <div className={cn("space-y-3 max-w-md", hasFieldError("listing_agreement_type") && "rounded-lg border border-red-200 ring-1 ring-red-200/80 bg-white p-3 shadow-none")}>
                    <Label>
                      {listingAgreementTypeLabel(formData.listing_type)} <span className="text-destructive">*</span>
                    </Label>
                    {listingAgreementOptions(formData.listing_type).map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <Checkbox
                          checked={formData.listing_agreement_type === option.value}
                          onCheckedChange={(checked) => {
                            const newValue = checked ? option.value : "";
                            setFormData(prev => ({
                              ...prev,
                              listing_agreement_type: newValue,
                            }));
                            if (newValue) {
                              clearFieldError("listing_agreement_type");
                            }
                          }}
                        />
                        <span className="text-sm text-foreground group-hover:text-foreground/80">
                          {option.label}
                        </span>
                      </label>
                    ))}
                    {!formData.listing_agreement_type && hasFieldError("listing_agreement_type") && (
                      <p className="text-sm text-destructive">
                        Please select a {listingAgreementTypeLabel(formData.listing_type).toLowerCase()}.
                      </p>
                    )}
                  </div>
                </div>

                {/* Buyer Agent Compensation - For Sale only */}
                {formData.listing_type === "for_sale" && (
                  <div className="space-y-4 border-t border-zinc-100 pt-6">
                    <Label className={agentSectionTitle}>Buyer Agent Compensation</Label>
                    <p className="text-sm text-muted-foreground -mt-2">Offered from the seller</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end md:gap-4">
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="commission_type">Compensation Type</Label>
                        <Select
                          value={formData.commission_type}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              commission_type: value,
                              commission_rate: "",
                            }))
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="flat_fee">Flat Fee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2 md:max-w-[10.5rem]">
                        <Label htmlFor="commission_rate">
                          {formData.commission_type === 'percentage' ? 'Rate (%)' : 'Flat Amount ($)'}
                        </Label>
                        <div className="relative w-full">
                          <span
                            className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-sm font-medium tabular-nums text-muted-foreground"
                            aria-hidden
                          >
                            {formData.commission_type === "percentage" ? "%" : "$"}
                          </span>
                          {formData.commission_type === "flat_fee" ? (
                            <Input
                              key="commission_rate_flat"
                              id="commission_rate"
                              name="buyer_agent_commission_rate"
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="5,000"
                              value={commissionFlatFeeDisplay(formData.commission_rate)}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  commission_rate: commissionFlatFeeDigitsFromInput(e.target.value),
                                }))
                              }
                              className={cn(
                                "h-9 w-full py-1 pl-7 pr-2",
                                "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              )}
                            />
                          ) : (
                            <Input
                              key="commission_rate_pct"
                              id="commission_rate"
                              name="buyer_agent_commission_rate"
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="2.5"
                              value={formData.commission_rate}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, commission_rate: e.target.value }))
                              }
                              autoComplete="off"
                              className={cn(
                                "h-9 w-full py-1 pl-7 pr-2",
                                "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              )}
                            />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-7">
                        <Label htmlFor="commission_notes">Compensation Notes</Label>
                        <Input
                          id="commission_notes"
                          className="h-9"
                          placeholder="Additional compensation details"
                          value={formData.commission_notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, commission_notes: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Showing Instructions */}
                <div className="space-y-5 border-t border-zinc-100 pt-8 pb-10">
                  <Label className={agentSectionTitle}>Showing Instructions</Label>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="showing_instructions">Instructions</Label>
                      <Textarea
                        id="showing_instructions"
                        placeholder="Please call 24 hours in advance. Remove shoes..."
                        value={formData.showing_instructions}
                        onChange={(e) => setFormData(prev => ({ ...prev, showing_instructions: e.target.value }))}
                        rows={4}
                        className="min-h-[7.75rem]"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
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
                <div className="mt-2 space-y-4 border-t border-zinc-100 pt-12 pb-4">
                  <Label htmlFor="additional_notes">Additional Notes</Label>
                  <Textarea
                    id="additional_notes"
                    placeholder="Any other important information about the property..."
                    value={formData.additional_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
                    rows={5}
                    className="min-h-[8.75rem]"
                  />
                </div>

                {/* Media & Documents */}
                <div className="space-y-6 border-t border-zinc-100 pt-6">
                  <Label className={agentSectionTitle}>Media & Documents</Label>
                  
                  {/* Property Links */}
                  <div className="space-y-4">
                    <Label className={agentSectionTitle}>Property Links</Label>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="property_website_url">Property Website URL</Label>
                        <Input
                          id="property_website_url"
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          placeholder="www.example.com/listing or https://…"
                          value={formData.property_website_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, property_website_url: e.target.value }))}
                        />
                        {formData.property_website_url && !isPlausibleWebUrl(formData.property_website_url) && (
                          <p className="text-sm text-destructive">Enter a valid web address (https:// added automatically when you save)</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="virtual_tour_url">Virtual Tour URL</Label>
                        <Input
                          id="virtual_tour_url"
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          placeholder="my.matterport.com/show/… or vimeo.com/…"
                          value={formData.virtual_tour_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, virtual_tour_url: e.target.value }))}
                        />
                        {formData.virtual_tour_url && !isPlausibleWebUrl(formData.virtual_tour_url) && (
                          <p className="text-sm text-destructive">Enter a valid web address (https:// added automatically when you save)</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="video_url">Video URL</Label>
                        <Input
                          id="video_url"
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          placeholder="youtu.be/… or youtube.com/watch?v=…"
                          value={formData.video_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                        />
                        {formData.video_url && !isPlausibleWebUrl(formData.video_url) && (
                          <p className="text-sm text-destructive">Enter a valid web address (https:// added automatically when you save)</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('video-upload')?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Video File
                          </Button>
                          <p className="text-xs text-muted-foreground">Or upload a video file directly (MP4, MOV, WebM)</p>
                        </div>
                        <input
                          id="video-upload"
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 100 * 1024 * 1024) {
                              toast.error("Video must be under 100MB");
                              return;
                            }
                            try {
                              toast.info("Uploading video...");
                              const filePath = `${user?.id}/${Date.now()}_${file.name}`;
                              const { error: uploadError } = await supabase.storage
                                .from("listing-documents")
                                .upload(filePath, file);
                              if (uploadError) throw uploadError;
                              const { data: { publicUrl } } = supabase.storage
                                .from("listing-documents")
                                .getPublicUrl(filePath);
                              setFormData(prev => ({ ...prev, video_url: publicUrl }));
                              toast.success("Video uploaded!");
                            } catch (err: any) {
                              console.error("Video upload error:", err);
                              toast.error(`Video upload failed: ${err.message}`);
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Property Photos - Auto-Navigate to Management Page */}
                  {/* Photos Section */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Label className={agentSectionTitle}>Property Photos</Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Upload and manage photos on a dedicated page.
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={ADD_LISTING_MEDIA_OUTLINE_BUTTON_CLASS}
                          onClick={() => document.getElementById("photo-upload")?.click()}
                          disabled={isUploadingPhotos}
                        >
                          {isUploadingPhotos ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                              Uploading…
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                              Upload Photos
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={ADD_LISTING_MEDIA_OUTLINE_BUTTON_CLASS}
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
                        <p className="text-sm font-medium text-zinc-900">
                          {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {photos.map((photo, index) => (
                            <div key={photo.id} className="group relative aspect-video overflow-hidden rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                              <img 
                                src={photo.preview || photo.url} 
                                alt={`Photo ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {index === 0 && (
                                <span className="absolute left-1 top-1 rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                                  Main
                                </span>
                              )}
                              <button
                                type="button"
                                aria-label={`Remove photo ${index + 1}`}
                                onClick={() => handleRemovePhoto(photo.id)}
                                className="absolute right-1 top-1 z-10 rounded-full bg-black/55 p-1 text-white transition-colors hover:bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                              >
                                <X className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Click "Upload Photos" to add photos. You'll be taken to a dedicated page to manage, reorder, and delete photos.
                      </p>
                    )}
                  </div>

                  {/* Floor Plans */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Label className={agentSectionTitle}>Floor Plans</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={ADD_LISTING_MEDIA_OUTLINE_BUTTON_CLASS}
                          onClick={() => document.getElementById("floorplan-upload")?.click()}
                        >
                          <Upload className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                          Upload Floor Plans
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={ADD_LISTING_MEDIA_OUTLINE_BUTTON_CLASS}
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
                          <div key={plan.id} className="group relative overflow-hidden rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                            {plan.preview ? (
                              <img src={plan.preview} alt="Floor plan" className="w-full h-40 object-cover" />
                            ) : (
                              <div className="flex h-40 w-full items-center justify-center bg-zinc-50">
                                <FileText className="h-10 w-10 text-zinc-400" aria-hidden />
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

                  {/* Documents — staged add: type + file + explicit Add; list below */}
                  <div className="space-y-4 border-t border-zinc-100 pt-6 pb-8">
                    <div>
                      <Label className={agentSectionTitle}>Documents</Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select the document type, use Upload Documents to pick a file, then click Add document. Files upload to storage when you save or publish the listing.
                      </p>
                    </div>

                    <div className="rounded-lg border border-zinc-200/90 bg-zinc-50/50 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="document-type-select" className="text-xs font-medium text-neutral-700">
                            Document type
                          </Label>
                          <Select
                            value={pendingDocumentType || undefined}
                            onValueChange={(value) => {
                              setPendingDocumentType(value);
                              if (value !== "other") setPendingDocumentCustomLabel("");
                            }}
                          >
                            <SelectTrigger id="document-type-select" className={`bg-white border-neutral-200 ${addListingFormChrome}`}>
                              <SelectValue placeholder="Select type…" />
                            </SelectTrigger>
                            <SelectContent className="z-50 bg-white">
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

                        {pendingDocumentType === "other" ? (
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="document-custom-label" className="text-xs font-medium text-neutral-700">
                              Custom document name
                            </Label>
                            <Input
                              id="document-custom-label"
                              className={`bg-white ${addListingFormChrome}`}
                              placeholder="e.g. HOA addendum, easement agreement…"
                              value={pendingDocumentCustomLabel}
                              onChange={(e) => setPendingDocumentCustomLabel(e.target.value)}
                            />
                          </div>
                        ) : null}

                        <div className="space-y-2 sm:col-span-2">
                          <span className="text-xs font-medium text-neutral-700">File</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={ADD_LISTING_MEDIA_OUTLINE_BUTTON_CLASS}
                              onClick={() => pendingDocumentInputRef.current?.click()}
                            >
                              <Upload className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                              Upload Documents
                            </Button>
                            <span
                              className="min-w-0 max-w-full truncate text-sm text-muted-foreground sm:max-w-md"
                              title={pendingDocumentFile?.name}
                            >
                              {pendingDocumentFile ? pendingDocumentFile.name : "No file selected"}
                            </span>
                          </div>
                          <input
                            ref={pendingDocumentInputRef}
                            id="document-upload-pending"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handlePendingDocumentFileChange}
                            className="hidden"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40 disabled:opacity-50"
                          disabled={!canAddPendingDocument}
                          onClick={handleAddPendingDocument}
                        >
                          Add document
                        </Button>
                        {pendingDocumentType || pendingDocumentFile || pendingDocumentCustomLabel ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-neutral-600 hover:text-neutral-900"
                            onClick={() => {
                              setPendingDocumentType("");
                              setPendingDocumentFile(null);
                              setPendingDocumentCustomLabel("");
                            }}
                          >
                            Clear selection
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {documents.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-neutral-800">Added documents</p>
                        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                          {documents.map((doc) => (
                            <li key={doc.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-neutral-900">{doc.file.name}</p>
                                  <p className="text-xs text-muted-foreground">{addListingDocumentTypeDisplay(doc)}</p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-zinc-200"
                                onClick={() => handleRemoveFile(doc.id, "documents")}
                              >
                                <X className="mr-1.5 h-4 w-4" aria-hidden />
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No documents added yet.</p>
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
                <thead className="border-b border-zinc-200 bg-zinc-50/90">
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
                    <tr key={record.attom_id || index} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50/80">
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

              <div className="rounded-lg border border-zinc-200/90 bg-white p-3 text-base font-medium text-zinc-900 shadow-[inset_0_1px_0_rgba(0,0,0,0.03)]">
                <p>{`${attomPendingRecord.address || formData.address}${formData.unit_number ? ` #${formData.unit_number}` : ''}`}</p>
                <p>{`${attomPendingRecord.city || formData.city}, ${attomPendingRecord.state || formData.state} ${attomPendingRecord.zip || formData.zip_code}`}</p>
              </div>

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
    </>
  );
};

export default AddListing;
