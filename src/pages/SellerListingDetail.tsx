import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Bed, Bath, Ruler, DollarSign, MapPin, Phone, Mail, MessageSquare, Lock, Calendar, User, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SellerSubmission {
  id: string;
  seller_name: string | null;
  seller_email: string;
  seller_phone: string | null;
  preferred_contact_method: string;
  address: string;
  unit_number: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  neighborhood: string | null;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  asking_price: number;
  lot_size: number | null;
  year_built: number | null;
  description: string | null;
  photos: string[];
  video_url: string | null;
  buyer_agent_commission: string | null;
  expires_at: string;
  created_at: string;
}

const SellerListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<SellerSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifiedAgent, setIsVerifiedAgent] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      // Check auth
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        // Check if verified agent
        const { data: settings } = await supabase
          .from("agent_settings")
          .select("agent_status")
          .eq("user_id", session.user.id)
          .maybeSingle();

        setIsVerifiedAgent(settings?.agent_status === "verified");
      }

      // Fetch submission
      if (id) {
        const { data, error } = await supabase
          .from("agent_match_submissions")
          .select("*")
          .eq("id", id)
          .eq("status", "paid")
          .maybeSingle();

        if (error) {
          console.error("Error fetching submission:", error);
        } else if (data) {
          setSubmission(data as SellerSubmission);
          // Check if current user is the owner
          if (session?.user && data.user_id === session.user.id) {
            setIsOwner(true);
          }
        }
      }

      setLoading(false);
    };

    checkAuthAndFetch();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: settings } = await supabase
          .from("agent_settings")
          .select("agent_status")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setIsVerifiedAgent(settings?.agent_status === "verified");
      } else {
        setIsVerifiedAgent(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getContactMethodIcon = (method: string) => {
    switch (method) {
      case "text":
        return <MessageSquare className="h-5 w-5" />;
      case "phone":
        return <Phone className="h-5 w-5" />;
      default:
        return <Mail className="h-5 w-5" />;
    }
  };

  const getContactMethodLabel = (method: string) => {
    switch (method) {
      case "text":
        return "Text message";
      case "phone":
        return "Phone call";
      default:
        return "Email";
    }
  };

  const isExpired = submission ? new Date(submission.expires_at) < new Date() : false;

  const handleRenew = async () => {
    if (!submission || !id) return;
    
    setIsRenewing(true);
    try {
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 30);

      const { error } = await supabase
        .from("agent_match_submissions")
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq("id", id);

      if (error) throw error;

      setSubmission({ ...submission, expires_at: newExpiresAt.toISOString() });
      toast.success("Renewed — your listing is active for 30 more days");
    } catch (error) {
      console.error("Error renewing:", error);
      toast.error("Failed to renew listing. Please try again.");
    } finally {
      setIsRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-zinc-100">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <button onClick={() => navigate("/")} className="flex items-center gap-3 -ml-1">
                <Logo size="lg" />
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full rounded-xl mb-6" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </main>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-zinc-100">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <button onClick={() => navigate("/")} className="flex items-center gap-3 -ml-1">
                <Logo size="lg" />
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-12 text-center">
          <Home className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">Listing Not Found</h1>
          <p className="text-zinc-500 mb-6">This seller listing may have expired or doesn't exist.</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Return Home
          </Button>
        </main>
      </div>
    );
  }

  const fullAddress = [
    submission.address,
    submission.unit_number ? `Unit ${submission.unit_number}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const locationLine = [submission.neighborhood, submission.city, submission.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-zinc-100">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-3 -ml-1">
              <Logo size="lg" />
            </button>
            <span className="text-sm font-medium text-zinc-500">Seller Listing</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Photo Gallery */}
        {submission.photos && submission.photos.length > 0 && (
          <div className="mb-8">
            <div className="aspect-[16/9] rounded-xl overflow-hidden bg-zinc-100 mb-3">
              <img
                src={submission.photos[selectedPhoto]}
                alt={`Property photo ${selectedPhoto + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            {submission.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {submission.photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPhoto(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      index === selectedPhoto ? "border-[#0E56F5]" : "border-transparent"
                    }`}
                  >
                    <img src={photo} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Property Info */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2">{fullAddress}</h1>
          <p className="text-lg text-zinc-600 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-zinc-400" />
            {locationLine}
            {submission.zip_code && ` ${submission.zip_code}`}
          </p>
        </div>

        {/* Price & Commission */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="p-6 bg-zinc-50 rounded-xl">
            <p className="text-sm text-zinc-500 mb-1">Asking Price</p>
            <p className="text-3xl font-bold text-zinc-900">{formatPrice(submission.asking_price)}</p>
          </div>
          <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm text-[#0E56F5] mb-1">Buyer Agent Commission</p>
            <p className="text-2xl font-bold text-[#0E56F5]">{submission.buyer_agent_commission || "Contact seller"}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-zinc-50 rounded-xl text-center">
            <Bed className="h-5 w-5 text-zinc-400 mx-auto mb-2" />
            <p className="text-lg font-semibold text-zinc-900">{submission.bedrooms}</p>
            <p className="text-xs text-zinc-500">Bedrooms</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-xl text-center">
            <Bath className="h-5 w-5 text-zinc-400 mx-auto mb-2" />
            <p className="text-lg font-semibold text-zinc-900">{submission.bathrooms}</p>
            <p className="text-xs text-zinc-500">Bathrooms</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-xl text-center">
            <Ruler className="h-5 w-5 text-zinc-400 mx-auto mb-2" />
            <p className="text-lg font-semibold text-zinc-900">{submission.square_feet?.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Sq Ft</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-xl text-center">
            <Home className="h-5 w-5 text-zinc-400 mx-auto mb-2" />
            <p className="text-lg font-semibold text-zinc-900">{submission.property_type}</p>
            <p className="text-xs text-zinc-500">Type</p>
          </div>
        </div>

        {/* Additional Details */}
        {(submission.lot_size || submission.year_built) && (
          <div className="flex gap-4 mb-8 text-sm text-zinc-600">
            {submission.lot_size && (
              <span>Lot: {submission.lot_size} acres</span>
            )}
            {submission.year_built && (
              <span>Built: {submission.year_built}</span>
            )}
          </div>
        )}

        {/* Description */}
        {submission.description && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Description</h2>
            <p className="text-zinc-600 whitespace-pre-wrap">{submission.description}</p>
          </div>
        )}

        {/* Seller Contact - Verified Agents Only */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Seller Contact Information</h2>
          
          {isVerifiedAgent ? (
            <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-4">
                {getContactMethodIcon(submission.preferred_contact_method)}
                <div>
                  <p className="text-sm text-emerald-700">Preferred Contact Method</p>
                  <p className="font-semibold text-emerald-900">{getContactMethodLabel(submission.preferred_contact_method)}</p>
                </div>
              </div>
              
              {submission.seller_name && (
                <div className="flex items-center gap-3 mb-3">
                  <User className="h-5 w-5 text-emerald-600" />
                  <span className="text-emerald-900 font-medium">{submission.seller_name}</span>
                </div>
              )}
              
              <div className="flex items-center gap-3 mb-3">
                <Mail className="h-5 w-5 text-emerald-600" />
                <a href={`mailto:${submission.seller_email}`} className="text-emerald-900 hover:underline">
                  {submission.seller_email}
                </a>
              </div>
              
              {submission.seller_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-emerald-600" />
                  <a href={`tel:${submission.seller_phone}`} className="text-emerald-900 hover:underline">
                    {submission.seller_phone}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 bg-zinc-100 rounded-xl border border-zinc-200">
              <div className="flex items-center gap-3 text-zinc-500">
                <Lock className="h-5 w-5" />
                <div>
                  <p className="font-medium text-zinc-700">AAC Verified Agents Only</p>
                  <p className="text-sm">
                    {user ? "You must be an AAC Verified agent to view seller contact information." : "Sign in as an AAC Verified agent to view seller contact information."}
                  </p>
                </div>
              </div>
              {!user && (
                <Button
                  onClick={() => navigate("/auth")}
                  className="mt-4 bg-[#0E56F5] hover:bg-[#0D4AD9]"
                >
                  Sign In
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Renewal Card for Expired Listings (Owner Only) */}
        {isOwner && isExpired && (
          <div className="mb-8 p-6 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-start gap-4">
              <RefreshCw className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">Renew Seller Match</h3>
                <p className="text-zinc-600 mb-4">
                  Renewing keeps your listing active for another 30 days and continues matching against new buyer needs.
                </p>
                <Button
                  onClick={handleRenew}
                  disabled={isRenewing}
                  className="bg-[#0F172A] hover:bg-zinc-800"
                >
                  {isRenewing ? "Renewing..." : "Renew for 30 days"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Listing Info */}
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Listed {new Date(submission.created_at).toLocaleDateString()}
          </span>
          
          {/* Status Badge */}
          {isExpired ? (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              Expired
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active until {new Date(submission.expires_at).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </main>
    </div>
  );
};

export default SellerListingDetail;
