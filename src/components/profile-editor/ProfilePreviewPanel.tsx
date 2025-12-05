import { User, Phone, Mail, Building2, Globe, CheckCircle, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SocialLinks {
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
  website: string;
}

interface ProfilePreviewPanelProps {
  firstName: string;
  lastName: string;
  title: string;
  teamName: string;
  email: string;
  cellPhone: string;
  officePhone: string;
  headshotUrl: string;
  logoUrl: string;
  bio: string;
  aacId: string | null;
  socialLinks: SocialLinks;
}

const ProfilePreviewPanel = ({
  firstName,
  lastName,
  title,
  teamName,
  email,
  cellPhone,
  officePhone,
  headshotUrl,
  logoUrl,
  bio,
  aacId,
  socialLinks,
}: ProfilePreviewPanelProps) => {
  const fullName = `${firstName} ${lastName}`.trim() || "Your Name";
  const displayTitle = title || "Real Estate Agent";
  const displayCompany = teamName || "Your Company";

  return (
    <Card className="sticky top-24 border-2 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 border-b">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Live Preview
        </h3>
      </div>
      <CardContent className="p-6 space-y-6">
        {/* Header Section */}
        <div className="flex items-start gap-4">
          {/* Photo */}
          <div className="relative flex-shrink-0">
            {headshotUrl ? (
              <img
                src={headshotUrl}
                alt={fullName}
                className="w-20 h-20 rounded-full object-cover border-4 border-background shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-4 border-background shadow-md">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-lg truncate">{fullName}</h4>
            <p className="text-sm text-muted-foreground truncate">{displayTitle}</p>
            <p className="text-sm text-primary font-medium truncate">{displayCompany}</p>
            {aacId && (
              <p className="text-xs text-muted-foreground font-mono mt-1">{aacId}</p>
            )}
          </div>

          {/* Logo */}
          {logoUrl && (
            <div className="flex-shrink-0">
              <img
                src={logoUrl}
                alt="Company Logo"
                className="h-12 w-auto object-contain"
              />
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            <CheckCircle className="h-3 w-3 text-accent" />
            DirectConnect Friendly
          </Badge>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Shield className="h-3 w-3 text-primary" />
            Verified Agent
          </Badge>
        </div>

        {/* Contact Info */}
        <div className="space-y-2 text-sm">
          {cellPhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{cellPhone}</span>
            </div>
          )}
          {officePhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{officePhone}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {socialLinks.website && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span className="truncate text-primary">{socialLinks.website}</span>
            </div>
          )}
        </div>

        {/* Bio Preview */}
        {bio && (
          <div className="pt-4 border-t">
            <h5 className="font-semibold text-sm mb-2">Bio</h5>
            <p className="text-sm text-muted-foreground line-clamp-4">{bio}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfilePreviewPanel;
