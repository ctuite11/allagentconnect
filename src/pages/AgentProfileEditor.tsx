import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { toast } from "sonner";
import { 
  Trash2, Plus, Star, X, MapPin, ArrowLeft, User, FileText, 
  Share2, MessageSquare, Eye, ExternalLink, Users
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";
import { getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";
import { getZipCodesForCity, hasZipCodeData } from "@/data/usZipCodesByCity";

// New components
import ProfilePreviewPanel from "@/components/profile-editor/ProfilePreviewPanel";
import ProfilePhotoUpload from "@/components/profile-editor/ProfilePhotoUpload";
import CompanyLogoUpload from "@/components/profile-editor/CompanyLogoUpload";
import SocialLinksSection from "@/components/profile-editor/SocialLinksSection";
import IncentivesSection from "@/components/profile-editor/IncentivesSection";
import TestimonialCard from "@/components/profile-editor/TestimonialCard";


interface SocialLinks {
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
  website: string;
}

interface Testimonial {
  id: string;
  client_name: string;
  client_title: string;
  testimonial_text: string;
  rating: number;
}

interface CoverageArea {
  id: string;
  zip_code: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  county: string | null;
}

const AgentProfileEditor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [bio, setBio] = useState("");
  const [buyerIncentives, setBuyerIncentives] = useState("");
  const [sellerIncentives, setSellerIncentives] = useState("");
  const [aacId, setAacId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [cellPhone, setCellPhone] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [officeCity, setOfficeCity] = useState("");
  const [officeState, setOfficeState] = useState("");
  const [officeZip, setOfficeZip] = useState("");
  const [teamName, setTeamName] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [useAddressAutocomplete, setUseAddressAutocomplete] = useState(true);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    linkedin: "",
    twitter: "",
    facebook: "",
    instagram: "",
    website: "",
  });
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [newTestimonial, setNewTestimonial] = useState({
    client_name: "",
    client_title: "",
    testimonial_text: "",
    rating: 5,
  });
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [newCoverageState, setNewCoverageState] = useState("");
  const [newCoverageCounty, setNewCoverageCounty] = useState("");
  const [newCoverageCity, setNewCoverageCity] = useState("");
  const [newCoverageZips, setNewCoverageZips] = useState<string[]>(["", "", ""]);
  const [suggestedZips, setSuggestedZips] = useState<string[]>([]);
  const [suggestedZipsLoading, setSuggestedZipsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);
    await loadProfile(session.user.id);
  };

  const loadProfile = async (userId: string) => {
    try {
      let { data: profile, error: profileError } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: newProfile, error: insertError } = await supabase
          .from("agent_profiles")
          .insert({
            id: userId,
            email: session?.user?.email || "",
            first_name: "",
            last_name: "",
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        profile = newProfile;
      } else if (profileError) {
        throw profileError;
      }

      if (profile) {
        setBio(profile.bio || "");
        setBuyerIncentives(profile.buyer_incentives || "");
        setSellerIncentives(profile.seller_incentives || "");
        setAacId(profile.aac_id || null);
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setTitle(profile.title || "");
        setEmail(profile.email || "");
        setOfficePhone(profile.office_phone || "");
        setCellPhone(profile.cell_phone || "");
        setOfficeName(profile.office_name || "");
        setOfficeAddress(profile.office_address || "");
        setOfficeCity(profile.office_city || "");
        setOfficeState(profile.office_state || "");
        setOfficeZip(profile.office_zip || "");
        setTeamName(profile.company || "");
        setHeadshotUrl(profile.headshot_url || "");
        setLogoUrl(profile.logo_url || "");
        const links = profile.social_links as unknown as SocialLinks;
        setSocialLinks(links || {
          linkedin: "",
          twitter: "",
          facebook: "",
          instagram: "",
          website: "",
        });
      }

      const { data: testimonialData, error: testimonialError } = await supabase
        .from("testimonials")
        .select("*")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false });

      if (testimonialError) throw testimonialError;
      setTestimonials(testimonialData || []);

      const { data: coverageData, error: coverageError } = await supabase
        .from("agent_buyer_coverage_areas")
        .select("*")
        .eq("agent_id", userId)
        .eq("source", "profile")
        .order("created_at", { ascending: false });

      if (coverageError) throw coverageError;
      setCoverageAreas(coverageData || []);

      // Load property type preferences
      const { data: prefData } = await supabase
        .from("notification_preferences")
        .select("property_types")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (prefData?.property_types && Array.isArray(prefData.property_types)) {
        setSelectedPropertyTypes(prefData.property_types as string[]);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const saveProfileData = async (): Promise<string | null> => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { error } = await supabase
        .from("agent_profiles")
        .update({
          bio,
          buyer_incentives: buyerIncentives,
          seller_incentives: sellerIncentives,
          social_links: socialLinks as any,
          first_name: firstName,
          last_name: lastName,
          title,
          email,
          office_phone: officePhone,
          cell_phone: cellPhone,
          office_name: officeName,
          office_address: officeAddress,
          office_city: officeCity,
          office_state: officeState,
          office_zip: officeZip,
          company: teamName,
          headshot_url: headshotUrl,
          logo_url: logoUrl,
        })
        .eq("id", session.user.id);

      if (error) throw error;

      // Save property type preferences
      await supabase
        .from("notification_preferences")
        .upsert({
          user_id: session.user.id,
          property_types: selectedPropertyTypes,
        }, { onConflict: 'user_id' });

      toast.success("Profile saved successfully!");
      return session.user.id;
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
      setRedirecting(false);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    await saveProfileData();
  };

  const handleViewProfile = () => {
    if (userId) {
      window.open(`/agent/${userId}`, "_blank");
    }
  };

  const handleHeadshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHeadshot(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/headshot-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-headshots')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('agent-headshots')
        .getPublicUrl(fileName);

      setHeadshotUrl(publicUrl);
      toast.success("Headshot uploaded!");
    } catch (error) {
      console.error("Error uploading headshot:", error);
      toast.error("Failed to upload headshot");
    } finally {
      setUploadingHeadshot(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('agent-logos')
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);
      toast.success("Logo uploaded!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAddTestimonial = async () => {
    if (!newTestimonial.client_name || !newTestimonial.testimonial_text) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("testimonials")
        .insert({
          agent_id: session.user.id,
          ...newTestimonial,
        })
        .select()
        .single();

      if (error) throw error;
      
      setTestimonials([data, ...testimonials]);
      setNewTestimonial({
        client_name: "",
        client_title: "",
        testimonial_text: "",
        rating: 5,
      });
      toast.success("Testimonial added!");
    } catch (error) {
      console.error("Error adding testimonial:", error);
      toast.error("Failed to add testimonial");
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    try {
      const { error } = await supabase
        .from("testimonials")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setTestimonials(testimonials.filter((t) => t.id !== id));
      toast.success("Testimonial deleted");
    } catch (error) {
      console.error("Error deleting testimonial:", error);
      toast.error("Failed to delete testimonial");
    }
  };

  const handleAddCoverageArea = async () => {
    const validZips = newCoverageZips.filter(zip => zip.trim() !== "");
    
    if (validZips.length === 0) {
      toast.error("Please enter at least one zip code");
      return;
    }

    if (!newCoverageState || !newCoverageCity) {
      toast.error("Please select state and city");
      return;
    }

    if (coverageAreas.length + validZips.length > 3) {
      toast.error(`You can only add ${3 - coverageAreas.length} more zip code(s). Maximum 3 total.`);
      return;
    }

    const zipRegex = /^\d{5}$/;
    const invalidZips = validZips.filter(zip => !zipRegex.test(zip));
    if (invalidZips.length > 0) {
      toast.error("All zip codes must be valid 5-digit numbers");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const existingZips = coverageAreas.map(area => area.zip_code);
      const duplicates = validZips.filter(zip => existingZips.includes(zip));
      if (duplicates.length > 0) {
        toast.error(`Zip code(s) already added: ${duplicates.join(", ")}`);
        return;
      }

      const insertPromises = validZips.map(zip => 
        supabase
          .from("agent_buyer_coverage_areas")
          .insert({
            agent_id: session.user.id,
            zip_code: zip,
            city: newCoverageCity,
            state: newCoverageState,
            county: newCoverageCounty || null,
            source: "profile",
          })
          .select()
          .single()
      );

      const results = await Promise.all(insertPromises);
      
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }

      const newAreas = results.map(r => r.data).filter(Boolean);
      setCoverageAreas([...coverageAreas, ...newAreas]);
      
      setNewCoverageState("");
      setNewCoverageCounty("");
      setNewCoverageCity("");
      setNewCoverageZips(["", "", ""]);
      setSuggestedZips([]);
      
      toast.success(`${validZips.length} coverage area(s) added!`);
    } catch (error) {
      console.error("Error adding coverage area:", error);
      toast.error("Failed to add coverage area");
    }
  };

  const handleDeleteCoverageArea = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agent_buyer_coverage_areas")
        .delete()
        .eq("id", id)
        .eq("source", "profile");

      if (error) throw error;
      
      setCoverageAreas(coverageAreas.filter((area) => area.id !== id));
      toast.success("Coverage area removed");
    } catch (error) {
      console.error("Error deleting coverage area:", error);
      toast.error("Failed to remove coverage area");
    }
  };

  const handleClearAllCoverageAreas = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("agent_buyer_coverage_areas")
        .delete()
        .eq("agent_id", session.user.id)
        .eq("source", "profile");

      if (error) throw error;

      setCoverageAreas([]);
      toast.success("All coverage areas cleared");
    } catch (error: any) {
      console.error("Error clearing coverage areas:", error);
      toast.error("Failed to clear coverage areas");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">Loading profile...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/agent-dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Edit Profile</h1>
              <p className="text-muted-foreground">Customize how you appear to clients</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/manage-team")}>
              <Users className="h-4 w-4 mr-2" />
              Manage Team
            </Button>
            <Button variant="outline" onClick={handleViewProfile}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Images Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Profile Images
                </CardTitle>
                <CardDescription>Upload your photo and company logo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
                  <ProfilePhotoUpload
                    headshotUrl={headshotUrl}
                    uploadingHeadshot={uploadingHeadshot}
                    onUpload={handleHeadshotUpload}
                    onRemove={() => setHeadshotUrl("")}
                    aacId={aacId}
                  />
                  <div className="hidden sm:block w-px h-32 bg-border" />
                  <CompanyLogoUpload
                    logoUrl={logoUrl}
                    uploadingLogo={uploadingLogo}
                    onUpload={handleLogoUpload}
                    onRemove={() => setLogoUrl("")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Basic Info Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Basic Information
                </CardTitle>
                <CardDescription>Your name and professional details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Real Estate Agent, Broker, etc."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="team_name">Team / Company Name</Label>
                  <Input
                    id="team_name"
                    placeholder="Your Team or Company"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact Info Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Contact Information
                </CardTitle>
                <CardDescription>Phone numbers and office details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cell_phone">Cell Phone</Label>
                    <FormattedInput
                      id="cell_phone"
                      format="phone"
                      placeholder="1234567890"
                      value={cellPhone}
                      onChange={setCellPhone}
                    />
                  </div>
                  <div>
                    <Label htmlFor="office_phone">Office Phone</Label>
                    <FormattedInput
                      id="office_phone"
                      format="phone"
                      placeholder="1234567890"
                      value={officePhone}
                      onChange={setOfficePhone}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="office_name">Office Name</Label>
                  <Input
                    id="office_name"
                    placeholder="ABC Realty Group"
                    value={officeName}
                    onChange={(e) => setOfficeName(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="office_address">Office Address</Label>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="address-toggle" className="text-sm text-muted-foreground cursor-pointer">
                        {useAddressAutocomplete ? "Autocomplete" : "Manual"}
                      </Label>
                      <Switch
                        id="address-toggle"
                        checked={useAddressAutocomplete}
                        onCheckedChange={setUseAddressAutocomplete}
                      />
                    </div>
                  </div>
                  {useAddressAutocomplete ? (
                    <AddressAutocomplete
                      placeholder="Start typing an address..."
                      value={officeAddress}
                      onChange={setOfficeAddress}
                      onPlaceSelect={(place) => {
                        setOfficeAddress(place.formatted_address || place.name || "");
                        if (place.address_components) {
                          const components = place.address_components;
                          const cityComponent = components.find((c: any) => 
                            c.types.includes('locality') || c.types.includes('sublocality')
                          );
                          if (cityComponent) setOfficeCity(cityComponent.long_name);
                          const stateComponent = components.find((c: any) => 
                            c.types.includes('administrative_area_level_1')
                          );
                          if (stateComponent) setOfficeState(stateComponent.short_name);
                          const zipComponent = components.find((c: any) => 
                            c.types.includes('postal_code')
                          );
                          if (zipComponent) setOfficeZip(zipComponent.long_name);
                        }
                      }}
                    />
                  ) : (
                    <Input
                      id="office_address"
                      placeholder="123 Main St, Boston, MA 02101"
                      value={officeAddress}
                      onChange={(e) => setOfficeAddress(e.target.value)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bio Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  About You
                </CardTitle>
                <CardDescription>Tell clients about yourself and your expertise</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Write your professional bio here..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {bio.length} characters
                </p>
              </CardContent>
            </Card>

            {/* Incentives Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Client Incentives
                </CardTitle>
                <CardDescription>Special offers for buyers and sellers</CardDescription>
              </CardHeader>
              <CardContent>
                <IncentivesSection
                  buyerIncentives={buyerIncentives}
                  sellerIncentives={sellerIncentives}
                  onBuyerChange={setBuyerIncentives}
                  onSellerChange={setSellerIncentives}
                />
              </CardContent>
            </Card>

            {/* Social Links Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary" />
                  Social Media
                </CardTitle>
                <CardDescription>Connect your social profiles</CardDescription>
              </CardHeader>
              <CardContent>
                <SocialLinksSection
                  socialLinks={socialLinks}
                  onChange={setSocialLinks}
                />
              </CardContent>
            </Card>

            {/* Coverage Areas Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Buyer Leads
                </CardTitle>
                <CardDescription>
                  Define your coverage areas to receive buyer leads (max 3 zip codes)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Coverage Area */}
                {coverageAreas.length < 3 && (
                  <div className="border-2 border-dashed rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Coverage Area
                    </h3>
                    
                    {/* State & County - Row 1 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>State</Label>
                        <Select
                          value={newCoverageState}
                          onValueChange={(value) => {
                            setNewCoverageState(value);
                            setNewCoverageCounty("");
                            setNewCoverageCity("");
                            setNewCoverageZips(["", "", ""]);
                            setSuggestedZips([]);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((s) => (
                              <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>County (Optional)</Label>
                        <Select
                          value={newCoverageCounty}
                          onValueChange={(value) => {
                            setNewCoverageCounty(value);
                            setNewCoverageCity("");
                            setNewCoverageZips(["", "", ""]);
                            setSuggestedZips([]);
                          }}
                          disabled={!newCoverageState}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select county" />
                          </SelectTrigger>
                          <SelectContent>
                            {newCoverageState && COUNTIES_BY_STATE[newCoverageState]?.map((county) => (
                              <SelectItem key={county} value={county}>{county}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* City & Property Type - Row 2 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>City</Label>
                        <Select
                          value={newCoverageCity}
                          onValueChange={async (value) => {
                            setNewCoverageCity(value);
                            setNewCoverageZips(["", "", ""]);
                            if (!newCoverageState) return;
                            
                            setSuggestedZipsLoading(true);
                            try {
                              if (hasZipCodeData(value, newCoverageState)) {
                                const staticZips = getZipCodesForCity(value, newCoverageState);
                                setSuggestedZips(staticZips);
                              } else {
                                const { data, error } = await supabase.functions.invoke('get-city-zips', {
                                  body: { state: newCoverageState, city: value }
                                });
                                if (error) throw error;
                                setSuggestedZips(data?.zips || []);
                              }
                            } catch (err) {
                              console.error('ZIP lookup failed', err);
                              setSuggestedZips([]);
                            } finally {
                              setSuggestedZipsLoading(false);
                            }
                          }}
                          disabled={!newCoverageState}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={!newCoverageState ? "Select state first" : "Select city"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {newCoverageState && (() => {
                              if (newCoverageCounty && hasCountyCityMapping(newCoverageState)) {
                                const countyCities = getCitiesForCounty(newCoverageState, newCoverageCounty);
                                if (countyCities.length > 0) {
                                  return countyCities.map((city) => (
                                    <SelectItem key={city} value={city}>{city}</SelectItem>
                                  ));
                                }
                              }
                              return usCitiesByState[newCoverageState]?.map((city) => (
                                <SelectItem key={city} value={city}>{city}</SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Property Type</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue>
                              {selectedPropertyTypes.length > 0 
                                ? `${selectedPropertyTypes.length} type(s) selected` 
                                : "Select property types"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <div className="p-2 space-y-2">
                              {[
                                { value: "single_family", label: "Single Family" },
                                { value: "condo", label: "Condominium" },
                                { value: "townhouse", label: "Townhouse" },
                                { value: "multi_family", label: "Multi-Family" },
                                { value: "land", label: "Land" },
                                { value: "commercial", label: "Commercial" },
                                { value: "residential_rental", label: "Residential Rental" },
                                { value: "commercial_rental", label: "Commercial Rental" },
                              ].map((type) => (
                                <div key={type.value} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`pref-${type.value}`}
                                    checked={selectedPropertyTypes.includes(type.value)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedPropertyTypes([...selectedPropertyTypes, type.value]);
                                      } else {
                                        setSelectedPropertyTypes(selectedPropertyTypes.filter(t => t !== type.value));
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`pref-${type.value}`} className="cursor-pointer text-sm">
                                    {type.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Suggested Zip Codes */}
                    {suggestedZipsLoading && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Loading zip codes...</p>
                      </div>
                    )}
                    {!suggestedZipsLoading && suggestedZips.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <Label className="text-sm">Click to add a zip code</Label>
                        <div className="flex flex-wrap gap-2">
                          {suggestedZips.map((zip) => (
                            <Button
                              key={zip}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const emptyIndex = newCoverageZips.findIndex(z => !z.trim());
                                if (emptyIndex !== -1) {
                                  const newZips = [...newCoverageZips];
                                  newZips[emptyIndex] = zip;
                                  setNewCoverageZips(newZips);
                                } else {
                                  toast.error("All zip code slots are filled.");
                                }
                              }}
                              disabled={newCoverageZips.includes(zip)}
                              className="font-mono text-xs"
                            >
                              {zip}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected Zips */}
                    <div>
                      <Label>Selected Zip Codes ({coverageAreas.length}/3)</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newCoverageZips.map((zip, index) => (
                          zip.trim() && (
                            <div 
                              key={index}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg"
                            >
                              <span className="font-mono font-medium text-sm">{zip}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const newZips = [...newCoverageZips];
                                  newZips[index] = "";
                                  setNewCoverageZips(newZips);
                                }}
                                className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        ))}
                        {!newCoverageZips.some(z => z.trim()) && (
                          <p className="text-sm text-muted-foreground">No zip codes selected</p>
                        )}
                      </div>
                    </div>

                    {(newCoverageState && newCoverageCity && newCoverageZips.some(z => z.trim())) && (
                      <Button onClick={handleAddCoverageArea} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Coverage Area
                      </Button>
                    )}
                  </div>
                )}

                {/* Existing Coverage Areas */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Your Coverage Areas</h3>
                    {coverageAreas.length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleClearAllCoverageAreas}>
                        Clear All
                      </Button>
                    )}
                  </div>
                  {coverageAreas.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl">
                      <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No coverage areas added yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {coverageAreas.map((area) => (
                        <div 
                          key={area.id}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full group"
                        >
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-medium">{area.zip_code}</span>
                          <span className="text-muted-foreground text-sm">
                            {area.city}, {area.state}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCoverageArea(area.id)}
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Testimonials Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Testimonials
                </CardTitle>
                <CardDescription>Add client testimonials to build trust</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Testimonial */}
                <div className="border-2 border-dashed rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Testimonial
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="client_name">Client Name *</Label>
                      <Input
                        id="client_name"
                        placeholder="John Smith"
                        value={newTestimonial.client_name}
                        onChange={(e) => setNewTestimonial({ ...newTestimonial, client_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="client_title">Client Role (Optional)</Label>
                      <Input
                        id="client_title"
                        placeholder="First-time Homebuyer"
                        value={newTestimonial.client_title}
                        onChange={(e) => setNewTestimonial({ ...newTestimonial, client_title: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="testimonial_text">Testimonial *</Label>
                    <Textarea
                      id="testimonial_text"
                      placeholder="Write the testimonial here..."
                      value={newTestimonial.testimonial_text}
                      onChange={(e) => setNewTestimonial({ ...newTestimonial, testimonial_text: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Rating</Label>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewTestimonial({ ...newTestimonial, rating: star })}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-6 w-6 ${
                              star <= newTestimonial.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleAddTestimonial}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Testimonial
                  </Button>
                </div>

                {/* Existing Testimonials */}
                {testimonials.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No testimonials yet. Add your first one above!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {testimonials.map((testimonial) => (
                      <TestimonialCard
                        key={testimonial.id}
                        testimonial={testimonial}
                        onDelete={handleDeleteTestimonial}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Live Preview */}
          <div className="hidden lg:block">
            <ProfilePreviewPanel
              firstName={firstName}
              lastName={lastName}
              title={title}
              teamName={teamName}
              email={email}
              cellPhone={cellPhone}
              officePhone={officePhone}
              headshotUrl={headshotUrl}
              logoUrl={logoUrl}
              bio={bio}
              aacId={aacId}
              socialLinks={socialLinks}
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t shadow-lg z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground hidden sm:block">
            {saving ? "Saving changes..." : "Changes are not auto-saved"}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Button variant="outline" onClick={handleViewProfile} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">View Public Profile</span>
              <span className="sm:hidden">Preview</span>
            </Button>
            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentProfileEditor;
