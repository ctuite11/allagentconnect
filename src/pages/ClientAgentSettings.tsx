import { useEffect, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Mail, Phone, UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { clearPrimaryAgentId } from "@/utils/agentTracking";
import {
  buyerPageMain,
  buyerPageShell,
  buyerSectionCard,
  buyerSectionDesc,
  buyerSectionTitle,
  buyerOutlineSecondary,
} from "@/lib/buyerUi";
import { displayNameFromProfile, profileInitials, upsertBuyerProfile } from "@/lib/buyerProfile";

interface AgentInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  cell_phone: string | null;
  company: string | null;
  title: string | null;
  headshot_url: string | null;
}

const ClientAgentSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [, setRelationshipId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    void checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to view your account");
      navigate("/auth");
      return;
    }

    setCurrentUserId(user.id);
    await Promise.all([loadBuyerProfile(user.id, user.email), loadAgentRelationship(user.id)]);
  };

  const loadBuyerProfile = async (userId: string, authEmail: string | null | undefined) => {
    try {
      setLoading(true);
      const { data: profileRow, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone, email")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      setFirstName(profileRow?.first_name?.trim() ?? "");
      setLastName(profileRow?.last_name?.trim() ?? "");
      setPhone(profileRow?.phone?.trim() ?? "");
      setEmail(profileRow?.email?.trim() || authEmail?.trim() || "");
    } catch (error: unknown) {
      console.error("Error loading buyer profile:", error);
      toast.error("Failed to load your account information");
    } finally {
      setLoading(false);
    }
  };

  const loadAgentRelationship = async (userId: string) => {
    try {
      const { data: relationship, error: relError } = await supabase
        .from("client_agent_relationships")
        .select("id, agent_id")
        .eq("client_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (relError) throw relError;

      if (relationship) {
        setRelationshipId(relationship.id);

        const { data: agentData, error: agentError } = await supabase
          .from("agent_profiles")
          .select(
            "id, first_name, last_name, email, phone, cell_phone, company, title, headshot_url",
          )
          .eq("id", relationship.agent_id)
          .maybeSingle();

        if (agentError) throw agentError;
        setAgent(agentData as AgentInfo | null);
      } else {
        setRelationshipId(null);
        setAgent(null);
      }
    } catch (error: unknown) {
      console.error("Error loading agent relationship:", error);
      toast.error("Failed to load agent information");
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUserId) {
      toast.error("Please sign in again and retry");
      return;
    }
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await upsertBuyerProfile({
        userId: currentUserId,
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
      });
      if (error) throw error;
      toast.success("Your information was saved");
    } catch (error: unknown) {
      console.error("Error saving buyer profile:", error);
      const message = error instanceof Error ? error.message : "Failed to save your information";
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEndRelationship = async () => {
    if (!currentUserId) {
      toast.error("Please sign in again and retry");
      return;
    }

    try {
      setEnding(true);
      const { error } = await supabase.rpc("end_client_relationship");
      if (error) throw error;

      toast.success("Relationship ended successfully");
      clearPrimaryAgentId();
      setAgent(null);
      setRelationshipId(null);
      await loadAgentRelationship(currentUserId);
    } catch (error: unknown) {
      console.error("Error ending relationship:", error);
      const message = error instanceof Error ? error.message : "Failed to end relationship";
      toast.error(message);
    } finally {
      setEnding(false);
    }
  };

  const buyerDisplayName = displayNameFromProfile(firstName, lastName, email);
  const buyerInitials = profileInitials(firstName, lastName, email);

  if (loading) {
    return (
      <div className={`${buyerPageShell} pt-20`} aria-busy="true" role="status">
        <span className="sr-only">Loading your account…</span>
        <main className={buyerPageMain}>
          <div className="mx-auto max-w-2xl space-y-6">
            <Skeleton className="h-10 w-[200px] rounded-md bg-neutral-100" />
            <Skeleton className="h-4 w-[min(100%,360px)] rounded-md bg-neutral-100" />
            <Skeleton className="h-48 w-full rounded-2xl bg-neutral-100" />
            <Skeleton className="h-56 w-full rounded-2xl bg-neutral-100" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`${buyerPageShell} pt-20`}>
      <main className={buyerPageMain}>
        <div className="mx-auto max-w-2xl space-y-8">
          <div>
            <PageTitle className="mb-2 text-neutral-950">Account</PageTitle>
            <p className={buyerSectionDesc}>Manage your contact information and agent relationship</p>
          </div>

          <section className={`${buyerSectionCard} p-4 md:p-5 lg:p-6`}>
            <div className="mb-5">
              <h2 className={buyerSectionTitle}>Your information</h2>
              <p className={`${buyerSectionDesc} mt-1`}>Used across your dashboard and agent communications</p>
            </div>

            <div className="flex max-w-full items-start gap-3 sm:gap-4">
              <Avatar className="h-[60px] w-[60px] shrink-0 border border-neutral-200 ring-0 sm:h-16 sm:w-16">
                <AvatarImage src="" alt="" />
                <AvatarFallback className="bg-neutral-100 text-sm font-medium text-neutral-600">
                  {buyerInitials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="space-y-0.5">
                  <p className="text-[13px] font-semibold text-neutral-900 sm:text-sm">
                    {buyerDisplayName || "Your profile"}
                  </p>
                  <p className="text-[11px] text-neutral-500 sm:text-xs">Buyer</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="buyer-first-name" className="text-[13px] text-neutral-700">
                      First name
                    </Label>
                    <Input
                      id="buyer-first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      className="h-9 border-neutral-200 bg-white text-[13px] shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="buyer-last-name" className="text-[13px] text-neutral-700">
                      Last name
                    </Label>
                    <Input
                      id="buyer-last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      className="h-9 border-neutral-200 bg-white text-[13px] shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="buyer-phone" className="text-[13px] text-neutral-700">
                      Phone number
                    </Label>
                    <div className="relative">
                      <Phone
                        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                        aria-hidden
                      />
                      <Input
                        id="buyer-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="tel"
                        className="h-9 border-neutral-200 bg-white pl-9 text-[13px] shadow-sm"
                        placeholder="(555) 555-5555"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="buyer-email" className="text-[13px] text-neutral-700">
                      Email address
                    </Label>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#0E56F5]"
                        aria-hidden
                      />
                      <Input
                        id="buyer-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        className="h-9 border-neutral-200 bg-white pl-9 text-[13px] shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={savingProfile}
                    className="h-9 rounded-full bg-[#0E56F5] px-4 text-[13px] font-medium text-white shadow-sm hover:bg-[#0B46CC]"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className={`${buyerSectionCard} overflow-hidden`}>
            <div className="border-b border-neutral-100 px-4 py-4 md:px-5 lg:px-6">
              <h2 className={buyerSectionTitle}>My Agent</h2>
              <p className={`${buyerSectionDesc} mt-1`}>View and manage your agent relationship</p>
            </div>

            {!agent ? (
              <div className="space-y-4 px-4 py-5 md:px-5 lg:px-6">
                <p className={buyerSectionDesc}>
                  You do not have an active agent right now. Your saved homes and searches stay on your account.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className={buyerOutlineSecondary}
                  onClick={() => navigate("/")}
                >
                  Continue your home search
                </Button>
              </div>
            ) : (
              <div className="space-y-6 px-4 py-5 md:px-5 lg:px-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 shrink-0 border border-neutral-200">
                    <AvatarImage src={agent.headshot_url || ""} />
                    <AvatarFallback className="bg-neutral-100 text-sm font-medium text-neutral-600">
                      {agent.first_name?.[0]}
                      {agent.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-[13px] font-semibold text-neutral-900 sm:text-sm">
                      {agent.first_name} {agent.last_name}
                    </p>
                    {agent.title ? (
                      <p className="text-[11px] text-neutral-500 sm:text-xs">{agent.title}</p>
                    ) : null}
                    {agent.company ? (
                      <p className="text-[11px] text-neutral-500 sm:text-xs">{agent.company}</p>
                    ) : null}
                    {agent.email ? (
                      <p className="flex items-center gap-2 pt-1 text-[13px] text-neutral-800">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" aria-hidden />
                        <span className="min-w-0 truncate">{agent.email}</span>
                      </p>
                    ) : null}
                    {agent.phone || agent.cell_phone ? (
                      <p className="flex items-center gap-2 text-[13px] text-neutral-800">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <a
                          href={`tel:${agent.cell_phone || agent.phone}`}
                          className="hover:underline"
                        >
                          {agent.cell_phone || agent.phone}
                        </a>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:gap-3">
                  <Button
                    type="button"
                    onClick={() => navigate(`/agent/${agent.id}`)}
                    className="h-9 flex-1 rounded-full bg-[#0E56F5] text-[13px] font-medium text-white shadow-sm hover:bg-[#0B46CC]"
                  >
                    Contact {agent.first_name}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`h-9 flex-1 ${buyerOutlineSecondary}`}
                      >
                        <UserX className="mr-2 h-4 w-4" aria-hidden />
                        End relationship
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border border-neutral-200 bg-white sm:rounded-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>End relationship?</AlertDialogTitle>
                        <AlertDialogDescription>
                          You can keep your account active after ending this relationship. Your saved homes,
                          searches, and profile stay with you.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void handleEndRelationship()}
                          disabled={ending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {ending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                              Ending…
                            </>
                          ) : (
                            "End relationship"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ClientAgentSettings;
