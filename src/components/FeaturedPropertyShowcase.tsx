import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Bed, Bath, Maximize, DollarSign, TrendingDown } from "lucide-react";

const FeaturedPropertyShowcase = () => {
  const navigate = useNavigate();
  const [featuredProperty, setFeaturedProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProperty();
  }, []);

  const fetchFeaturedProperty = async () => {
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFeaturedProperty(data);
      }
    } catch (error) {
      console.error("Error fetching featured property:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePotentialSavings = (price: number) => {
    // Calculate potential savings based on typical commission structure
    // Example: 2.5% buyer agent commission savings
    return Math.round(price * 0.025);
  };

  if (loading || !featuredProperty) return null;

  const savings = calculatePotentialSavings(featuredProperty.price);

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Featured Property with Potential Savings
            </h2>
            <p className="text-lg text-muted-foreground">
              Work directly with listing agents and save on buyer agent commissions
            </p>
          </div>

          <Card className="overflow-hidden hover:shadow-xl transition-shadow">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Property Image Placeholder */}
                <div className="bg-secondary/30 aspect-video md:aspect-auto flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                      <DollarSign className="w-16 h-16 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">Property Image</p>
                  </div>
                </div>

                {/* Property Details */}
                <div className="p-6 flex flex-col justify-center">
                  <div className="mb-4">
                    <Badge variant="secondary" className="mb-2">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Featured Listing
                    </Badge>
                    <h3 className="text-2xl font-bold mb-2">
                      {featuredProperty.address}
                    </h3>
                    <p className="text-muted-foreground">
                      {featuredProperty.city}, {featuredProperty.state} {featuredProperty.zip_code}
                    </p>
                  </div>

                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                    <p className="text-sm text-green-800 dark:text-green-200 mb-1">
                      This listing has potential savings of:
                    </p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      ${savings.toLocaleString()}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      By working directly with the listing agent
                    </p>
                  </div>

                  <div className="flex items-center justify-between mb-6 pb-6 border-b">
                    <div className="text-3xl font-bold text-primary">
                      ${featuredProperty.price.toLocaleString()}
                    </div>
                    <Badge>{featuredProperty.status}</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {featuredProperty.bedrooms && (
                      <div className="flex items-center gap-2">
                        <Bed className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{featuredProperty.bedrooms} Beds</span>
                      </div>
                    )}
                    {featuredProperty.bathrooms && (
                      <div className="flex items-center gap-2">
                        <Bath className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{featuredProperty.bathrooms} Baths</span>
                      </div>
                    )}
                    {featuredProperty.square_feet && (
                      <div className="flex items-center gap-2">
                        <Maximize className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{featuredProperty.square_feet.toLocaleString()} Sq Ft</span>
                      </div>
                    )}
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => navigate(`/property/${featuredProperty.id}`)}
                  >
                    View Property Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default FeaturedPropertyShowcase;
