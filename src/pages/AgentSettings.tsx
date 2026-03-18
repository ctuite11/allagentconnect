import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProfilePhotoUpload from "@/components/profile-editor/ProfilePhotoUpload";
import { validatePassword } from "@/lib/passwordPolicy";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Check, X, Eye, EyeOff, ExternalLink, Lock } from "lucide-react";

type Section = "profile" | "account" | "notifications" | "network";

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account" },
  { id: "notifications", label: "Notifications" },
  { id: "network", label: "Agent Network" },
];

export default function AgentSettings() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [userId, setUserId] = useState<string | null>(null);

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState("");
  const [aacId, setAacId] = useState<string | null>(null);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [coverageAreas, setCoverageAreas] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // Account state
  const [loginEmail, setLoginEmail] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [newMatchesEnabled, setNewMatchesEnabled] = useState(true);
  const [priceChangesEnabled, setPriceChangesEnabled] = useState(true);
  const [clientNeedsEnabled, setClientNeedsEnabled] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState("daily");
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Network state
  const [showInNetwork, setShowInNetwork] = useState(true);
  const [acceptReferrals, setAcceptReferrals] = useState(true);
  const [savingNetwork, setSavingNetwork] = useState(false);

  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setLoginEmail(user.email ?? "");

      // Load profile
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setTitle(profile.title ?? "");
        setCompany(profile.company ?? "");
        setPhone(profile.phone ?? "");
        setEmail(profile.email ?? "");
        setBio(profile.bio ?? "");
        setHeadshotUrl(profile.headshot_url ?? "");
        setAacId(profile.aac_id ?? null);
        setAcceptReferrals(profile.receive_buyer_alerts ?? true);
      }

      // Load agent settings
      const { data: settings } = await supabase
        .from("agent_settings")
        .select("notifications_enabled, hide_from_directory, email_frequency")
        .eq("user_id", user.id)
        .single();

      if (settings) {
        setNotificationsEnabled(settings.notifications_enabled ?? true);
        setShowInNetwork(!(settings.hide_from_directory ?? false));
      }

      // Load notification preferences
      const { data: notifPrefs } = await supabase
        .from("notification_preferences")
        .select("new_matches_enabled, price_changes_enabled, client_needs_enabled, frequency")
        .eq("user_id", user.id)
        .single();

      if (notifPrefs) {
        setNewMatchesEnabled(notifPrefs.new_matches_enabled ?? true);
        setPriceChangesEnabled(notifPrefs.price_changes_enabled ?? true);
        setClientNeedsEnabled(notifPrefs.client_needs_enabled ?? true);
        setDigestFrequency(notifPrefs.frequency ?? "daily");
      }

      // Load coverage areas (counties + states)
      const { data: counties } = await supabase
        .from("agent_county_preferences")
        .select("county_id, counties(name, state)")
        .eq("agent_id", user.id);

      const { data: states } = await supabase
        .from("agent_state_preferences")
        .select("state")
        .eq("agent_id", user.id);

      const areas: string[] = [];
      if (counties) {
        counties.forEach((c: any) => {
          if (c.counties) areas.push(`${c.counties.name}, ${c.counties.state}`);
        });
      }
      if (states) {
        states.forEach((s: any) => {
          if (s.state) areas.push(s.state);
        });
      }
      setCoverageAreas(areas);
    } catch (err) {
      console.error("Failed to load settings data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Headshot upload
  const handleHeadshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingHeadshot(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/headshot.${ext}`;
      const { error: uploadError } = await supabase.storage.from("agent-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("agent-photos").getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;
      setHeadshotUrl(url);
      await supabase.from("agent_profiles").update({ headshot_url: url }).eq("id", userId);
      toast({ title: "Photo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingHeadshot(false);
    }
  };

  const handleRemoveHeadshot = async () => {
    if (!userId) return;
    setHeadshotUrl("");
    await supabase.from("agent_profiles").update({ headshot_url: null }).eq("id", userId);
    toast({ title: "Photo removed" });
  };

  // Save Profile
  const saveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("agent_profiles").update({
        first_name: firstName,
        last_name: lastName,
        title,
        company,
        phone,
        email,
        bio,
      }).eq("id", userId);
      if (error) throw error;
      toast({ title: "Profile saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const { allPass } = validatePassword(newPassword);
    if (!allPass) {
      toast({ title: "Password doesn't meet requirements", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (error.message?.includes("same_password")) {
          toast({ title: "New password must be different from current password", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }
      toast({ title: "Password updated" });
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Password change failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  // Save Notifications
  const saveNotifications = async () => {
    if (!userId) return;
    setSavingNotifications(true);
    try {
      const { error: settingsErr } = await supabase.from("agent_settings").update({
        notifications_enabled: notificationsEnabled,
      }).eq("user_id", userId);
      if (settingsErr) throw settingsErr;

      const { error: prefsErr } = await supabase.from("notification_preferences").upsert({
        user_id: userId,
        new_matches_enabled: newMatchesEnabled,
        price_changes_enabled: priceChangesEnabled,
        client_needs_enabled: clientNeedsEnabled,
        frequency: digestFrequency,
      }, { onConflict: "user_id" });
      if (prefsErr) throw prefsErr;

      toast({ title: "Notification preferences saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingNotifications(false);
    }
  };

  // Save Network
  const saveNetwork = async () => {
    if (!userId) return;
    setSavingNetwork(true);
    try {
      const { error: settingsErr } = await supabase.from("agent_settings").update({
        hide_from_directory: !showInNetwork,
      }).eq("user_id", userId);
      if (settingsErr) throw settingsErr;

      const { error: profileErr } = await supabase.from("agent_profiles").update({
        receive_buyer_alerts: acceptReferrals,
      }).eq("id", userId);
      if (profileErr) throw profileErr;

      toast({ title: "Network preferences saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingNetwork(false);
    }
  };

  const passwordValidation = validatePassword(newPassword);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-4" />
        <div className="h-4 w-96 bg-zinc-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your account, profile, notifications, and network preferences."
      />

      <div className="flex gap-10">
        {/* Left mini-nav */}
        <nav className="hidden md:flex flex-col gap-1 w-44 shrink-0 sticky top-8 self-start">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "text-left px-3 py-2 rounded-md text-sm transition-colors",
                activeSection === item.id
                  ? "font-medium text-zinc-900 bg-zinc-100 border-l-2 border-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 border-l-2 border-transparent"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Mobile nav */}
        <div className="flex md:hidden gap-1 mb-6 overflow-x-auto pb-1 -mx-2 px-2 w-full">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors",
                activeSection === item.id
                  ? "font-medium text-zinc-900 bg-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* ─── Profile ─── */}
          {activeSection === "profile" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Profile</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Your public-facing agent information.</p>
              </div>

              <ProfilePhotoUpload
                headshotUrl={headshotUrl}
                uploadingHeadshot={uploadingHeadshot}
                onUpload={handleHeadshotUpload}
                onRemove={handleRemoveHeadshot}
                aacId={aacId}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="settingsTitle">Title</Label>
                  <Input id="settingsTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Realtor, Broker Associate" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">Brokerage / Company</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="settingsPhone">Phone</Label>
                  <Input id="settingsPhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsEmail">Email</Label>
                  <Input id="settingsEmail" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell other agents about yourself..." />
              </div>

              {/* Markets served */}
              <div className="space-y-1.5">
                <Label>Markets served</Label>
                {coverageAreas.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {coverageAreas.map((area, i) => (
                      <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-zinc-100 text-xs text-zinc-700">
                        {area}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No coverage areas set.</p>
                )}
                <button
                  onClick={() => navigate("/manage-coverage-areas")}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                >
                  Manage Coverage Areas <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="pt-2">
                <Button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </section>
          )}

          {/* ─── Account ─── */}
          {activeSection === "account" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Account</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Login credentials and security.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Login email</Label>
                <Input value={loginEmail} readOnly className="bg-zinc-50 text-zinc-600 cursor-default" />
              </div>

              {/* Password */}
              <div className="border-t border-zinc-100 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900">Password</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Update your account password.</p>
                  </div>
                  {!showPasswordForm && (
                    <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                      Change Password
                    </Button>
                  )}
                </div>

                {showPasswordForm && (
                  <div className="space-y-4 max-w-sm">
                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword">New password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {newPassword && (
                      <ul className="space-y-1">
                        {passwordValidation.results.map((r) => (
                          <li key={r.id} className="flex items-center gap-1.5 text-xs">
                            {r.valid ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-zinc-300" />
                            )}
                            <span className={r.valid ? "text-emerald-600" : "text-zinc-500"}>{r.label}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      {confirmPassword && confirmPassword !== newPassword && (
                        <p className="text-xs text-red-500">Passwords don't match</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleChangePassword} disabled={savingPassword || !passwordValidation.allPass || newPassword !== confirmPassword}>
                        {savingPassword ? "Updating..." : "Update Password"}
                      </Button>
                      <Button variant="ghost" onClick={() => { setShowPasswordForm(false); setNewPassword(""); setConfirmPassword(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Security placeholder */}
              <div className="border-t border-zinc-100 pt-5">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm">Security settings coming soon</span>
                </div>
              </div>
            </section>
          )}

          {/* ─── Notifications ─── */}
          {activeSection === "notifications" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Notifications</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Control how and when you receive alerts.</p>
              </div>

              <div className="space-y-5">
                <ToggleRow
                  label="Email notifications"
                  description="Receive email notifications for activity on your account."
                  checked={notificationsEnabled}
                  onChange={setNotificationsEnabled}
                />
                <ToggleRow
                  label="New match alerts"
                  description="Get notified when new listings match your criteria."
                  checked={newMatchesEnabled}
                  onChange={setNewMatchesEnabled}
                />
                <ToggleRow
                  label="Price change alerts"
                  description="Get notified when saved listings change price."
                  checked={priceChangesEnabled}
                  onChange={setPriceChangesEnabled}
                />
                <ToggleRow
                  label="Client needs alerts"
                  description="Get notified when new client needs are posted in your markets."
                  checked={clientNeedsEnabled}
                  onChange={setClientNeedsEnabled}
                />

                <div className="space-y-1.5 max-w-xs">
                  <Label>Digest frequency</Label>
                  <Select value={digestFrequency} onValueChange={setDigestFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediately">Immediately</SelectItem>
                      <SelectItem value="daily">Daily digest</SelectItem>
                      <SelectItem value="weekly">Weekly digest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={saveNotifications} disabled={savingNotifications}>
                  {savingNotifications ? "Saving..." : "Save Notifications"}
                </Button>
              </div>
            </section>
          )}

          {/* ─── Agent Network ─── */}
          {activeSection === "network" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Agent Network</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Control how you appear to other agents on the network.</p>
              </div>

              <div className="space-y-5">
                <ToggleRow
                  label="Show profile in Agent Network"
                  description="Make your profile visible to other agents in the directory."
                  checked={showInNetwork}
                  onChange={setShowInNetwork}
                />
                <ToggleRow
                  label="Accept referral inquiries"
                  description="Allow other agents to send you referral and buyer requests."
                  checked={acceptReferrals}
                  onChange={setAcceptReferrals}
                />

                {/* Disabled placeholder */}
                <div className="flex items-center justify-between opacity-50">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Show contact info to other members</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Coming soon</p>
                  </div>
                  <Switch disabled checked={false} />
                </div>
              </div>

              {/* Preferred referral markets */}
              <div className="space-y-1.5">
                <Label>Preferred referral markets</Label>
                {coverageAreas.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {coverageAreas.map((area, i) => (
                      <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-zinc-100 text-xs text-zinc-700">
                        {area}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No referral markets set.</p>
                )}
                <button
                  onClick={() => navigate("/manage-coverage-areas")}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                >
                  Manage Coverage Areas <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="pt-2">
                <Button onClick={saveNetwork} disabled={savingNetwork}>
                  {savingNetwork ? "Saving..." : "Save Network Preferences"}
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Reusable toggle row */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
