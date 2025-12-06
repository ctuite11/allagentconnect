import { User, Phone, Mail, Building2, Globe, Users, ShieldCheck, Star, Gift, TrendingUp, Quote } from "lucide-react";
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
    <Card className="sticky top-24 border-0 shadow-lg overflow-hidden max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 py-3 border-b">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Live Preview
        </h3>
      </div>
      <CardContent className="p-6 space-y-6">
        {/* Header Section - matches public profile hero */}
        <div className="flex items-start gap-4">
          {/* Photo */}
          <div className="relative flex-shrink-0">
            {headshotUrl ? (
              <img
                src={headshotUrl}
                alt={fullName}
                className="w-20 h-20 rounded-full object-cover border-4 border-primary/20 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20 shadow-lg">
                <span className="text-xl font-bold text-primary">
                  {firstName?.[0] || "Y"}{lastName?.[0] || "N"}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-lg text-foreground truncate">{fullName}</h4>
            <p className="text-sm text-muted-foreground">
              {displayTitle}{displayTitle && displayCompany && ' • '}{displayCompany}
            </p>
            {aacId && (
              <p className="text-xs text-muted-foreground mt-1">
                Agent ID: {aacId}
              </p>
            )}
          </div>
        </div>

        {/* Logo */}
        {logoUrl && (
          <div className="flex justify-center">
            <img
              src={logoUrl}
              alt="Company Logo"
              className="h-12 object-contain"
            />
          </div>
        )}

        {/* Badges - matches public profile style */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-2 px-3 py-1 rounded-full border-primary/30 bg-primary/5 text-primary text-xs">
            <Users className="h-3 w-3" />
            DirectConnect Friendly
          </Badge>
          <Badge variant="outline" className="gap-2 px-3 py-1 rounded-full border-accent/30 bg-accent/5 text-accent text-xs">
            <ShieldCheck className="h-3 w-3" />
            Verified Agent
          </Badge>
        </div>

        {/* Contact Buttons - matches public profile button style */}
        <div className="flex gap-2">
          {cellPhone && (
            <Button variant="outline" className="flex-1 h-9 text-sm gap-2" disabled>
              <Phone className="h-4 w-4" />
              Call
            </Button>
          )}
          {email && (
            <Button variant="outline" className="flex-1 h-9 text-sm gap-2" disabled>
              <Mail className="h-4 w-4" />
              Email
            </Button>
          )}
          {socialLinks.website && (
            <Button variant="outline" className="flex-1 h-9 text-sm gap-2" disabled>
              <Globe className="h-4 w-4" />
              Website
            </Button>
          )}
        </div>

        {/* Contact Info Details - matches public profile spacing */}
        <div className="space-y-2">
          {officePhone && (
            <div className="flex items-center gap-3 text-foreground text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>Office: {formatPhoneNumber(officePhone)}</span>
            </div>
          )}
          {cellPhone && (
            <div className="flex items-center gap-3 text-foreground text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>Cell: {formatPhoneNumber(cellPhone)}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-3 text-foreground text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{email}</span>
            </div>
          )}
        </div>

        {/* Bio Preview - matches public profile section */}
        {bio && (
          <>
            <Separator />
            <div>
              <h5 className="text-lg font-bold text-foreground mb-3">Bio</h5>
              <p className="text-sm text-foreground leading-relaxed">{truncatedBio}</p>
            </div>
          </>
        )}

        {/* Incentives - matches public profile card styling */}
        {(buyerIncentives || sellerIncentives) && (
          <>
            <Separator />
            <div className="space-y-4">
              <h5 className="text-lg font-bold text-foreground">Incentives</h5>
              <div className="space-y-3">
                {buyerIncentives && (
                  <Card className="shadow-md border-0 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-accent/10 flex-shrink-0">
                          <Gift className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h6 className="font-bold text-sm text-foreground mb-1">Buyer Incentives</h6>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{buyerIncentives}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {sellerIncentives && (
                  <Card className="shadow-md border-0 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 flex-shrink-0">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h6 className="font-bold text-sm text-foreground mb-1">Seller Incentives</h6>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{sellerIncentives}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}

        {/* Testimonials Preview - matches public profile styling */}
        {previewTestimonials.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <h5 className="text-lg font-bold text-foreground">Client Testimonials</h5>
              <div className="space-y-3">
                {previewTestimonials.map((testimonial) => (
                  <Card key={testimonial.id} className="shadow-md border-0">
                    <CardContent className="p-4">
                      {testimonial.rating && (
                        <div className="flex gap-1 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < testimonial.rating
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mb-2">
                        <Quote className="h-5 w-5 text-primary/20 flex-shrink-0 transform rotate-180" />
                        <p className="text-sm text-foreground italic leading-relaxed line-clamp-3">
                          {testimonial.testimonial_text}
                        </p>
                      </div>
                      <div className="ml-7">
                        <p className="text-sm font-bold text-foreground">{testimonial.client_name}</p>
                        {testimonial.client_title && (
                          <p className="text-xs text-muted-foreground">{testimonial.client_title}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
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
