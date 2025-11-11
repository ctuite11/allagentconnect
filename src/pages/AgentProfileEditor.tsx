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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { toast } from "sonner";
import { Trash2, Plus, Star, Upload, X, MapPin } from "lucide-react";
import Navigation from "@/components/Navigation";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";

import { getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";

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

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await loadProfile(session.user.id);
  };

  const loadProfile = async (userId: string) => {
    try {
      let { data: profile, error: profileError } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // If profile doesn't exist, create it
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

      // Load coverage areas
      const { data: coverageData, error: coverageError } = await supabase
        .from("agent_buyer_coverage_areas")
        .select("*")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false });

      if (coverageError) throw coverageError;
      setCoverageAreas(coverageData || []);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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
          headshot_url: headshotUrl,
          logo_url: logoUrl,
        })
        .eq("id", session.user.id);

      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
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
    // Filter out empty zip codes
    const validZips = newCoverageZips.filter(zip => zip.trim() !== "");
    
    if (validZips.length === 0) {
      toast.error("Please enter at least one zip code");
      return;
    }

    if (!newCoverageState || !newCoverageCity) {
      toast.error("Please select state and city");
      return;
    }

    // Check if adding these would exceed the limit
    if (coverageAreas.length + validZips.length > 3) {
      toast.error(`You can only add ${3 - coverageAreas.length} more zip code(s). Maximum 3 total.`);
      return;
    }

    // Basic zip code validation (5 digits)
    const zipRegex = /^\d{5}$/;
    const invalidZips = validZips.filter(zip => !zipRegex.test(zip));
    if (invalidZips.length > 0) {
      toast.error("All zip codes must be valid 5-digit numbers");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check for duplicate zip codes
      const existingZips = coverageAreas.map(area => area.zip_code);
      const duplicates = validZips.filter(zip => existingZips.includes(zip));
      if (duplicates.length > 0) {
        toast.error(`Zip code(s) already added: ${duplicates.join(", ")}`);
        return;
      }

      // Insert all valid zip codes
      const insertPromises = validZips.map(zip => 
        supabase
          .from("agent_buyer_coverage_areas")
          .insert({
            agent_id: session.user.id,
            zip_code: zip,
            city: newCoverageCity,
            state: newCoverageState,
            county: newCoverageCounty || null,
          })
          .select()
          .single()
      );

      const results = await Promise.all(insertPromises);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }

      // Add all new coverage areas
      const newAreas = results.map(r => r.data).filter(Boolean);
      setCoverageAreas([...coverageAreas, ...newAreas]);
      
      // Reset form
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
        .eq("id", id);

      if (error) throw error;
      
      setCoverageAreas(coverageAreas.filter((area) => area.id !== id));
      toast.success("Coverage area removed");
    } catch (error) {
      console.error("Error deleting coverage area:", error);
      toast.error("Failed to remove coverage area");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Edit Your Profile</h1>
              {aacId && (
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {aacId}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/manage-team")}>
                Manage Team
              </Button>
              <Button variant="outline" onClick={() => navigate("/agent-dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </div>

          {/* Contact Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Update your contact details and office information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cell_phone">Cell Phone</Label>
                  <FormattedInput
                    id="cell_phone"
                    format="phone"
                    placeholder="5559876543"
                    value={cellPhone}
                    onChange={setCellPhone}
                  />
                </div>
                <div>
                  <Label htmlFor="office_phone">Office Phone</Label>
                  <FormattedInput
                    id="office_phone"
                    format="phone"
                    placeholder="5551234567"
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
                      {useAddressAutocomplete ? "Use autocomplete" : "Manual entry"}
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
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Contact Info"}
              </Button>
            </CardContent>
          </Card>

          {/* Profile Images */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Profile Images</CardTitle>
              <CardDescription>Upload your headshot and company logo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Headshot</Label>
                <div className="mt-2 space-y-4">
                  {headshotUrl && (
                    <div className="relative inline-block">
                      <img
                        src={headshotUrl}
                        alt="Headshot"
                        className="w-48 h-64 rounded-lg object-cover border-4 border-border"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => setHeadshotUrl("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleHeadshotUpload}
                      disabled={uploadingHeadshot}
                      className="hidden"
                      id="headshot-upload"
                    />
                    <Label
                      htmlFor="headshot-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingHeadshot ? "Uploading..." : "Upload Headshot"}
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <Label>Company Logo</Label>
                <div className="mt-2 space-y-4">
                  {logoUrl && (
                    <div className="relative inline-block">
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-48 h-32 rounded-lg object-contain border-2 border-border bg-muted p-2"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => setLogoUrl("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Label
                      htmlFor="logo-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingLogo ? "Uploading..." : "Upload Logo"}
                    </Label>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Images"}
              </Button>
            </CardContent>
          </Card>

          {/* Bio Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Your Bio</CardTitle>
              <CardDescription>Tell clients about yourself and your expertise</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Write your professional bio here..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={6}
                className="mb-4"
              />
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Bio"}
              </Button>
            </CardContent>
          </Card>

          {/* Incentives Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Client Incentives</CardTitle>
              <CardDescription>Highlight special offers or incentives you provide to clients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="buyer_incentives">Buyer Incentives</Label>
                <Textarea
                  id="buyer_incentives"
                  placeholder="e.g., Free home inspection, closing cost assistance, buyer rebate..."
                  value={buyerIncentives}
                  onChange={(e) => setBuyerIncentives(e.target.value)}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="seller_incentives">Seller Incentives</Label>
                <Textarea
                  id="seller_incentives"
                  placeholder="e.g., Professional photography, staging consultation, reduced commission..."
                  value={sellerIncentives}
                  onChange={(e) => setSellerIncentives(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Incentives"}
              </Button>
            </CardContent>
          </Card>

          {/* Social Links Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>Connect your social media profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  placeholder="https://linkedin.com/in/yourprofile"
                  value={socialLinks.linkedin}
                  onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="twitter">Twitter/X</Label>
                <Input
                  id="twitter"
                  placeholder="https://twitter.com/yourhandle"
                  value={socialLinks.twitter}
                  onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  placeholder="https://facebook.com/yourpage"
                  value={socialLinks.facebook}
                  onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  placeholder="https://instagram.com/yourprofile"
                  value={socialLinks.instagram}
                  onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="website">Personal Website</Label>
                <Input
                  id="website"
                  placeholder="https://yourwebsite.com"
                  value={socialLinks.website}
                  onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Social Links"}
              </Button>
            </CardContent>
          </Card>

          {/* Buyer Agent Lead Opt-In Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Buyer Agent Lead Program
              </CardTitle>
              <CardDescription>
                Opt in to receive buyer agent leads for specific zip codes. Choose up to 3 zip codes where you want to appear as a verified buyer agent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Add New Coverage Area */}
                <div className="border-2 border-dashed border-border rounded-2xl p-6 bg-muted/30 hover:border-primary/50 transition-colors">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Coverage Zip Code ({coverageAreas.length}/3)
                  </h3>
                  <div className="space-y-4">
                    {/* State Dropdown */}
                    <div>
                      <Label>State</Label>
                      <Select value={newCoverageState} onValueChange={(value) => {
                        setNewCoverageState(value);
                        setNewCoverageCounty(""); // Reset county when state changes
                        setNewCoverageCity(""); // Reset city when state changes
                        setSuggestedZips([]); // Reset suggested zips
                      }}>
                        <SelectTrigger className="h-12 bg-background">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                          {US_STATES.map((state) => (
                            <SelectItem key={state.code} value={state.code}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* County Dropdown */}
                    {newCoverageState && COUNTIES_BY_STATE[newCoverageState] && (
                      <div>
                        <Label>County / Area (Optional)</Label>
                        <Select 
                          value={newCoverageCounty} 
                          onValueChange={(value) => {
                            setNewCoverageCounty(value);
                            setNewCoverageCity(""); // Reset city when county changes
                            setSuggestedZips([]); // Reset suggested zips
                          }}
                        >
                          <SelectTrigger className="h-12 bg-background">
                            <SelectValue placeholder="Select county or area" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border border-border shadow-lg z-[100] max-h-[300px]">
                            {COUNTIES_BY_STATE[newCoverageState].map((county) => (
                              <SelectItem key={county} value={county}>
                                {county}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Selecting a county will filter available cities
                        </p>
                      </div>
                    )}

                    {/* City Dropdown */}
                    <div>
                      <Label>City</Label>
                      <Select 
                        value={newCoverageCity} 
                        onValueChange={async (value) => {
                          setNewCoverageCity(value);
                          setSuggestedZips([]);
                          if (!newCoverageState) return;
                          try {
                            setSuggestedZipsLoading(true);
                            const { data, error } = await supabase.functions.invoke('get-city-zips', {
                              body: { state: newCoverageState, city: value }
                            });
                            if (error) throw error;
                            const zips: string[] = data?.zips || [];
                            setSuggestedZips(zips);
                          } catch (err) {
                            console.error('[AgentProfileEditor] ZIP lookup failed', err);
                            setSuggestedZips([]);
                          } finally {
                            setSuggestedZipsLoading(false);
                          }
                        }}
                        disabled={!newCoverageState}
                      >
                        <SelectTrigger className="h-12 bg-background">
                          <SelectValue placeholder={
                            !newCoverageState 
                              ? "Select state first" 
                              : "Select city"
                          } />
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border shadow-lg z-[100] max-h-[300px]">
                          {newCoverageState && (() => {
                            // If county is selected and has mapping, show only cities in that county
                            if (newCoverageCounty && hasCountyCityMapping(newCoverageState)) {
                              const countyCities = getCitiesForCounty(newCoverageState, newCoverageCounty);
                              if (countyCities.length > 0) {
                                return countyCities.map((city) => (
                                  <SelectItem key={city} value={city}>
                                    {city}
                                  </SelectItem>
                                ));
                              }
                            }
                            // Otherwise show all cities for the state
                            return usCitiesByState[newCoverageState]?.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      {newCoverageCounty && hasCountyCityMapping(newCoverageState) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Showing cities in {newCoverageCounty} County
                        </p>
                      )}
                    </div>

                    {/* Suggested Zip Codes */}
                    {(suggestedZipsLoading || suggestedZips.length > 0) && (
                      <div className="border-2 border-primary/20 rounded-xl p-4 bg-primary/5">
                        <Label className="mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          Suggested Zip Codes for {newCoverageCity}
                        </Label>
                        {suggestedZipsLoading ? (
                          <p className="text-sm text-muted-foreground">Loading suggested zip codes…</p>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground mb-3">
                              Click to add zip codes (up to {3 - coverageAreas.length} more)
                            </p>
                            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                              {suggestedZips.map((zipCode) => {
                                const isAlreadyAdded = coverageAreas.some(area => area.zip_code === zipCode);
                                const isInCurrentSelection = newCoverageZips.includes(zipCode);
                                const canAdd = newCoverageZips.filter(z => z.trim()).length < 3 && 
                                              coverageAreas.length + newCoverageZips.filter(z => z.trim()).length < 3;
                                
                                return (
                              <Button
                                key={zipCode}
                                type="button"
                                variant={isInCurrentSelection ? "default" : "outline"}
                                size="sm"
                                disabled={isAlreadyAdded}
                                onClick={() => {
                                  if (isAlreadyAdded) {
                                    toast.error("This zip code is already in your coverage areas");
                                    return;
                                  }
                                  if (!isInCurrentSelection && !canAdd) {
                                    toast.error("To select an additional zip code you must delete a previously selected zip");
                                    return;
                                  }
                                  if (isInCurrentSelection) {
                                    // Remove from selection
                                    const newZips = [...newCoverageZips];
                                    const indexToRemove = newZips.indexOf(zipCode);
                                    if (indexToRemove !== -1) {
                                      newZips[indexToRemove] = "";
                                      setNewCoverageZips(newZips);
                                    }
                                  } else {
                                    // Add to first empty slot
                                    const newZips = [...newCoverageZips];
                                    const emptyIndex = newZips.findIndex(z => z.trim() === "");
                                    if (emptyIndex !== -1) {
                                      newZips[emptyIndex] = zipCode;
                                      setNewCoverageZips(newZips);
                                    }
                                  }
                                }}
                                className="font-mono"
                              >
                                {zipCode}
                                {isAlreadyAdded && " ✓"}
                              </Button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Zip Codes Input - Multiple */}
                    <div>
                      <Label>Selected Zip Codes ({newCoverageZips.filter(z => z.trim()).length}/3)</Label>
                      <div className="space-y-2">
                        {newCoverageZips.map((zip, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                            <AddressAutocomplete
                              placeholder={`Zip code ${index + 1}`}
                              value={zip}
                              types={['geocode']}
                              onChange={(value) => {
                                const zipMatch = value.match(/\b\d{5}\b/);
                                const extractedZip = zipMatch ? zipMatch[0] : value.replace(/\D/g, '').slice(0, 5);
                                const newZips = [...newCoverageZips];
                                newZips[index] = extractedZip;
                                setNewCoverageZips(newZips);
                              }}
                              onPlaceSelect={(place) => {
                                const comps = (place as any).address_components || (place as any).addressComponents || [];
                                const zipComponent = comps.find((c: any) => c.types?.includes('postal_code'));
                                let extracted = zipComponent?.short_name || zipComponent?.long_name || "";
                                if (!extracted) {
                                  const text = (place as any).formatted_address || (place as any).formattedAddress || (place as any).name || "";
                                  const match = String(text).match(/\b\d{5}\b/);
                                  extracted = match ? match[0] : "";
                                }
                                if (extracted) {
                                  const newZips = [...newCoverageZips];
                                  newZips[index] = extracted;
                                  setNewCoverageZips(newZips);
                                }
                              }}
                              className="h-12 font-mono"
                            />
                            {zip && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const newZips = [...newCoverageZips];
                                  newZips[index] = "";
                                  setNewCoverageZips(newZips);
                                }}
                                className="h-12 w-12"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {suggestedZips.length > 0 
                          ? "Click suggested zip codes above or manually enter them here"
                          : `Enter zip codes for ${newCoverageCity || "selected city"}`}
                      </p>
                    </div>

                    <Button 
                      onClick={handleAddCoverageArea}
                      disabled={
                        !newCoverageState || 
                        !newCoverageCity || 
                        newCoverageZips.every(zip => zip.trim() === "") ||
                        coverageAreas.length >= 3
                      }
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Coverage Area{newCoverageZips.filter(z => z.trim()).length > 1 ? 's' : ''}
                    </Button>

                    <p className="text-sm text-muted-foreground">
                      Select a state, optionally narrow by county, then choose city and enter up to 3 zip codes at once. Major cities will show suggested zip codes that you can click to add.
                    </p>
                  </div>
                </div>

                {/* Existing Coverage Areas */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Your Coverage Areas</h3>
                  {coverageAreas.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-2xl">
                      <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground mb-2">No coverage areas added yet</p>
                      <p className="text-sm text-muted-foreground">Add up to 3 zip codes to start receiving buyer agent leads</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {/* Group by city/county */}
                      {Object.entries(
                        coverageAreas.reduce((acc, area) => {
                          // Create a key for grouping by county + city or just city
                          const groupKey = area.county
                            ? `${area.county}, ${area.city}, ${area.state}`
                            : `${area.city}, ${area.state}`;
                          
                          if (!acc[groupKey]) {
                            acc[groupKey] = {
                              county: area.county,
                              city: area.city,
                              state: area.state,
                              areas: []
                            };
                          }
                          acc[groupKey].areas.push(area);
                          return acc;
                        }, {} as Record<string, { county: string | null; city: string | null; state: string | null; areas: CoverageArea[] }>)
                      ).map(([groupKey, group]) => (
                        <div 
                          key={groupKey} 
                          className="border-2 rounded-2xl p-4 bg-gradient-card hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                <MapPin className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-lg">
                                  {group.city}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {group.state}
                                  {group.county && ` • ${group.county} County`}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Zip codes for this city */}
                          <div className="ml-13 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              Zip Codes ({group.areas.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {group.areas.map((area) => (
                                <div 
                                  key={area.id}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg group/zip hover:border-destructive/50 transition-colors"
                                >
                                  <span className="font-mono font-medium">{area.zip_code}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteCoverageArea(area.id)}
                                    className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover/zip:opacity-100 transition-opacity"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {coverageAreas.length > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                    <p className="text-sm text-foreground">
                      ✓ You're now receiving buyer agent leads for {coverageAreas.length} zip code{coverageAreas.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Testimonials Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Testimonials</CardTitle>
              <CardDescription>Add client testimonials to build trust</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Add New Testimonial */}
              <div className="border rounded-lg p-4 mb-6 bg-muted/50">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Testimonial
                </h3>
                <div className="space-y-4">
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
                    <Label htmlFor="client_title">Client Title (Optional)</Label>
                    <Input
                      id="client_title"
                      placeholder="First-time Homebuyer"
                      value={newTestimonial.client_title}
                      onChange={(e) => setNewTestimonial({ ...newTestimonial, client_title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="testimonial_text">Testimonial *</Label>
                    <Textarea
                      id="testimonial_text"
                      placeholder="Write the testimonial here..."
                      value={newTestimonial.testimonial_text}
                      onChange={(e) => setNewTestimonial({ ...newTestimonial, testimonial_text: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rating">Rating (1-5 stars)</Label>
                    <Input
                      id="rating"
                      type="number"
                      min="1"
                      max="5"
                      value={newTestimonial.rating}
                      onChange={(e) => setNewTestimonial({ ...newTestimonial, rating: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <Button onClick={handleAddTestimonial}>Add Testimonial</Button>
                </div>
              </div>

              {/* Existing Testimonials */}
              <div className="space-y-4">
                <h3 className="font-semibold">Your Testimonials</h3>
                {testimonials.length === 0 ? (
                  <p className="text-muted-foreground">No testimonials yet. Add your first one above!</p>
                ) : (
                  testimonials.map((testimonial) => (
                    <div key={testimonial.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">{testimonial.client_name}</p>
                          {testimonial.client_title && (
                            <p className="text-sm text-muted-foreground">{testimonial.client_title}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTestimonial(testimonial.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                        ))}
                      </div>
                      <p className="text-sm">{testimonial.testimonial_text}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Publish Profile Section */}
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Publish?</CardTitle>
              <CardDescription>Your profile is complete! Click below to make it live and visible to potential clients.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                onClick={handleSaveProfile} 
                disabled={saving}
                className="w-full md:w-auto"
              >
                {saving ? "Publishing..." : "Publish Profile"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AgentProfileEditor;

