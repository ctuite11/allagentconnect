import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { DeveloperPortalPage } from "@/components/layout/DeveloperPortalPage";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeveloperAccessGate } from "@/components/developments/DeveloperDevelopmentLayout";
import { Seo } from "@/components/Seo";
import { useAuthRole } from "@/hooks/useAuthRole";
import { canMemberEditContent, slugifyDevelopmentName } from "@/lib/developments/publishStatus";
import {
  createDevelopment,
  fetchMyDevelopmentMemberships,
} from "@/lib/developments/workspace";
import type { DeveloperAccountSummary } from "@/lib/resolveUserRole";
import { normalizeGooglePlace } from "@/lib/google-address";
import { toast } from "sonner";

function CreateInner() {
  const navigate = useNavigate();
  const {
    developerAccounts,
    developerAccountCount,
    primaryDeveloperAccountId,
    isAdmin,
  } = useAuthRole();
  const [membershipFallback, setMembershipFallback] = useState<DeveloperAccountSummary[] | null>(
    null,
  );

  useEffect(() => {
    if (developerAccounts.length > 0) {
      setMembershipFallback(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { memberships } = await fetchMyDevelopmentMemberships();
      if (cancelled) return;
      setMembershipFallback(
        memberships.map((m) => ({
          account_id: m.account_id,
          name: m.account?.name ?? null,
          slug: m.account?.slug ?? null,
          member_role: m.role,
          is_active: m.account?.is_active ?? null,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [developerAccounts.length]);

  const sourceAccounts = developerAccounts.length > 0 ? developerAccounts : membershipFallback ?? [];

  const editableAccounts = useMemo(() => {
    return sourceAccounts.filter((account) => {
      if (isAdmin) return true;
      if (!account.member_role) return true;
      return canMemberEditContent(account.member_role);
    });
  }, [sourceAccounts, isAdmin]);

  const showAccountPicker = editableAccounts.length > 1;
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const resolvedAccountId =
    (accountId && editableAccounts.some((a) => a.account_id === accountId) && accountId) ||
    (primaryDeveloperAccountId &&
      editableAccounts.some((a) => a.account_id === primaryDeveloperAccountId) &&
      primaryDeveloperAccountId) ||
    editableAccounts[0]?.account_id ||
    "";

  const selectedAccount =
    editableAccounts.find((a) => a.account_id === resolvedAccountId) ??
    editableAccounts[0] ??
    null;

  const onPlaceSelect = (place: unknown) => {
    const normalized = normalizeGooglePlace(place as never);
    setAddressLine(normalized.address_line1 || "");
    setCity(normalized.city || "");
    setState(normalized.state || "");
    setPostalCode(normalized.zip || "");
    setLatitude(normalized.lat ?? null);
    setLongitude(normalized.lng ?? null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const account = selectedAccount;
    if (!account || !name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    if (!addressLine.trim() && !city.trim()) {
      toast.error("Add a property address so agents can find this project.");
      return;
    }

    const slug = slugifyDevelopmentName(name);
    if (!slug) {
      toast.error("Could not generate a URL slug from the project name.");
      return;
    }

    setSaving(true);
    const { development, error } = await createDevelopment({
      accountId: account.account_id,
      name,
      slug,
      address: addressLine.trim() || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      latitude,
      longitude,
      developerName: account.name || null,
    });
    setSaving(false);
    if (error || !development) {
      toast.error(error ?? "Could not create development.");
      return;
    }
    toast.success("Development created as draft.");
    navigate(`/developer/developments/${development.id}`, { replace: true });
  };

  return (
    <DeveloperPortalPage>
      <Seo title="New development | All Agent Connect" noindex />
      <PageHeader
        title="Create development"
        subtitle="Starts as a draft until you submit for AAC review."
        backTo="/developer"
      />

      {editableAccounts.length === 0 ? (
        <p className="text-sm text-zinc-600">
          {developerAccountCount === 0
            ? "Your developer account is not linked to a company yet. Contact AAC to finish provisioning."
            : "You need owner or editor access on a developer company to create projects."}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="max-w-xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6"
        >
          {showAccountPicker ? (
            <div className="space-y-2">
              <Label htmlFor="account">Developer / Company</Label>
              <Select value={resolvedAccountId} onValueChange={setAccountId}>
                <SelectTrigger id="account">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {editableAccounts.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.name ?? account.account_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Harbor Residences"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Property address</Label>
            <AddressAutocomplete
              value={addressLine}
              onChange={setAddressLine}
              onPlaceSelect={onPlaceSelect}
              placeholder="Start typing the street address"
              className="w-full"
            />
            {(city || state || postalCode) && (
              <p className="text-xs text-zinc-500">
                {[city, state, postalCode].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create development"}
          </Button>
        </form>
      )}
    </DeveloperPortalPage>
  );
}

export default function DeveloperCreateDevelopmentPage() {
  return (
    <DeveloperAccessGate>
      <CreateInner />
    </DeveloperAccessGate>
  );
}
