import { User, Phone, Mail, Building2, Globe, CheckCircle, Shield, Star, Gift, TrendingUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

interface MobilePreviewModalProps {
  open: boolean;
  onClose: () => void;
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

const MobilePreviewModal = ({
  open,
  onClose,
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
}: MobilePreviewModalProps) => {
  const fullName = `${firstName} ${lastName}`.trim() || "Your Name";
  const displayTitle = title || "Real Estate Agent";
  const displayCompany = teamName || "Your Company";

  const truncatedBio = bio.length > 300 ? bio.substring(0, 300) + "..." : bio;
  const previewTestimonials = testimonials.slice(0, 2);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center justify-between">
            <span>Profile Preview</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-8">
          {/* Header Section */}
          <div className="flex items-start gap-4">
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

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-lg truncate">{fullName}</h4>
              <p className="text-sm text-muted-foreground truncate">{displayTitle}</p>
              <p className="text-sm text-primary font-medium truncate">{displayCompany}</p>
              {aacId && (
                <p className="text-xs text-muted-foreground font-mono mt-1">{aacId}</p>
              )}
            </div>

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

          {/* Contact Buttons */}
          <div className="flex gap-2">
            {cellPhone && (
              <Button size="sm" variant="outline" className="flex-1" disabled>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
            )}
            {email && (
              <Button size="sm" variant="outline" className="flex-1" disabled>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            )}
            {socialLinks.website && (
              <Button size="sm" variant="outline" className="flex-1" disabled>
                <Globe className="h-4 w-4 mr-2" />
                Website
              </Button>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-2 text-sm">
            {cellPhone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{formatPhoneNumber(cellPhone)}</span>
              </div>
            )}
            {officePhone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{formatPhoneNumber(officePhone)}</span>
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

          {/* Bio */}
          {bio && (
            <>
              <Separator />
              <div>
                <h5 className="font-semibold text-sm mb-2">About</h5>
                <p className="text-sm text-muted-foreground leading-relaxed">{truncatedBio}</p>
              </div>
            </>
          )}

          {/* Incentives - hidden per AAC policy */}
          {false && (buyerIncentives || sellerIncentives) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h5 className="font-semibold text-sm">Incentives</h5>
                <div className="grid grid-cols-1 gap-3">
                  {buyerIncentives && (
                    <div className="bg-muted border border-border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Buyer Incentive</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{buyerIncentives}</p>
                    </div>
                  )}
                  {sellerIncentives && (
                    <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-accent" />
                        <span className="font-medium text-sm">Seller Incentive</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{sellerIncentives}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Testimonials */}
          {previewTestimonials.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h5 className="font-semibold text-sm">Testimonials</h5>
                <div className="space-y-3">
                  {previewTestimonials.map((testimonial) => (
                    <div 
                      key={testimonial.id} 
                      className="bg-muted/50 rounded-lg p-4 border"
                    >
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= testimonial.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-foreground italic mb-2">
                        "{testimonial.testimonial_text}"
                      </p>
                      <p className="text-sm text-muted-foreground font-medium">
                        — {testimonial.client_name}
                        {testimonial.client_title && `, ${testimonial.client_title}`}
                      </p>
                    </div>
                  ))}
                </div>
                {testimonials.length > 2 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{testimonials.length - 2} more testimonial{testimonials.length - 2 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobilePreviewModal;
