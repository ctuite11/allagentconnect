import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

/**
 * Best-effort: notify verified-but-never-activated agents before admin delete.
 * Must run while agent_settings still exist. Never throws — delete must proceed.
 */
export async function enqueueVerifiedInactiveAgentRemovalEmail(opts: {
  agentId: string;
  email: string;
  firstName: string;
}): Promise<void> {
  try {
    await invokeEdgeFunction("send-agent-account-removed-email", {
      agentId: opts.agentId,
      email: opts.email,
      firstName: opts.firstName,
    });
  } catch (err) {
    console.warn(
      "[enqueueVerifiedInactiveAgentRemovalEmail] non-fatal enqueue failure:",
      err,
    );
  }
}
