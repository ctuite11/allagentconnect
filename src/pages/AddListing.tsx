import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Eye, Upload, X, Image as ImageIcon, FileText, GripVertical } from "lucide-react";
import { z } from "zod";
import listingIcon from "@/assets/listing-creation-icon.png";

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
  price: z.number().min(1000, "Price must be at least $1,000").max(100000000, "Price must be less than $100,000,000"),
  property_type: z.string().optional(),
  bedrooms: z.number().int().min(0, "Bedrooms must be 0 or more").max(50, "Bedrooms must be 50 or less").optional(),
  bathrooms: z.number().min(0, "Bathrooms must be 0 or more").max(50, "Bathrooms must be 50 or less").optional(),
  square_feet: z.number().int().min(1, "Square feet must be at least 1").max(100000, "Square feet must be less than 100,000").optional(),
  year_built: z.number().int().min(1800, "Year built must be 1800 or later").max(new Date().getFullYear() + 1, "Year built cannot be in the future").optional(),
  lot_size: z.number().min(0, "Lot size must be 0 or more").max(10000, "Lot size must be less than 10,000 acres").optional(),
  description: z.string().max(5000, "Description must be less than 5,000 characters").optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

const AddListing = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    status: "active",
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
  });

  const [photos, setPhotos] = useState<FileWithPreview[]>([]);
  const [floorPlans, setFloorPlans] = useState<FileWithPreview[]>([]);
  const [documents, setDocuments] = useState<FileWithPreview[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

  const handleAddressSelect = async (place: google.maps.places.PlaceResult) => {
    const addressComponents = place.address_components || [];
    const getComponent = (type: string) => {
      const component = addressComponents.find((c) => c.types.includes(type));
      return component?.long_name || "";
    };

    const address = place.formatted_address?.split(",")[0] || "";
    const city = getComponent("locality") || getComponent("sublocality");
    const state = getComponent("administrative_area_level_1");
    const zip_code = getComponent("postal_code");
    const latitude = place.geometry?.location?.lat() || null;
    const longitude = place.geometry?.location?.lng() || null;

    setFormData({
      ...formData,
      address,
      city,
      state,
      zip_code,
      latitude,
      longitude,
    });

    // Fetch property data from Attom API
    if (latitude && longitude) {
      await fetchPropertyData(latitude, longitude, address, city, state, zip_code);
    }
  };

  const fetchPropertyData = async (lat: number, lng: number, address: string, city: string, state: string, zip: string) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-property-data", {
        body: { latitude: lat, longitude: lng, address, city, state, zip_code: zip },
      });

      if (error) throw error;

      if (data) {
        // Autofill form with Attom data
        if (data.attom) {
          setFormData(prev => ({
            ...prev,
            bedrooms: data.attom.bedrooms?.toString() || prev.bedrooms,
            bathrooms: data.attom.bathrooms?.toString() || prev.bathrooms,
            square_feet: data.attom.square_feet?.toString() || prev.square_feet,
            lot_size: data.attom.lot_size?.toString() || prev.lot_size,
            year_built: data.attom.year_built?.toString() || prev.year_built,
            property_type: data.attom.property_type || prev.property_type,
          }));
        }
        toast.success("Property data loaded successfully");
      }
    } catch (error: any) {
      console.error("Error fetching property data:", error);
      toast.error("Could not fetch property data. Please enter details manually.");
    } finally {
      setSubmitting(false);
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

    // Upload photos
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

    // Upload floor plans
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

    // Upload documents
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

  const handleSaveDraft = async () => {
    toast.info("Draft saved locally");
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

      const { error } = await supabase.from("listings").insert({
        agent_id: user.id,
        status: publishNow ? formData.status : "draft",
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
        photos: uploadedFiles.photos,
        floor_plans: uploadedFiles.floorPlans,
        documents: uploadedFiles.documents,
      });

      if (error) throw error;

      toast.success("Listing created successfully!");
      navigate("/agent-dashboard");
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
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="flex items-center gap-4 mb-8">
            <h1 className="text-4xl font-bold">Create a new listing for sale.</h1>
            <img src={listingIcon} alt="Listing creation" className="w-16 h-16" />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-8">
            <Button variant="default" size="lg" onClick={handleSaveDraft} className="gap-2">
              <Save className="w-5 h-5" />
              Save as Draft
            </Button>
            <Button variant="default" size="lg" onClick={handlePreview} className="gap-2">
              <Eye className="w-5 h-5" />
              Preview Listing
            </Button>
            <Button variant="default" size="lg" onClick={(e) => handleSubmit(e, true)} disabled={submitting} className="gap-2">
              <Upload className="w-5 h-5" />
              {submitting ? "Publishing..." : "Publish Listing"}
            </Button>
          </div>

          {/* Form Card */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-6">Listing Details</h2>
              
              <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
                {/* Row 1: Status, Property Type, List Date, Expiration Date */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        <SelectItem value="active">New</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                        <SelectItem value="Land">Land</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

                {/* Row 2: List Price, Enter Address, Zip Code */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">List Price *</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="$500,000"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Enter Address *</Label>
                    <AddressAutocomplete
                      onPlaceSelect={handleAddressSelect}
                      placeholder="Listing Address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">Zip Code *</Label>
                    <Input
                      id="zip_code"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Row 3: State, County, Town, Neighborhood */}
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
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Neighborhood</Label>
                    <Input
                      id="neighborhood"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 4: City */}
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
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
                    <Input
                      id="square_feet"
                      type="number"
                      value={formData.square_feet}
                      onChange={(e) => setFormData({ ...formData, square_feet: e.target.value })}
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

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    placeholder="Describe the property features, location highlights, and any special details..."
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
                      className="gap-2"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Add Photos
                    </Button>
                  </div>
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'photos')}
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
                          className="relative group cursor-move border rounded-lg overflow-hidden bg-muted"
                        >
                          <div className="absolute top-2 left-2 z-10 bg-background/80 rounded p-1">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          {index === 0 && (
                            <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                              Main
                            </div>
                          )}
                          <img
                            src={photo.preview}
                            alt={`Property ${index + 1}`}
                            className="w-full h-32 object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveFile(photo.id, 'photos')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Floor Plans Section */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xl font-semibold">Floor Plans</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload floor plan images or PDFs
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('floorplan-upload')?.click()}
                      className="gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Add Floor Plans
                    </Button>
                  </div>
                  <Input
                    id="floorplan-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'floorplans')}
                  />
                  
                  {floorPlans.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {floorPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="relative group border rounded-lg overflow-hidden bg-muted"
                        >
                          {plan.preview ? (
                            <img
                              src={plan.preview}
                              alt={plan.file.name}
                              className="w-full h-32 object-cover"
                            />
                          ) : (
                            <div className="w-full h-32 flex items-center justify-center">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-background/90 p-2 text-xs truncate">
                            {plan.file.name}
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveFile(plan.id, 'floorplans')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documents Section */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xl font-semibold">Documents</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload property documents (PDF, Word)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('document-upload')?.click()}
                      className="gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Add Documents
                    </Button>
                  </div>
                  <Input
                    id="document-upload"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'documents')}
                  />
                  
                  {documents.length > 0 && (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-muted"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm">{doc.file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(doc.file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFile(doc.id, 'documents')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AddListing;
