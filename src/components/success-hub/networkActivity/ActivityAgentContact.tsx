import { Mail, Phone } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
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
  const formattedPhone = agentPhone ? formatPhoneNumber(agentPhone) : null;
  const phoneHref = agentPhone ? `tel:${agentPhone.replace(/[^\d+]/g, "")}` : null;

  return (
    <div className="mt-1.5 space-y-0.5 text-[11px] text-neutral-600">
      <div className="block max-w-full truncate font-medium text-zinc-900">
        {agentName}
      </div>
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
    </div>
  );
}

export default ActivityAgentContact;