import { useEffect, useState } from "react";
import { Linkedin, Facebook, Instagram, Globe, AtSign } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  fetchSocialConnected,
  openSocialConnectPortal,
  type SocialConnected,
  type SocialPlatform,
} from "@/lib/socialPublishing";

interface SocialLinks {
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
  threads: string;
  website: string;
}

interface SocialLinksSectionProps {
  socialLinks: SocialLinks;
  onChange: (links: SocialLinks) => void;
}

type LinkKey = keyof SocialLinks;

const SocialLinksSection = ({ socialLinks, onChange }: SocialLinksSectionProps) => {
  // null = status unavailable (not allowed OR request failed) -> hide publishing controls.
  const [connected, setConnected] = useState<SocialConnected | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSocialConnected().then((c) => {
      if (!cancelled) setConnected(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    setOpening(true);
    await openSocialConnectPortal(`${window.location.origin}/agent/profile#social-media`);
    setOpening(false);
  };

  const socialInputs: {
    key: LinkKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    placeholder: string;
    iconColor: string;
    platform?: SocialPlatform;
  }[] = [
    { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourpage", iconColor: "text-[hsl(220,46%,48%)]", platform: "FACEBOOK" },
    { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourprofile", iconColor: "text-[hsl(340,75%,54%)]", platform: "INSTAGRAM" },
    { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/in/yourprofile", iconColor: "text-[hsl(201,100%,35%)]", platform: "LINKEDIN" },
    { key: "threads", label: "Threads", icon: AtSign, placeholder: "https://threads.net/@yourhandle", iconColor: "text-foreground", platform: "THREADS" },
    { key: "twitter", label: "X", icon: XIcon, placeholder: "https://x.com/yourhandle", iconColor: "text-foreground" },
    { key: "website", label: "Website", icon: Globe, placeholder: "https://yourwebsite.com", iconColor: "text-primary" },
  ];

  return (
    <div className="space-y-5">
      {socialInputs.map(({ key, label, icon: Icon, placeholder, iconColor, platform }) => {
        const isConnected = platform && connected ? connected[platform] : false;
        return (
          <div key={key}>
            <Label htmlFor={`social-${key}`} className="text-sm font-medium mb-1.5 block">
              {label}
            </Label>
            {platform && connected && (
              <p className="text-xs text-muted-foreground mb-1">Public profile/page</p>
            )}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <Input
                id={`social-${key}`}
                type="url"
                spellCheck={false}
                placeholder={placeholder}
                value={socialLinks[key] ?? ""}
                onChange={(e) => onChange({ ...socialLinks, [key]: e.target.value })}
                className="pl-11"
              />
            </div>
            {platform && connected && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Publishing connection: </span>
                  <span className={isConnected ? "font-medium text-primary" : "font-medium text-muted-foreground"}>
                    {isConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={connect} disabled={opening}>
                  {opening ? "Opening…" : isConnected ? "Manage Connection" : "Connect for Publishing"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SocialLinksSection;
