import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const VendorPackages = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<any[]>([]);
  const [vendorProfile, setVendorProfile] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Fetch vendor profile
      const { data: profile } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setVendorProfile(profile);

      // Fetch packages
      const { data: pkgs, error } = await supabase
        .from('ad_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPackages(pkgs || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPackage = async (pkg: any) => {
    if (!vendorProfile) {
      toast.error('Please create a vendor profile first');
      navigate('/vendor/setup');
      return;
    }

    if (!vendorProfile.is_approved) {
      toast.error('Your vendor profile is pending approval');
      return;
    }

    // Here you would integrate with Stripe checkout
    toast.info('Stripe integration coming soon! Package: ' + pkg.name);
    // For now, create a pending subscription
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + pkg.duration_days);

      const { error } = await supabase
        .from('vendor_subscriptions')
        .insert([{
          vendor_id: vendorProfile.id,
          package_id: pkg.id,
          status: 'pending',
          end_date: endDate.toISOString(),
        }]);

      if (error) throw error;
      
      toast.success('Subscription created! (Demo mode - would redirect to Stripe)');
      navigate('/vendor/dashboard');
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error('Failed to create subscription');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Advertising Packages</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Choose the perfect package to promote your business to thousands of real estate professionals and home buyers
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {packages.map((pkg) => {
          const features = Array.isArray(pkg.features) ? pkg.features : [];
          const isPopular = pkg.ad_type === 'featured';

          return (
            <Card key={pkg.id} className={isPopular ? 'border-primary shadow-lg' : ''}>
              <CardHeader>
                {isPopular && (
                  <Badge className="w-fit mb-2">Most Popular</Badge>
                )}
                <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${pkg.price}</span>
                  <span className="text-muted-foreground">/{pkg.duration_days} days</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full" 
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handleSelectPackage(pkg)}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!vendorProfile && (
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">Don't have a vendor profile yet?</p>
          <Button onClick={() => navigate('/vendor/setup')}>
            Create Vendor Profile
          </Button>
        </div>
      )}
    </div>
  );
};

export default VendorPackages;