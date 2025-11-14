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
import { FormattedInput } from "@/components/ui/formatted-input";
import { toast } from "sonner";
import { Users, Plus, Trash2, Upload, X, ExternalLink, GripVertical, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import AgentAutocomplete from "@/components/AgentAutocomplete";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  const [officeName, setOfficeName] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [socialLinks, setSocialLinks] = useState({
    linkedin: "",
    facebook: "",
    twitter: "",
    instagram: "",
  });
  
  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // Drag and drop sensors - must be at top level, not conditional
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        const teamData = membership.teams as any;
        setTeam(teamData);
        setTeamName(teamData.name);
        setDescription(teamData.description || "");
        setWebsite(teamData.website || "");
        setLogoUrl(teamData.logo_url || "");
        setTeamPhotoUrl(teamData.team_photo_url || "");
        setContactEmail(teamData.contact_email || "");
        setContactPhone(teamData.contact_phone || "");
        setOfficeName(teamData.office_name || "");
        setOfficeAddress(teamData.office_address || "");
        setOfficePhone(teamData.office_phone || "");
        setSocialLinks(teamData.social_links || {
          linkedin: "",
          facebook: "",
          twitter: "",
          instagram: "",
        });
        setIsOwner(membership.role === 'owner');

        // Load team members ordered by display_order
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
          .eq("team_id", teamData.id)
          .order("display_order");

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

  const handleSaveTeam = async () => {
    if (!teamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (team) {
        // Update existing team
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
            office_name: officeName,
            office_address: officeAddress,
            office_phone: officePhone,
            social_links: socialLinks,
          })
          .eq("id", team.id);

        if (error) throw error;
        toast.success("Team updated successfully!");
      } else {
        // Create new team
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
            office_name: officeName,
            office_address: officeAddress,
            office_phone: officePhone,
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
      }
    } catch (error: any) {
      console.error("Error saving team:", error);
      toast.error("Failed to save team");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (agent: any) => {
    if (!agent || !team) return;

    try {
      // Get the highest display_order to add new member at the end
      const maxOrder = members.length > 0 
        ? Math.max(...members.map(m => m.display_order ?? 0))
        : -1;

      const { error } = await supabase
        .from("team_members")
        .insert({
          team_id: team.id,
          agent_id: agent.id,
          role: 'member',
          display_order: maxOrder + 1,
        });

      if (error) throw error;
      
      // Send notification email to the added agent
      try {
        await supabase.functions.invoke('send-team-invite', {
          body: {
            agentEmail: agent.email,
            agentName: `${agent.first_name} ${agent.last_name}`,
            teamName: team.name,
            teamContactEmail: contactEmail,
            teamContactPhone: contactPhone,
            teamOfficeName: officeName,
            teamOfficeAddress: officeAddress,
            teamOfficePhone: officePhone,
          }
        });
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
        // Don't fail the whole operation if email fails
      }
      
      toast.success(`${agent.first_name} ${agent.last_name} added to team!`);
      setAddMemberOpen(false);
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

  const excludedAgentIds = members.map(member => member.agent_id);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = members.findIndex((m) => m.id === active.id);
    const newIndex = members.findIndex((m) => m.id === over.id);

    const reorderedMembers = arrayMove(members, oldIndex, newIndex);
    
    // Update local state immediately for smooth UX
    setMembers(reorderedMembers);

    // Update display_order in database
    try {
      const updates = reorderedMembers.map((member, index) => ({
        id: member.id,
        display_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("team_members")
          .update({ display_order: update.display_order })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast.success("Member order updated!");
    } catch (error: any) {
      console.error("Error updating order:", error);
      toast.error("Failed to update member order");
      // Reload to get correct order from server
      await checkAuthAndLoadTeam();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => navigate("/agent-dashboard")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{team ? "Manage Team" : "Create Your Team"}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {team ? "Update your team profile and manage members" : "Create a team profile to collaborate with other agents"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {team && (
                <Button onClick={() => navigate(`/team/${team.id}`)} variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Public Profile
                </Button>
              )}
            </div>
          </div>

          {/* Team Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Team Information</CardTitle>
              <CardDescription>Configure your team's basic details and contact information</CardDescription>
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
                <FormattedInput
                  id="contact_phone"
                  format="phone"
                  placeholder="5551234567"
                  value={contactPhone}
                  onChange={setContactPhone}
                  disabled={!isOwner && !!team}
                />
              </div>

              <div>
                <Label htmlFor="office_name">Office Name</Label>
                <Input
                  id="office_name"
                  placeholder="Main Office"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  disabled={!isOwner && !!team}
                />
              </div>

              <div>
                <Label htmlFor="office_address">Office Address</Label>
                <AddressAutocomplete
                  value={officeAddress}
                  onChange={setOfficeAddress}
                  onPlaceSelect={(place) => {
                    if (place?.formatted_address) {
                      setOfficeAddress(place.formatted_address);
                    }
                  }}
                  placeholder="123 Main St, City, State 12345"
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
                  disabled={!isOwner && !!team}
                />
              </div>

              <Button onClick={handleSaveTeam} disabled={saving || (!isOwner && !!team)}>
                {saving ? "Saving..." : "Save Team Info"}
              </Button>
            </CardContent>
          </Card>

          {/* Team Images */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Team Images</CardTitle>
              <CardDescription>Upload your team photo and company logo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Team Photo</Label>
                <div className="mt-2 space-y-4">
                  {teamPhotoUrl && (
                    <div className="relative inline-block">
                      <img
                        src={teamPhotoUrl}
                        alt="Team photo"
                        className="w-48 h-64 rounded-lg object-cover border-4 border-border"
                      />
                      {isOwner && (
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={() => setTeamPhotoUrl("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                  {(!team || isOwner) && (
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
                <Label>Company Logo</Label>
                <div className="mt-2 space-y-4">
                  {logoUrl && (
                    <div className="relative inline-block">
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-48 h-32 rounded-lg object-contain border-2 border-border bg-muted p-2"
                      />
                      {isOwner && (
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => setLogoUrl("")}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  {(!team || isOwner) && (
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

              <Button onClick={handleSaveTeam} disabled={saving || (!isOwner && !!team)}>
                {saving ? "Saving..." : "Save Images"}
              </Button>
            </CardContent>
          </Card>

          {/* Team Description */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Team Description</CardTitle>
              <CardDescription>Tell clients about your team and expertise</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Write your team description here..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="mb-4"
                disabled={!isOwner && !!team}
              />
              <Button onClick={handleSaveTeam} disabled={saving || (!isOwner && !!team)}>
                {saving ? "Saving..." : "Save Description"}
              </Button>
            </CardContent>
          </Card>

          {/* Social Media Links */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>Connect your team's social media profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  placeholder="https://linkedin.com/company/..."
                  value={socialLinks.linkedin}
                  onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                  disabled={!isOwner && !!team}
                />
              </div>
              <div>
                <Label htmlFor="twitter">Twitter/X</Label>
                <Input
                  id="twitter"
                  placeholder="https://twitter.com/..."
                  value={socialLinks.twitter}
                  onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                  disabled={!isOwner && !!team}
                />
              </div>
              <div>
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  placeholder="https://facebook.com/..."
                  value={socialLinks.facebook}
                  onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                  disabled={!isOwner && !!team}
                />
              </div>
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  placeholder="https://instagram.com/..."
                  value={socialLinks.instagram}
                  onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                  disabled={!isOwner && !!team}
                />
              </div>
              <Button onClick={handleSaveTeam} disabled={saving || (!isOwner && !!team)}>
                {saving ? "Saving..." : "Save Social Links"}
              </Button>
            </CardContent>
          </Card>

          {/* Team Members - Show after team is created */}
          {team && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>Manage your team roster</CardDescription>
                  </div>
                  {isOwner && (
                    <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Team Member</DialogTitle>
                          <DialogDescription>
                            Search and select an agent to add to your team. Their profile picture and contact information will be imported automatically.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <AgentAutocomplete
                            onAgentSelect={handleAddMember}
                            excludeAgentIds={excludedAgentIds}
                            placeholder="Search by name or email..."
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.length === 0 ? (
                    <p className="text-muted-foreground">No team members yet. Add your first member above!</p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={members.map(m => m.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {members.map((member) => (
                          <SortableMemberItem
                            key={member.id}
                            member={member}
                            isOwner={isOwner}
                            onRemove={handleRemoveMember}
                            onNavigate={() => navigate(`/agent/${member.agent_profiles?.id}`)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create Team First Notice */}
          {!team && (
            <Card className="mb-6 border-primary/50 bg-primary/5">
              <CardContent className="py-6">
                <p className="text-center text-muted-foreground">
                  💡 Create your team profile first, then you'll be able to add team members!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Publish Team Profile */}
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Publish?</CardTitle>
              <CardDescription>
                {team 
                  ? "Your team profile is complete! Click below to save all changes." 
                  : "Create your team profile and make it visible to potential clients."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                onClick={handleSaveTeam} 
                disabled={saving || (!isOwner && !!team)}
                className="w-full md:w-auto"
              >
                {saving ? "Publishing..." : team ? "Update Team Profile" : "Create Team Profile"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface SortableMemberItemProps {
  member: any;
  isOwner: boolean;
  onRemove: (id: string) => void;
  onNavigate: () => void;
}

const SortableMemberItem = ({ member, isOwner, onRemove, onNavigate }: SortableMemberItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
    >
      {isOwner && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
      )}
      <button
        onClick={onNavigate}
        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
      >
        <Avatar className="h-12 w-12 cursor-pointer">
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
          {member.agent_profiles?.email && (
            <p className="text-xs text-muted-foreground truncate">
              {member.agent_profiles.email}
            </p>
          )}
        </div>
      </button>
      <div className="flex items-center gap-2">
        {member.role === 'owner' && (
          <Badge variant="secondary" className="text-xs">Owner</Badge>
        )}
        {isOwner && member.role !== 'owner' && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onRemove(member.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ManageTeam;
