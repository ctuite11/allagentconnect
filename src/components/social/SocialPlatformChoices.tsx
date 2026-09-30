import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialConnected,
  type SocialPlatform,
} from "@/lib/socialPublishing";

interface Props {
  connected: SocialConnected;
  selected: SocialPlatform[];
  onChange: (next: SocialPlatform[]) => void;
  /**
   * First-publish review only: a not-connected platform shows a Connect button
   * that starts the authorization flow. The later-update prompt omits this.
   */
  onConnectRequest?: (platform: SocialPlatform) => void;
  /** Connection-status state. Rows render in every state so layout never shifts. */
  status?: "loading" | "ready" | "error";
}

/** Four platform checkboxes. A profile link never counts as a publishing connection. */
export function SocialPlatformChoices({ connected, selected, onChange, onConnectRequest, status = "ready" }: Props) {
  const ready = status === "ready";
  const toggle = (p: SocialPlatform, on: boolean) => {
    const set = new Set(selected);
    if (on) set.add(p);
    else set.delete(p);
    onChange(SOCIAL_PLATFORMS.filter((x) => set.has(x)));
  };

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {SOCIAL_PLATFORMS.map((p) => {
        const isConnected = ready && connected[p];
        const id = `social-${p}`;
        const statusText = !ready
          ? status === "loading"
            ? "Checking…"
            : "Status unavailable"
          : isConnected
            ? "Connected for publishing"
            : "Not connected for publishing";
        const showConnect = ready && !isConnected && !!onConnectRequest;
        return (
          <li key={p} className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={isConnected && selected.includes(p)}
                disabled={!isConnected}
                onCheckedChange={(v) => {
                  if (!isConnected) return;
                  toggle(p, v === true);
                }}
              />
              <label htmlFor={id} className="flex flex-col">
                <span className="text-sm text-foreground">{SOCIAL_PLATFORM_LABELS[p]}</span>
                <span className="text-xs text-muted-foreground">{statusText}</span>
              </label>
            </div>
            <div className="flex h-8 w-20 items-center justify-end">
              {showConnect && (
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => onConnectRequest?.(p)}>
                  Connect
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
