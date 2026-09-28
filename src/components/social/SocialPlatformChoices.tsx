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
}

/** Four platform checkboxes. Not-connected platforms are shown but cannot be picked. */
export function SocialPlatformChoices({ connected, selected, onChange }: Props) {
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
            <label htmlFor={id} className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                id={id}
                checked={isConnected && selected.includes(p)}
                disabled={!isConnected}
                onCheckedChange={(v) => toggle(p, v === true)}
              />
              {SOCIAL_PLATFORM_LABELS[p]}
            </label>
            {!isConnected && <span className="text-xs text-muted-foreground">Not connected</span>}
          </li>
        );
      })}
    </ul>
  );
}
