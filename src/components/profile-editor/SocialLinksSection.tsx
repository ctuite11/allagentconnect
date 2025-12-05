import { Linkedin, Twitter, Facebook, Instagram, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SocialLinks {
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
  website: string;
}

interface SocialLinksSectionProps {
  socialLinks: SocialLinks;
  onChange: (links: SocialLinks) => void;
}

const SocialLinksSection = ({ socialLinks, onChange }: SocialLinksSectionProps) => {
  const socialInputs = [
    {
      key: "linkedin" as const,
      label: "LinkedIn",
      icon: Linkedin,
      placeholder: "https://linkedin.com/in/yourprofile",
      iconColor: "text-[hsl(201,100%,35%)]",
    },
    {
      key: "twitter" as const,
      label: "Twitter / X",
      icon: Twitter,
      placeholder: "https://twitter.com/yourhandle",
      iconColor: "text-foreground",
    },
    {
      key: "facebook" as const,
      label: "Facebook",
      icon: Facebook,
      placeholder: "https://facebook.com/yourpage",
      iconColor: "text-[hsl(220,46%,48%)]",
    },
    {
      key: "instagram" as const,
      label: "Instagram",
      icon: Instagram,
      placeholder: "https://instagram.com/yourprofile",
      iconColor: "text-[hsl(340,75%,54%)]",
    },
    {
      key: "website" as const,
      label: "Website",
      icon: Globe,
      placeholder: "https://yourwebsite.com",
      iconColor: "text-primary",
    },
  ];

  return (
    <div className="space-y-4">
      {socialInputs.map(({ key, label, icon: Icon, placeholder, iconColor }) => (
        <div key={key}>
          <Label htmlFor={key} className="text-sm font-medium mb-1.5 block">
            {label}
          </Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <Input
              id={key}
              type="url"
              placeholder={placeholder}
              value={socialLinks[key]}
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
