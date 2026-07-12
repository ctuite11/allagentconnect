import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import AgentAutocomplete from "@/components/AgentAutocomplete";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthRole } from "@/hooks/useAuthRole";

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const TeamRequest = () => {
  const navigate = useNavigate();
  const { user, isVerifiedAgent, loading: authLoading } = useAuthRole();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [teamPhotoUrl, setTeamPhotoUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState({ linkedin: "", facebook: "", twitter: "", instagram: "" });

  const [role, setRole] = useState<"lead" | "delegate">("lead");
  const [leadAgent, setLeadAgent] = useState<any>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  async function uploadFile(bucket: string, prefix: string, file: File): Promise<string | null> {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      toast.error("Upload failed");
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function ensureUniqueSlug(base: string): Promise<string> {
    let candidate = base || "team";
    let n = 2;
    while (true) {
      const { data } = await supabase.from("teams").select("id").eq("slug", candidate).maybeSingle();
      if (!data) return candidate;
      candidate = `${base}-${n++}`;
    }
  }

  async function submit() {
    if (!user) return;
    if (!isVerifiedAgent) {
      toast.error("Only verified agents can request a Team Account.");
      return;
    }
    if (!name.trim() || !company.trim()) {
      toast.error("Team name and brokerage/company are required.");
      return;
    }
    if (role === "delegate" && (!leadAgent || !authorized)) {
      toast.error("Select the Team Lead and confirm authorization.");
      return;
    }

    setSaving(true);
    try {
      const slug = await ensureUniqueSlug(slugify(name));
      const leadUserId = role === "lead" ? user.id : leadAgent.id;

      const { data: team, error: teamErr } = await supabase
        .from("teams")
        .insert({
          name: name.trim(),
          slug,
          company: company.trim(),
          description: bio,
          website,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          logo_url: logoUrl,
          team_photo_url: teamPhotoUrl,
          social_links: socialLinks,
          created_by: user.id,
          team_lead_user_id: leadUserId,
          requester_role: role,
          status: "pending",
        })
        .select()
        .single();
      if (teamErr) throw teamErr;

      // Seed membership rows for the pending team.
      const memberRows: any[] = [
        {
          team_id: team.id,
          agent_id: leadUserId,
          role: "lead",
          status: role === "lead" ? "accepted" : "invited",
          invited_by: user.id,
          accepted_at: role === "lead" ? new Date().toISOString() : null,
          display_order: 0,
        },
      ];
      if (role === "delegate") {
        memberRows.push({
          team_id: team.id,
          agent_id: user.id,
          role: "delegate",
          status: "accepted",
          invited_by: user.id,
          accepted_at: new Date().toISOString(),
          display_order: 1,
        });
      }

      const { error: memErr } = await supabase.from("team_members").insert(memberRows);
      if (memErr) throw memErr;

      toast.success("Team Account request submitted. An admin will review shortly.");
      navigate(`/team/${team.id}/manage`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to submit team request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <PageHeader
          title="Create a Team Account"
          subtitle="Approved Team Accounts get a shared public Team Profile while every member keeps their individual agent profile."
          backTo="/settings"
        />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>About your team</CardTitle>
            <CardDescription>Public profile details. All fields can be edited after approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Team name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dream Team Realty" />
              {name && <p className="text-xs text-muted-foreground mt-1">Public URL: /team/{slugify(name) || "team"}</p>}
            </div>
            <div>
              <Label>Brokerage / company *</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Compass Real Estate" />
            </div>
            <div>
              <Label>Team bio</Label>
              <Textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell clients about your team..." />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Team logo</Label>
                <Input type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await uploadFile("agent-logos", "team-logo", f); if (url) setLogoUrl(url);
                }} />
                {logoUrl && <img src={logoUrl} alt="logo" className="mt-2 h-20 object-contain" />}
              </div>
              <div>
                <Label>Team photo</Label>
                <Input type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await uploadFile("agent-headshots", "team-photo", f); if (url) setTeamPhotoUrl(url);
                }} />
                {teamPhotoUrl && <img src={teamPhotoUrl} alt="team" className="mt-2 h-24 object-cover rounded" />}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Contact email</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
              <div><Label>Contact phone</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
            </div>
            <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>LinkedIn</Label><Input value={socialLinks.linkedin} onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })} /></div>
              <div><Label>Facebook</Label><Input value={socialLinks.facebook} onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })} /></div>
              <div><Label>X</Label><Input value={socialLinks.twitter} onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })} /></div>
              <div><Label>Instagram</Label><Input value={socialLinks.instagram} onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your role</CardTitle>
            <CardDescription>Only a Team Lead or an authorized Delegate may submit this request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={role} onValueChange={(v) => setRole(v as any)}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="lead" id="role-lead" />
                <div>
                  <Label htmlFor="role-lead">I am the Team Lead</Label>
                  <p className="text-xs text-muted-foreground">You will be recorded as the Team Lead and primary owner.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="delegate" id="role-delegate" />
                <div className="flex-1">
                  <Label htmlFor="role-delegate">I am an authorized Delegate</Label>
                  <p className="text-xs text-muted-foreground">Identify the Team Lead below. They will receive an invitation to accept the lead role.</p>
                </div>
              </div>
            </RadioGroup>

            {role === "delegate" && (
              <div className="space-y-3 pl-6">
                <div>
                  <Label>Team Lead</Label>
                  <AgentAutocomplete
                    onAgentSelect={(a) => setLeadAgent(a)}
                    excludeAgentIds={user ? [user.id] : []}
                    placeholder="Search verified agents..."
                  />
                  {leadAgent && (
                    <p className="text-xs text-muted-foreground mt-1">Selected: {leadAgent.first_name} {leadAgent.last_name} ({leadAgent.email})</p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="authz" checked={authorized} onCheckedChange={(v) => setAuthorized(Boolean(v))} />
                  <Label htmlFor="authz" className="text-sm font-normal">
                    I confirm the Team Lead has authorized me to manage this Team Account on their behalf.
                  </Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={submit} disabled={saving}>{saving ? "Submitting..." : "Submit for admin review"}</Button>
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        </div>
      </div>
    </div>
  );
};

export default TeamRequest;