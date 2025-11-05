import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Users, Plus, Trash2, Upload, X, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ManageTeam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [allAgents, setAllAgents] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  
  // Team form fields
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [teamPhotoUrl, setTeamPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [socialLinks, setSocialLinks] = useState({
    linkedin: "",
    facebook: "",
    twitter: "",
    instagram: "",
  });
  
  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");

  useEffect(() => {
    checkAuthAndLoadTeam();
  }, []);

  const checkAuthAndLoadTeam = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await loadTeamData(session.user.id);
    await loadAllAgents();
  };

  const loadTeamData = async (userId: string) => {
    try {
      setLoading(true);

      // Check if user is part of a team
      const { data: membership, error: membershipError } = await supabase
        .from("team_members")
        .select("*, teams(*)")
        .eq("agent_id", userId)
        .single();

      if (membershipError && membershipError.code !== 'PGRST116') throw membershipError;

      if (membership) {
        setTeam(membership.teams);
        setTeamName(membership.teams.name);
        setDescription(membership.teams.description || "");
        setWebsite(membership.teams.website || "");
        setLogoUrl(membership.teams.logo_url || "");
        setTeamPhotoUrl(membership.teams.team_photo_url || "");
        setContactEmail(membership.teams.contact_email || "");
        setContactPhone(membership.teams.contact_phone || "");
        setSocialLinks(membership.teams.social_links || {
          linkedin: "",
          facebook: "",
          twitter: "",
          instagram: "",
        });
        setIsOwner(membership.role === 'owner');

        // Load team members
        const { data: teamMembers, error: membersError } = await supabase
          .from("team_members")
          .select(`
            *,
            agent_profiles (
              id,
              first_name,
              last_name,
              title,
              headshot_url,
              email
            )
          `)
          .eq("team_id", membership.teams.id);

        if (membersError) throw membersError;
        setMembers(teamMembers || []);
      }
    } catch (error: any) {
      console.error("Error loading team:", error);
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  const loadAllAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email, headshot_url")
        .order("first_name");

      if (error) throw error;
      setAllAgents(data || []);
    } catch (error: any) {
      console.error("Error loading agents:", error);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Create team
      const { data: newTeam, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: teamName,
          description,
          website,
          logo_url: logoUrl,
          team_photo_url: teamPhotoUrl,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          social_links: socialLinks,
          created_by: session.user.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({
          team_id: newTeam.id,
          agent_id: session.user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      toast.success("Team created successfully!");
      await checkAuthAndLoadTeam();
    } catch (error: any) {
      console.error("Error creating team:", error);
      toast.error("Failed to create team");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTeam = async () => {
    if (!team) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          name: teamName,
          description,
          website,
          logo_url: logoUrl,
          team_photo_url: teamPhotoUrl,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          social_links: socialLinks,
        })
        .eq("id", team.id);

      if (error) throw error;
      toast.success("Team updated successfully!");
    } catch (error: any) {
      console.error("Error updating team:", error);
      toast.error("Failed to update team");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedAgentId || !team) return;

    try {
      const { error } = await supabase
        .from("team_members")
        .insert({
          team_id: team.id,
          agent_id: selectedAgentId,
          role: 'member',
        });

      if (error) throw error;
      
      toast.success("Member added successfully!");
      setAddMemberOpen(false);
      setSelectedAgentId("");
      await checkAuthAndLoadTeam();
    } catch (error: any) {
      console.error("Error adding member:", error);
      toast.error("Failed to add member");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;

    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
      
      toast.success("Member removed successfully!");
      await checkAuthAndLoadTeam();
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
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
      const fileName = `${session.user.id}/team-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('agent-logos')
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);
      toast.success("Logo uploaded!");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/team-photo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-headshots')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('agent-headshots')
        .getPublicUrl(fileName);

      setTeamPhotoUrl(publicUrl);
      toast.success("Team photo uploaded!");
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 mt-20">
          <p className="text-center">Loading...</p>
        </div>
      </div>
    );
  }

  const availableAgents = allAgents.filter(
    agent => !members.some(member => member.agent_id === agent.id)
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              {team ? "Manage Team" : "Create Your Team"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {team ? "Manage your team profile and members" : "Create a team profile to collaborate with other agents"}
            </p>
          </div>
          {team && (
            <Button onClick={() => navigate(`/team/${team.id}`)} variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Public Profile
            </Button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Team Info Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Information</CardTitle>
                <CardDescription>Configure your team's public profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="team_name">Team Name *</Label>
                  <Input
                    id="team_name"
                    placeholder="Dream Team Realty"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    disabled={!isOwner && !!team}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Tell clients about your team..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    disabled={!isOwner && !!team}
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://yourteam.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={!isOwner && !!team}
                  />
                </div>

                <div>
                  <Label>Team Logo</Label>
                  <div className="mt-2 space-y-4">
                    {logoUrl && (
                      <div className="relative inline-block">
                        <img
                          src={logoUrl}
                          alt="Team logo"
                          className="h-20 object-contain border-2 border-border rounded-lg p-2"
                        />
                        {isOwner && (
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-0 right-0 h-6 w-6"
                            onClick={() => setLogoUrl("")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    {isOwner && (
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
                    )}
                  </div>
                </div>

                <div>
                  <Label>Team Photo</Label>
                  <div className="mt-2 space-y-4">
                    {teamPhotoUrl && (
                      <div className="relative inline-block">
                        <img
                          src={teamPhotoUrl}
                          alt="Team photo"
                          className="w-48 h-64 object-cover border-2 border-border rounded-lg"
                        />
                        {isOwner && (
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-0 right-0 h-6 w-6"
                            onClick={() => setTeamPhotoUrl("")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    {isOwner && (
                      <div>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                          id="photo-upload"
                        />
                        <Label
                          htmlFor="photo-upload"
                          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                          <Upload className="h-4 w-4" />
                          {uploadingPhoto ? "Uploading..." : "Upload Team Photo"}
                        </Label>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    placeholder="team@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    disabled={!isOwner && !!team}
                  />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    disabled={!isOwner && !!team}
                  />
                </div>

                <div className="space-y-4">
                  <Label>Social Media Links</Label>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="linkedin" className="text-sm text-muted-foreground">LinkedIn</Label>
                      <Input
                        id="linkedin"
                        type="url"
                        placeholder="https://linkedin.com/company/..."
                        value={socialLinks.linkedin}
                        onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                        disabled={!isOwner && !!team}
                      />
                    </div>
                    <div>
                      <Label htmlFor="facebook" className="text-sm text-muted-foreground">Facebook</Label>
                      <Input
                        id="facebook"
                        type="url"
                        placeholder="https://facebook.com/..."
                        value={socialLinks.facebook}
                        onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                        disabled={!isOwner && !!team}
                      />
                    </div>
                    <div>
                      <Label htmlFor="twitter" className="text-sm text-muted-foreground">Twitter</Label>
                      <Input
                        id="twitter"
                        type="url"
                        placeholder="https://twitter.com/..."
                        value={socialLinks.twitter}
                        onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                        disabled={!isOwner && !!team}
                      />
                    </div>
                    <div>
                      <Label htmlFor="instagram" className="text-sm text-muted-foreground">Instagram</Label>
                      <Input
                        id="instagram"
                        type="url"
                        placeholder="https://instagram.com/..."
                        value={socialLinks.instagram}
                        onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                        disabled={!isOwner && !!team}
                      />
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <Button 
                    onClick={team ? handleUpdateTeam : handleCreateTeam}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? "Saving..." : team ? "Update Team" : "Create Team"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Team Members */}
          {team && (
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Team Members</CardTitle>
                    {isOwner && (
                      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Team Member</DialogTitle>
                            <DialogDescription>
                              Select an agent to add to your team
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an agent" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableAgents.map((agent) => (
                                  <SelectItem key={agent.id} value={agent.id}>
                                    {agent.first_name} {agent.last_name} - {agent.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button onClick={handleAddMember} className="w-full" disabled={!selectedAgentId}>
                              Add Member
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.agent_profiles?.headshot_url} />
                        <AvatarFallback>
                          {member.agent_profiles?.first_name?.[0]}{member.agent_profiles?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.agent_profiles?.first_name} {member.agent_profiles?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.agent_profiles?.title || member.agent_profiles?.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.role === 'owner' && (
                          <Badge variant="secondary" className="text-xs">Owner</Badge>
                        )}
                        {isOwner && member.role !== 'owner' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageTeam;
