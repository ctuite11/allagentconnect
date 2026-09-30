import { Check } from "lucide-react";
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
   * First-publish review only: a not-connected platform shows Connect.
   * The later-update prompt omits this, so unconnected rows show a disabled Share.
   */
  onConnectRequest?: (platform: SocialPlatform) => void;
  /** Connection-status state. Every state uses identical row/button dimensions. */
  status?: "loading" | "ready" | "error";
}

/**
 * One button per network: Connect / Share / ✓ Share. Share only toggles this
 * listing's selection — it never disconnects an account (that lives in Settings).
 */
export function SocialPlatformChoices({ connected, selected, onChange, onConnectRequest, status = "ready" }: Props) {
  const ready = status === "ready";
  const toggle = (p: SocialPlatform) => {
    const set = new Set(selected);
    if (set.has(p)) set.delete(p);
    else set.add(p);
    onChange(SOCIAL_PLATFORMS.filter((x) => set.has(x)));
  };

  // Fixed width/height so swapping state never moves the row or resizes the modal.
  const btn = "h-8 w-28 justify-center gap-1";

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {SOCIAL_PLATFORMS.map((p) => {
        const isConnected = ready && connected[p];
        const isSelected = isConnected && selected.includes(p);
        let action;
        if (!ready) {
          action = (
            <Button type="button" size="sm" variant="outline" className={btn} disabled aria-label={`${SOCIAL_PLATFORM_LABELS[p]} status loading`}>
              …
            </Button>
          );
        } else if (!isConnected) {
          action = onConnectRequest ? (
            <Button type="button" size="sm" variant="outline" className={btn} onClick={() => onConnectRequest(p)}>
              Connect
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" className={btn} disabled>
              Share
            </Button>
          );
        } else {
          action = (
            <Button
              type="button"
              size="sm"
              variant={isSelected ? "default" : "outline"}
              className={btn}
              aria-pressed={isSelected}
              onClick={() => toggle(p)}
            >
              {isSelected && <Check className="h-4 w-4" aria-hidden />}
              Share
            </Button>
          );
        }
        return (
          <li key={p} className="flex h-12 items-center justify-between px-3">
            <span className="text-sm text-foreground">{SOCIAL_PLATFORM_LABELS[p]}</span>
            {action}
          </li>
        );
      })}
    </ul>
  );
}
