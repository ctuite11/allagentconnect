import { useState } from "react";
import { Mail, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AgentPhotoTile from "@/components/agent-directory/AgentPhotoTile";
import AgentEmailQuickDialog from "@/components/agent-search/AgentEmailQuickDialog";
import type { AgentProfileRow } from "@/lib/resolveAgentProfileForViewer";

interface AgentMessageProfileDrawerProps {
  agent: AgentProfileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Comms Center agent pop-up — reuses the Agent Network `AgentPhotoTile` card
 * (large headshot, name, brokerage, email, phone) plus the established
 * authenticated Email flow (`AgentEmailQuickDialog`). Not AgentIntelDrawer.
 * Closing returns to the exact message thread with no route change.
 */
export function AgentMessageProfileDrawer({
  agent,
  open,
  onOpenChange,
}: AgentMessageProfileDrawerProps) {
  const [emailOpen, setEmailOpen] = useState(false);

  if (!agent) return null;

  const firstName =
    typeof agent.first_name === "string" ? agent.first_name.trim() : "";
  const lastName =
    typeof agent.last_name === "string" ? agent.last_name.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim() || "Agent";
  const email =
    typeof agent.email === "string" && agent.email.trim() ? agent.email.trim() : "";
  const emailLabel = firstName ? `Email ${firstName}` : "Email";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-[min(100vw-1.5rem,320px)] gap-3 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-[320px] [&>button]:hidden"
        >
          <div className="sr-only">
            <DialogTitle>{fullName}</DialogTitle>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="absolute right-2.5 top-2.5 z-10 rounded-full bg-white/90 p-1.5 text-zinc-500 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>

            {/* Same visual card as Agent Network (`OurAgents` → AgentPhotoTile). */}
            <AgentPhotoTile agent={agent} interactive={false} />
          </div>

          <Button
            type="button"
            className="h-10 w-full gap-2 rounded-xl bg-[#0E56F5] text-[14px] font-medium text-white shadow-sm hover:bg-[#0E56F5]/90"
            disabled={!email}
            onClick={() => setEmailOpen(true)}
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{emailLabel}</span>
          </Button>
        </DialogContent>
      </Dialog>

      <AgentEmailQuickDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        agentName={fullName}
        agentEmail={email}
      />
    </>
  );
}

export default AgentMessageProfileDrawer;
