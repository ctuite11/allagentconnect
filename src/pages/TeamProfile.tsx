import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Users, Globe, ArrowLeft, Loader2, Mail, Phone, MapPin, 
  Linkedin, Facebook, Twitter, Instagram, Download, Star, 
  Home, Building2, DollarSign, Edit
} from "lucide-react";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";
import { formatPhoneNumber } from "@/lib/phoneFormat";

const generateTeamVCard = (team: any, members: any[]) => {
  const primaryContact = members.find(m => m.role === 'owner')?.agent_profiles || members[0]?.agent_profiles;
  
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${team.name}`,
    `ORG:${team.name}`,
    team.email ? `EMAIL:${team.email}` : '',
    team.phone ? `TEL;TYPE=WORK:${team.phone}` : '',
    team.office_address ? `ADR;TYPE=WORK:;;${team.office_address};;;;` : '',
    team.website ? `URL:${team.website}` : '',
    team.social_links?.linkedin ? `X-SOCIALPROFILE;TYPE=linkedin:${team.social_links.linkedin}` : '',
    'END:VCARD'
  ].filter(line => line).join('\n');
  
  const blob = new Blob([vcard], { type: 'text/vcard' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${team.name.replace(/\s+/g, '_')}.vcf`;
  link.click();
  window.URL.revokeObjectURL(url);
  
  setTimeout(() => {
    const mainContent = document.getElementById('team-main-content');
    if (mainContent) {
      const yOffset = -100;
      const y = mainContent.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, 200);
};

interface TeamMember {
  id: string;
  role: string;
  display_order: number;
  agent_profiles: {
    id: string;
    first_name: string;
    last_name: string;
    title: string | null;
    headshot_url: string | null;
    email: string;
    cell_phone: string | null;
    phone: string | null;
    bio: string | null;
  };
}

const TeamProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    checkEditPermission();
    fetchTeamProfile();
  }, [id]);

  const checkEditPermission = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is a member of this team
      const { data: membership } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", id)
        .eq("agent_id", user.id)
        .maybeSingle();

      setCanEdit(!!membership);
    } catch (error) {
      console.error("Error checking edit permission:", error);
    }
  };

  const fetchTeamProfile = async () => {
    try {
      setLoading(true);

      // Fetch team data
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", id)
        .single();

      if (teamError) throw teamError;
      if (!teamData) {
        toast.error("Team not found");
        navigate("/our-agents");
        return;
      }

      setTeam(teamData);

      // Fetch team members with their profiles ordered by display_order
      const { data: membersData, error: membersError } = await supabase
        .from("team_members")
        .select(`
          *,
          agent_profiles (
            id,
            first_name,
            last_name,
            title,
            headshot_url,
            email,
            cell_phone,
            phone,
            bio
          )
        `)
        .eq("team_id", id)
        .order("display_order");

      if (membersError) throw membersError;
      setMembers((membersData as any) || []);

      // Fetch all listings from team members
      const memberIds = (membersData as any)?.map((m: any) => m.agent_profiles.id) || [];
      if (memberIds.length > 0) {
        const { data: listingsData, error: listingsError } = await supabase
          .from("listings")
          .select("*")
          .in("agent_id", memberIds)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(6);

        if (listingsError) throw listingsError;
        setListings(listingsData || []);
      }

      // Fetch testimonials from team members
      if (memberIds.length > 0) {
        const { data: testimonialsData, error: testimonialsError } = await supabase
          .from("testimonials")
          .select("*")
          .in("agent_id", memberIds)
          .order("created_at", { ascending: false })
          .limit(6);

        if (testimonialsError) throw testimonialsError;
        setTestimonials(testimonialsData || []);
      }
    } catch (error: any) {
      console.error("Error fetching team profile:", error);
      toast.error("Failed to load team profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh] mt-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 mt-20">
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Team not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const primaryContact = members.find(m => m.role === 'owner')?.agent_profiles || members[0]?.agent_profiles;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Sticky Edit Button */}
      {canEdit && (
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          onClick={() => navigate("/manage-team")}
          title="Edit Team Profile"
        >
          <Edit className="h-5 w-5" />
        </Button>
      )}

      <div className="container mx-auto px-4 py-8 pt-24">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Hero Section with Team Contact Information */}
        <div className="bg-background rounded-xl p-8 mb-8 border">
          <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
            {/* Team Photo */}
            <div className="flex-shrink-0">
              <div className="w-48 h-64 rounded-lg overflow-hidden border-4 border-background shadow-xl">
                {team.photo_url ? (
                  <img 
                    src={team.photo_url} 
                    alt={team.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Users className="h-20 w-20 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="mt-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => generateTeamVCard(team, members)}
                >
                  <Download className="h-4 w-4" />
                  Save Contact
                </Button>
              </div>
            </div>
            
            {/* Contact Information */}
            <div className="flex-1 space-y-0">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h1 className="text-3xl font-bold">{team.name}</h1>
                  <Badge variant="secondary" className="mt-2">
                    {members.length} {members.length === 1 ? 'Member' : 'Members'}
                  </Badge>
                </div>
                {team.logo_url && (
                  <img src={team.logo_url} alt="Team logo" className="h-28 object-contain" />
                )}
              </div>

              {team.office_name && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">Office:</span> {team.office_name}
                </p>
              )}

              {team.phone && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">Phone:</span>{' '}
                  <a href={`tel:${team.phone}`} className="hover:text-primary transition-colors">
                    {formatPhoneNumber(team.phone)}
                  </a>
                </p>
              )}

              {primaryContact && primaryContact.email && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">Email:</span>{' '}
                  <a href={`mailto:${primaryContact.email}`} className="hover:text-primary transition-colors">
                    {primaryContact.email}
                  </a>
                </p>
              )}

              {team.office_address && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">Address:</span> {team.office_address}
                  {team.office_city && `, ${team.office_city}`}
                  {team.office_state && `, ${team.office_state}`}
                  {team.office_zip && ` ${team.office_zip}`}
                </p>
              )}

              {team.website && (
                <p className="text-lg text-muted-foreground">
                  <span className="font-semibold">Website:</span>{' '}
                  <a href={team.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    {team.website}
                  </a>
                </p>
              )}

              {primaryContact && (
                <div className="flex flex-wrap gap-3 pt-4">
                  <ContactAgentProfileDialog 
                    agentId={primaryContact.id}
                    agentName={team.name}
                    agentEmail={primaryContact.email}
                    buttonText="Contact Team"
                  />
                </div>
              )}

              {team.social_links && Object.values(team.social_links).some(link => link) && (
                <div className="pt-2">
                  <div className="flex gap-3">
                    {team.social_links.website && (
                      <a href={team.social_links.website} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                        <Globe className="h-5 w-5" />
                      </a>
                    )}
                    {team.social_links.linkedin && (
                      <a href={team.social_links.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white transition-colors">
                        <Linkedin className="h-5 w-5" />
                      </a>
                    )}
                    {team.social_links.facebook && (
                      <a href={team.social_links.facebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white transition-colors">
                        <Facebook className="h-5 w-5" />
                      </a>
                    )}
                    {team.social_links.twitter && (
                      <a href={team.social_links.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors">
                        <Twitter className="h-5 w-5" />
                      </a>
                    )}
                    {team.social_links.instagram && (
                      <a href={team.social_links.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white transition-colors">
                        <Instagram className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div id="team-main-content" className="space-y-6">
          {/* About Section */}
          {team.description && (
            <Card>
              <CardHeader>
                <CardTitle>About Our Team</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{team.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member: any) => (
                  <Card 
                    key={member.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/agent/${member.agent_profiles.id}`)}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={member.agent_profiles?.headshot_url || undefined} />
                          <AvatarFallback className="text-lg">
                            {member.agent_profiles?.first_name?.[0]}{member.agent_profiles?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-1">
                            {member.agent_profiles?.first_name} {member.agent_profiles?.last_name}
                          </h3>
                          {member.agent_profiles?.title && (
                            <p className="text-sm text-muted-foreground">
                              {member.agent_profiles.title}
                            </p>
                          )}
                          {member.role === 'owner' && (
                            <Badge variant="secondary" className="mt-2">Team Leader</Badge>
                          )}
                        </div>
                      </div>
                      {member.agent_profiles?.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {member.agent_profiles.bio}
                        </p>
                      )}
                      <div className="space-y-2">
                        {member.agent_profiles?.email && (
                          <a 
                            href={`mailto:${member.agent_profiles.email}`}
                            className="flex items-center gap-2 text-sm hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-4 w-4" />
                            <span className="truncate">{member.agent_profiles.email}</span>
                          </a>
                        )}
                        {member.agent_profiles?.cell_phone && (
                          <a 
                            href={`tel:${member.agent_profiles.cell_phone}`}
                            className="flex items-center gap-2 text-sm hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-4 w-4" />
                            <span>{formatPhoneNumber(member.agent_profiles.cell_phone)}</span>
                          </a>
                        )}
                      </div>
                      <Button className="w-full mt-4" variant="outline" size="sm">
                        View Profile
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Testimonials Section */}
          {testimonials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  Client Testimonials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testimonials.map((testimonial) => (
                    <Card key={testimonial.id} className="border-l-4 border-l-primary/50">
                      <CardContent className="pt-6">
                        {testimonial.rating && (
                          <div className="flex gap-1 mb-2">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < testimonial.rating
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        <p className="text-muted-foreground italic mb-3">"{testimonial.testimonial_text}"</p>
                        <div className="text-sm">
                          <p className="font-semibold">{testimonial.client_name}</p>
                          {testimonial.client_title && (
                            <p className="text-muted-foreground">{testimonial.client_title}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Listings Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Active Listings ({listings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No active listings at this time
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {listings.map((listing) => (
                    <Card key={listing.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/property/${listing.id}`)}>
                      <div className="relative h-48 overflow-hidden rounded-t-lg">
                        <img
                          src={listing.photos && listing.photos.length > 0 ? listing.photos[0].url : '/placeholder.svg'}
                          alt={listing.address}
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute top-2 right-2 bg-accent">
                          {listing.listing_type === 'for_sale' ? 'For Sale' : 'For Rent'}
                        </Badge>
                      </div>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-primary mb-2">
                          ${listing.price.toLocaleString()}
                        </p>
                        <p className="font-semibold text-sm mb-1">{listing.address}</p>
                        <p className="text-sm text-muted-foreground mb-3">
                          {listing.city}, {listing.state} {listing.zip_code}
                        </p>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          {listing.bedrooms && (
                            <span>{listing.bedrooms} bed</span>
                          )}
                          {listing.bathrooms && (
                            <span>{listing.bathrooms} bath</span>
                          )}
                          {listing.square_feet && (
                            <span>{listing.square_feet.toLocaleString()} sqft</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TeamProfile;
