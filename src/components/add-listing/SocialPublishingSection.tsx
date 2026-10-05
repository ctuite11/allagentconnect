import { SocialPlatformChoices } from "@/components/social/SocialPlatformChoices";
import type { SocialConnected, SocialPlatform } from "@/lib/socialPublishing";

type SocialPublishingSectionProps = {
  connected: SocialConnected;
  selected: SocialPlatform[];
  saving: boolean;
  onChange: (next: SocialPlatform[]) => void;
  onConnectRequest: (platform: SocialPlatform) => void;
};

/** First-publish social defaults, configured before the listing review step. */
export function SocialPublishingSection({
  connected,
  selected,
  saving,
  onChange,
  onConnectRequest,
}: SocialPublishingSectionProps) {
  return (
    <section className="mt-8 border-t border-border pt-6" aria-labelledby="social-publishing-heading">
      <div className="mb-4">
        <h2 id="social-publishing-heading" className="text-base font-semibold text-foreground">
          Share this listing on social media
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selected networks will publish when this listing is published.
        </p>
      </div>
      <SocialPlatformChoices
        connected={connected}
        selected={selected}
        onChange={onChange}
        onConnectRequest={onConnectRequest}
        disabled={saving}
      />
    </section>
  );
}