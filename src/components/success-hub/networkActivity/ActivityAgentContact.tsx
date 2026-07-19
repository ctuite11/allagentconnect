import { useState } from "react";
import { Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import AgentIntelDrawer from "@/components/agent-search/AgentIntelDrawer";
import ContactAgentProfileDialog from "@/components/ContactAgentProfileDialog";

export type ActivityAgentContactProps = {
  agentId: string;
  agentName: string;
  agentEmail: string | null;
  agentPhone: string | null;
};

/**
 * Reusable in-place agent contact row for Success Hub Network Activity feeds.
 * - Name → opens AgentIntelDrawer (no navigation)
 * - Phone → tel: link
 * - Email → opens ContactAgentProfileDialog (preferred) or mailto: fallback
 * Scroll position is preserved because every action happens in-place.
 */
export function ActivityAgentContact({
  agentId,
  agentName,
  agentEmail,
  agentPhone,
}: ActivityAgentContactProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAgent, setDrawerAgent] = useState<any | null>(null);

  const openDrawer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!agentId) return;
    // Fetch the full agent_profile so AgentIntelDrawer renders correctly.
    const { data } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("id", agentId)
      .maybeSingle();
    setDrawerAgent(
      data ?? {
        id: agentId,
        first_name: agentName.split(" ")[0] ?? agentName,
        last_name: agentName.split(" ").slice(1).join(" "),
        email: agentEmail ?? "",
        headshot_url: null,
        company: null,
        aac_id: null,
      },
    );
    setDrawerOpen(true);
  };

  const formattedPhone = agentPhone ? formatPhoneNumber(agentPhone) : null;
  const phoneHref = agentPhone ? `tel:${agentPhone.replace(/[^\d+]/g, "")}` : null;

  return (
    <div className="mt-1.5 space-y-0.5 text-[11px] text-neutral-600">
      <button
        type="button"
        onClick={openDrawer}
        className="block max-w-full truncate text-left font-medium text-[#0E56F5] hover:underline underline-offset-2"
      >
        {agentName}
      </button>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {phoneHref && formattedPhone && formattedPhone !== "—" ? (
          <a
            href={phoneHref}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-neutral-600 transition-colors hover:text-[#0E56F5]"
          >
            <Phone className="h-3 w-3" aria-hidden />
            {formattedPhone}
          </a>
        ) : null}
        {agentEmail ? (
          <span
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1"
          >
            <Mail className="h-3 w-3 text-neutral-500" aria-hidden />
            <ContactAgentProfileDialog
              agentId={agentId}
              agentName={agentName}
              agentEmail={agentEmail}
              buttonText={agentEmail}
              triggerClassName="!h-auto !p-0 !bg-transparent !text-[11px] !font-normal !text-neutral-600 hover:!text-[#0E56F5] !shadow-none [&_svg]:hidden"
            />
          </span>
        ) : null}
      </div>
      <AgentIntelDrawer
        agent={drawerAgent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}

export default ActivityAgentContact;