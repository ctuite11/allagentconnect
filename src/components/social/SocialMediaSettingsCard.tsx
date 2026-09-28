import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  fetchSocialConnected,
  openSocialConnectPortal,
  type SocialConnected,
} from "@/lib/socialPublishing";

/** Agent Settings → Social Media. Hidden for accounts the server does not allow. */
export function SocialMediaSettingsCard() {
  const [connected, setConnected] = useState<SocialConnected | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSocialConnected().then((c) => {
      if (cancelled) return;
      setConnected(c);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !connected) return null;

  const connect = async () => {
    setOpening(true);
    await openSocialConnectPortal();
    setOpening(false);
  };

  return (
    <AgentSectionCard className="space-y-4 p-5 md:p-6">
      <div>
        <h2 className={agentSectionTitle}>Social Media</h2>
        <p className={`mt-0.5 ${agentSectionDesc}`}>
          Connect accounts to share your listings when you publish or update them.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {SOCIAL_PLATFORMS.map((p) => (
          <li key={p} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-foreground">{SOCIAL_PLATFORM_LABELS[p]}</span>
            <span className={connected[p] ? "text-sm text-primary" : "text-sm text-muted-foreground"}>
              {connected[p] ? "Connected" : "Not connected"}
            </span>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="outline" onClick={connect} disabled={opening}>
        {opening ? "Opening…" : "Connect or manage accounts"}
      </Button>
    </AgentSectionCard>
  );
}
