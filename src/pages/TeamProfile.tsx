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
import { Users, Globe, ArrowLeft, Loader2, Mail } from "lucide-react";

const TeamProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamProfile();
  }, [id]);

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
      setMembers(membersData || []);
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Team Header */}
        <div className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 rounded-xl p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {team.logo_url && (
              <div className="w-32 h-32 rounded-lg overflow-hidden border-4 border-background shadow-xl flex-shrink-0 bg-white p-4">
                <img 
                  src={team.logo_url} 
                  alt={team.name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-start gap-3 mb-4">
                <Users className="h-8 w-8 text-primary mt-1" />
                <div>
                  <h1 className="text-4xl font-bold mb-2">{team.name}</h1>
                  <Badge variant="secondary">
                    {members.length} {members.length === 1 ? 'Member' : 'Members'}
                  </Badge>
                </div>
              </div>

              {team.description && (
                <p className="text-lg text-muted-foreground mb-4 whitespace-pre-wrap">
                  {team.description}
                </p>
              )}

              {team.website && (
                <a 
                  href={team.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  Visit Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Team Members</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => (
              <Card 
                key={member.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/agent/${member.agent_profiles.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={member.agent_profiles?.headshot_url} />
                      <AvatarFallback className="text-lg">
                        {member.agent_profiles?.first_name?.[0]}{member.agent_profiles?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-1">
                        {member.agent_profiles?.first_name} {member.agent_profiles?.last_name}
                      </CardTitle>
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
                </CardHeader>
                <CardContent className="space-y-2">
                  {member.agent_profiles?.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {member.agent_profiles.bio}
                    </p>
                  )}
                  <div className="pt-2 space-y-2">
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
                  </div>
                  <Button className="w-full mt-4" variant="outline" size="sm">
                    View Profile
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TeamProfile;
