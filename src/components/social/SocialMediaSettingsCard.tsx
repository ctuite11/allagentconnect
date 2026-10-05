import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";
import { ConnectSocialExplainerDialog } from "@/components/social/ConnectSocialExplainerDialog";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  fetchSocialConnected,
  hasAnyConnected,
  openSocialConnectPortal,
  type SocialConnected,
} from "@/lib/socialPublishing";

/**
 * Agent Settings → Social Publishing: publishing-permission connections
 * (separate from the public profile links, which live on Profile).
 */
export function SocialMediaSettingsCard() {
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [connected, setConnected] = useState<SocialConnected | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSocialConnected().then((c) => {
      if (cancelled) return;
      setConnected(c);
      setStatus(c ? "ready" : "unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const profileLine = (
    <p className={agentSectionDesc}>
      Looking for the social links on your profile?{" "}
      <Link to="/agent/profile#social-media" className="font-medium text-primary underline-offset-4 hover:underline">
        Edit them on your Profile
      </Link>
      .
    </p>
  );

  if (status === "unavailable") {
    return null;
  }

  return (
    <AgentSectionCard className="space-y-4 p-5 md:p-6">
      <div>
        <h2 className={agentSectionTitle}>Social Publishing</h2>
        <p className={`mt-0.5 ${agentSectionDesc}`}>
          Connect your social accounts to publish listings directly from All Agent Connect. These connections are
          separate from the social links displayed on your profile.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {SOCIAL_PLATFORMS.map((p) => (
          <li key={p} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-foreground">{SOCIAL_PLATFORM_LABELS[p]}</span>
            <span className="text-xs text-muted-foreground">
              {status === "loading" ? "Checking…" : connected?.[p] ? "Connected" : "Not connected"}
            </span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={status !== "ready"}
        onClick={() => setExplainerOpen(true)}
      >
        {hasAnyConnected(connected) ? "Manage connections" : "Connect accounts"}
      </Button>
      {profileLine}
      <ConnectSocialExplainerDialog
        open={explainerOpen}
        onCancel={() => setExplainerOpen(false)}
        onContinue={() => {
          setExplainerOpen(false);
          void openSocialConnectPortal(`${window.location.origin}/settings`);
        }}
      />
    </AgentSectionCard>
  );
}
