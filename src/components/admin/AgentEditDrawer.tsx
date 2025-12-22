import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User, Building, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface AgentData {
  id: string;
  aac_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  bio: string | null;
  license_number: string | null;
  license_state: string | null;
  agent_status: string;
  created_at: string;
}

interface AgentEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentData | null;
  onSaved: () => void;
}

const stateOptions = [
  { value: "MA", label: "Massachusetts" },
  { value: "CT", label: "Connecticut" },
  { value: "RI", label: "Rhode Island" },
  { value: "NH", label: "New Hampshire" },
  { value: "ME", label: "Maine" },
  { value: "VT", label: "Vermont" },
  { value: "NY", label: "New York" },
  { value: "NJ", label: "New Jersey" },
  { value: "PA", label: "Pennsylvania" },
];

export function AgentEditDrawer({ open, onOpenChange, agent, onSaved }: AgentEditDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    bio: "",
    license_number: "",
    license_state: "",
  });

  useEffect(() => {
    if (agent) {
      setFormData({
        first_name: agent.first_name || "",
        last_name: agent.last_name || "",
        email: agent.email || "",
        phone: agent.phone || "",
        company: agent.company || "",
        bio: agent.bio || "",
        license_number: agent.license_number || "",
        license_state: agent.license_state || "",
      });
    }
  }, [agent]);

  const handleSave = async () => {
    if (!agent) return;
    
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim()) {
      toast.error("First name, last name, and email are required");
      return;
    }

    setSaving(true);
    try {
      // Update agent_profiles
      const { error: profileError } = await supabase
        .from("agent_profiles")
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          company: formData.company.trim() || null,
          bio: formData.bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agent.id);

      if (profileError) throw profileError;

      // Update license info in agent_settings (upsert)
      if (formData.license_number || formData.license_state) {
        const { error: settingsError } = await supabase
          .from("agent_settings")
          .upsert({
            user_id: agent.id,
            license_number: formData.license_number.trim() || null,
            license_state: formData.license_state || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (settingsError) throw settingsError;
      }

      toast.success("Agent updated successfully");
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update agent: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!agent) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto bg-[#FAFAF8]">
        <SheetHeader>
          <SheetTitle className="text-left flex items-center gap-2">
            <User className="h-5 w-5 text-slate-600" />
            Edit Agent
          </SheetTitle>
          <SheetDescription className="text-left">
            {agent.aac_id} • {agent.email}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Personal Info Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-[#F7F6F3] border border-slate-200">
                <User className="h-4 w-4 text-slate-600" />
              </div>
              <h3 className="font-semibold text-foreground">Personal Info</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="border-slate-200"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="border-slate-200"
              />
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="border-slate-200"
              />
            </div>
          </div>

          {/* Company Info Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-[#F7F6F3] border border-slate-200">
                <Building className="h-4 w-4 text-slate-600" />
              </div>
              <h3 className="font-semibold text-foreground">Company</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="border-slate-200"
              />
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="border-slate-200 resize-none"
                placeholder="Agent bio..."
              />
            </div>
          </div>

          {/* License Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-[#F7F6F3] border border-slate-200">
                <FileText className="h-4 w-4 text-slate-600" />
              </div>
              <h3 className="font-semibold text-foreground">License Info</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="license_state">State</Label>
                <Select
                  value={formData.license_state}
                  onValueChange={(value) => setFormData({ ...formData, license_state: value })}
                >
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {stateOptions.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_number">License #</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  className="border-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 pt-4 border-t border-slate-200">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-200"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
