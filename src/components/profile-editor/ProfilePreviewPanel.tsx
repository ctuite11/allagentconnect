import { User, Phone, Mail, Building2, Globe, CheckCircle, Shield, Star, Gift, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface SocialLinks {
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
  website: string;
}

interface Testimonial {
  id: string;
  client_name: string;
  client_title: string;
  testimonial_text: string;
  rating: number;
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
  buyerIncentives?: string;
  sellerIncentives?: string;
  testimonials?: Testimonial[];
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
  buyerIncentives = "",
  sellerIncentives = "",
  testimonials = [],
}: ProfilePreviewPanelProps) => {
  const fullName = `${firstName} ${lastName}`.trim() || "Your Name";
  const displayTitle = title || "Real Estate Agent";
  const displayCompany = teamName || "Your Company";

  // Truncate bio for preview
  const truncatedBio = bio.length > 200 ? bio.substring(0, 200) + "..." : bio;

  // Get first 2 testimonials for preview
  const previewTestimonials = testimonials.slice(0, 2);

  return (
    <Card className="sticky top-24 border-2 shadow-lg overflow-hidden max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 border-b">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Live Preview
        </h3>
      </div>
      <CardContent className="p-5 space-y-5">
        {/* Header Section */}
        <div className="flex items-start gap-4">
          {/* Photo */}
          <div className="relative flex-shrink-0">
            {headshotUrl ? (
              <img
                src={headshotUrl}
                alt={fullName}
                className="w-16 h-16 rounded-full object-cover border-4 border-background shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-4 border-background shadow-md">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-base truncate">{fullName}</h4>
            <p className="text-sm text-muted-foreground truncate">{displayTitle}</p>
            <p className="text-sm text-primary font-medium truncate">{displayCompany}</p>
            {aacId && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{aacId}</p>
            )}
          </div>

          {/* Logo */}
          {logoUrl && (
            <div className="flex-shrink-0">
              <img
                src={logoUrl}
                alt="Company Logo"
                className="h-10 w-auto object-contain"
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

        {/* Contact Buttons (visual only) */}
        <div className="flex gap-2">
          {cellPhone && (
            <Button size="sm" variant="outline" className="flex-1 text-xs" disabled>
              <Phone className="h-3 w-3 mr-1" />
              Call
            </Button>
          )}
          {email && (
            <Button size="sm" variant="outline" className="flex-1 text-xs" disabled>
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Button>
          )}
          {socialLinks.website && (
            <Button size="sm" variant="outline" className="flex-1 text-xs" disabled>
              <Globe className="h-3 w-3 mr-1" />
              Website
            </Button>
          )}
        </div>

        {/* Contact Info Details */}
        <div className="space-y-1.5 text-xs">
        {cellPhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{formatPhoneNumber(cellPhone)}</span>
            </div>
          )}
          {officePhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>{formatPhoneNumber(officePhone)}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {socialLinks.website && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-3 w-3" />
              <span className="truncate text-primary">{socialLinks.website}</span>
            </div>
          )}
        </div>

        {/* Bio Preview */}
        {bio && (
          <>
            <Separator />
            <div>
              <h5 className="font-semibold text-xs mb-1.5 text-muted-foreground uppercase">About</h5>
              <p className="text-xs text-foreground leading-relaxed">{truncatedBio}</p>
            </div>
          </>
        )}

        {/* Incentives */}
        {(buyerIncentives || sellerIncentives) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h5 className="font-semibold text-xs text-muted-foreground uppercase">Incentives</h5>
              <div className="grid grid-cols-1 gap-2">
                {buyerIncentives && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Gift className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-xs">Buyer</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{buyerIncentives}</p>
                  </div>
                )}
                {sellerIncentives && (
                  <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-accent" />
                      <span className="font-medium text-xs">Seller</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{sellerIncentives}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Testimonials Preview */}
        {previewTestimonials.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h5 className="font-semibold text-xs text-muted-foreground uppercase">Testimonials</h5>
              <div className="space-y-2">
                {previewTestimonials.map((testimonial) => (
                  <div 
                    key={testimonial.id} 
                    className="bg-muted/50 rounded-lg p-3 border"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3 w-3 ${
                            star <= testimonial.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-foreground line-clamp-2 italic">
                      "{testimonial.testimonial_text}"
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                      — {testimonial.client_name}
                      {testimonial.client_title && `, ${testimonial.client_title}`}
                    </p>
                  </div>
                ))}
              </div>
              {testimonials.length > 2 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{testimonials.length - 2} more testimonial{testimonials.length - 2 > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfilePreviewPanel;
