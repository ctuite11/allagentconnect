import { Linkedin, Facebook, Instagram, Globe, AtSign } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

/**
 * Profile → Social Media: public links only. Publishing authorization lives in
 * the listing publish flow ("Ready to publish?"), never here.
 */
const SocialLinksSection = ({ socialLinks, onChange }: SocialLinksSectionProps) => {
  const socialInputs: {
    key: LinkKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    placeholder: string;
    iconColor: string;
  }[] = [
    { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourpage", iconColor: "text-[hsl(220,46%,48%)]" },
    { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourprofile", iconColor: "text-[hsl(340,75%,54%)]" },
    { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/in/yourprofile", iconColor: "text-[hsl(201,100%,35%)]" },
    { key: "threads", label: "Threads", icon: AtSign, placeholder: "https://threads.net/@yourhandle", iconColor: "text-foreground" },
    { key: "twitter", label: "X", icon: XIcon, placeholder: "https://x.com/yourhandle", iconColor: "text-foreground" },
    { key: "website", label: "Website", icon: Globe, placeholder: "https://yourwebsite.com", iconColor: "text-primary" },
  ];

  return (
    <div className="space-y-5">
      {socialInputs.map(({ key, label, icon: Icon, placeholder, iconColor }) => (
        <div key={key}>
          <Label htmlFor={`social-${key}`} className="text-sm font-medium mb-1.5 block">
            {label}
          </Label>
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
        </div>
      ))}
    </div>
  );
};

export default SocialLinksSection;
