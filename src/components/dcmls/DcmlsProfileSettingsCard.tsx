import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAgentSettings } from "@/hooks/useAgentSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { DCMLS_BUYER_INCENTIVES, DCMLS_SELLER_INCENTIVES } from "@/constants/dcmlsIncentives";

const parseZips = (raw: string) =>
  Array.from(new Set(raw.split(/[\s,]+/).map((z) => z.trim()).filter(Boolean)));

/**
 * Profile editor "DCMLS settings" section. Data lives in private agent_settings,
 * never the public agent_profiles record. Separate from Communications/Hot Sheets.
 */
export function DcmlsProfileSettingsCard() {
  const [user, setUser] = useState<User | null>(null);
  const { settings, updateSettings } = useAgentSettings(user);
  const [savingParticipation, setSavingParticipation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zipText, setZipText] = useState("");
  const [sellerLeads, setSellerLeads] = useState<boolean | null>(null);
  const [buyerInc, setBuyerInc] = useState<string[]>([]);
  const [sellerInc, setSellerInc] = useState<string[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  useEffect(() => {
    if (!settings || hydrated.current) return;
    hydrated.current = true;
    setZipText((settings.dcmls_buyer_lead_zips ?? []).join(", "));
    setSellerLeads(settings.dcmls_receive_seller_leads ?? null);
    setBuyerInc(settings.dcmls_buyer_incentives ?? []);
    setSellerInc(settings.dcmls_seller_incentives ?? []);
    if (window.location.hash === "#dcmls-settings") {
      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [settings]);

  const participating = settings?.dcmls_participation === true;

  const toggleParticipation = async (next: boolean) => {
    setSavingParticipation(true);
    const ok = await updateSettings({
      dcmls_participation: next,
      dcmls_participation_at: next ? new Date().toISOString() : null,
    });
    setSavingParticipation(false);
    if (!ok) toast.error("Could not update DCMLS participation");
  };

  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

  const save = async () => {
    const zips = parseZips(zipText);
    const bad = zips.find((z) => !/^\d{5}$/.test(z));
    if (bad) {
      toast.error(`"${bad}" is not a 5-digit ZIP code`);
      return;
    }
    setSaving(true);
    const ok = await updateSettings({
      dcmls_buyer_lead_zips: zips.length ? zips : null,
      dcmls_receive_seller_leads: sellerLeads,
      dcmls_buyer_incentives: buyerInc.length ? buyerInc : null,
      dcmls_seller_incentives: sellerInc.length ? sellerInc : null,
    });
    setSaving(false);
    if (ok) {
      setZipText(zips.join(", "));
      toast.success("DCMLS settings saved");
    } else toast.error("Could not save DCMLS settings");
  };

  return (
    <Card
      id="dcmls-settings"
      ref={cardRef}
      className="scroll-mt-24 bg-white border border-zinc-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          DCMLS settings
        </CardTitle>
        <CardDescription className="text-zinc-500">
          Direct Connect MLS preferences. Separate from Communications and Hot Sheet settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-100 px-4 py-3">
          <div>
            <Label htmlFor="profile-dcmls-participation" className="text-sm font-medium">
              DCMLS Participation
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {participating ? "Opted in" : "Opted out"} — opting in does not publish any listing.
            </p>
          </div>
          <Switch
            id="profile-dcmls-participation"
            checked={participating}
            disabled={!settings || savingParticipation}
            onCheckedChange={(c) => void toggleParticipation(c)}
          />
        </div>

        {participating && (
          <>
            <div className="space-y-2">
              <Label htmlFor="dcmls-zips">Buyer-lead ZIP coverage</Label>
              <Input
                id="dcmls-zips"
                inputMode="numeric"
                spellCheck={false}
                autoComplete="off"
                placeholder="02114, 02116"
                value={zipText}
                maxLength={2000}
                onChange={(e) => setZipText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate ZIP codes with commas.</p>
            </div>

            <div className="space-y-2">
              <Label>Receive seller leads</Label>
              <RadioGroup
                className="flex gap-6"
                value={sellerLeads === null ? "" : sellerLeads ? "yes" : "no"}
                onValueChange={(v) => setSellerLeads(v === "yes")}
              >
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" /> No</label>
              </RadioGroup>
            </div>

            {[
              { label: "Buyer incentives", opts: DCMLS_BUYER_INCENTIVES, val: buyerInc, set: setBuyerInc },
              { label: "Seller incentives", opts: DCMLS_SELLER_INCENTIVES, val: sellerInc, set: setSellerInc },
            ].map((g) => (
              <div key={g.label} className="space-y-2">
                <Label>{g.label}</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {g.opts.map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={g.val.includes(o)} onCheckedChange={() => toggle(g.val, g.set, o)} />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving..." : "Save DCMLS settings"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
