import { Checkbox } from "@/components/ui/checkbox";
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
   * First-publish review only: clicking a not-connected platform starts the
   * hosted authorization flow instead of staying disabled.
   * The later-update prompt omits this and keeps the disabled behavior.
   */
  onConnectRequest?: (platform: SocialPlatform) => void;
  /** Connection-status state. Rows render in every state so layout never shifts. */
  status?: "loading" | "ready" | "error";
}

/** Four platform checkboxes. */
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
        const clickableConnect = ready && !isConnected && !!onConnectRequest;
        const rightText = !ready
          ? status === "loading"
            ? "Checking…"
            : "Status unavailable"
          : isConnected
            ? onConnectRequest
              ? "Connected"
              : null
            : `Not connected${onConnectRequest ? " — click to connect" : ""}`;
        return (
          <li key={p} className="flex min-h-10 items-center justify-between px-3 py-2">
            <label
              htmlFor={id}
              className={`flex items-center gap-2 text-sm text-foreground ${clickableConnect ? "cursor-pointer" : ""}`}
            >
              <Checkbox
                id={id}
                checked={isConnected && selected.includes(p)}
                disabled={!ready || (!isConnected && !onConnectRequest)}
                onCheckedChange={(v) => {
                  if (!ready) return;
                  if (!isConnected) {
                    if (onConnectRequest) onConnectRequest(p);
                    return;
                  }
                  toggle(p, v === true);
                }}
              />
              {SOCIAL_PLATFORM_LABELS[p]}
            </label>
            {rightText && <span className="text-xs text-muted-foreground">{rightText}</span>}
          </li>
        );
      })}
    </ul>
  );
}
