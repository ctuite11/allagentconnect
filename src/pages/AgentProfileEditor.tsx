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
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { toast } from "sonner";
import { Trash2, Plus, Star, Upload, X } from "lucide-react";
import Navigation from "@/components/Navigation";

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
  const [phone, setPhone] = useState("");
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
      const { data: profile, error: profileError } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      if (profile) {
        setBio(profile.bio || "");
        setBuyerIncentives(profile.buyer_incentives || "");
        setSellerIncentives(profile.seller_incentives || "");
        setAacId(profile.aac_id || null);
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setTitle(profile.title || "");
        setEmail(profile.email || "");
        setPhone(profile.phone || "");
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
          phone,
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
            <Button variant="outline" onClick={() => navigate("/agent-dashboard")}>
              Back to Dashboard
            </Button>
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
                  <Label htmlFor="phone">Phone</Label>
                  <FormattedInput
                    id="phone"
                    format="phone"
                    placeholder="8571234567"
                    value={phone}
                    onChange={setPhone}
                  />
                </div>
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
                        className="w-32 h-32 rounded-full object-cover border-2 border-border"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => setHeadshotUrl("")}
                      >
                        <X className="h-3 w-3" />
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

