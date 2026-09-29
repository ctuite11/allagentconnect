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
}

/** Four platform checkboxes. */
export function SocialPlatformChoices({ connected, selected, onChange, onConnectRequest }: Props) {
  const toggle = (p: SocialPlatform, on: boolean) => {
    const set = new Set(selected);
    if (on) set.add(p);
    else set.delete(p);
    onChange(SOCIAL_PLATFORMS.filter((x) => set.has(x)));
  };

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {SOCIAL_PLATFORMS.map((p) => {
        const isConnected = connected[p];
        const id = `social-${p}`;
        return (
          <li key={p} className="flex items-center justify-between px-3 py-2">
            <label
              htmlFor={id}
              className={`flex items-center gap-2 text-sm text-foreground ${!isConnected && onConnectRequest ? "cursor-pointer" : ""}`}
            >
              <Checkbox
                id={id}
                checked={isConnected && selected.includes(p)}
                disabled={!isConnected && !onConnectRequest}
                onCheckedChange={(v) => {
                  if (!isConnected) {
                    if (onConnectRequest) onConnectRequest(p);
                    return;
                  }
                  toggle(p, v === true);
                }}
              />
              {SOCIAL_PLATFORM_LABELS[p]}
            </label>
            {!isConnected && (
              <span className="text-xs text-muted-foreground">
                Not connected{onConnectRequest ? " — click to connect" : ""}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
