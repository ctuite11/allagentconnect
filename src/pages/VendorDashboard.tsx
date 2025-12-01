import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Store, TrendingUp, Eye, MousePointer, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Navigation from "@/components/Navigation";

const VendorDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchVendorData();
  }, []);

  const fetchVendorData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Fetch vendor profile
      const { data: profile, error: profileError } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setVendorProfile(profile);

      if (profile) {
        // Fetch subscriptions
        const { data: subs, error: subsError } = await supabase
          .from('vendor_subscriptions')
          .select(`
            *,
            package:ad_packages(*)
          `)
          .eq('vendor_id', profile.id)
          .order('created_at', { ascending: false });

        if (subsError) throw subsError;
        setSubscriptions(subs || []);

        // Fetch advertisements
        const { data: advertisements, error: adsError } = await supabase
          .from('advertisements')
          .select('*')
          .eq('vendor_id', profile.id)
          .order('created_at', { ascending: false });

        if (adsError) throw adsError;
        setAds(advertisements || []);

        // Fetch analytics
        if (advertisements && advertisements.length > 0) {
          const adIds = advertisements.map(ad => ad.id);
          
          const { count: impressionsCount } = await supabase
            .from('ad_impressions')
            .select('*', { count: 'exact', head: true })
            .in('ad_id', adIds);

          const { count: clicksCount } = await supabase
            .from('ad_clicks')
            .select('*', { count: 'exact', head: true })
            .in('ad_id', adIds);

          const impressions = impressionsCount || 0;
          const clicks = clicksCount || 0;

          setAnalytics({
            totalImpressions: impressions,
            totalClicks: clicks,
            ctr: clicks && impressions ? ((clicks / impressions) * 100).toFixed(2) : 0
          });
        }
      }
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      toast.error('Failed to load vendor dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center pt-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!vendorProfile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
          <Alert>
            <Store className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>You need to create a vendor profile to start advertising.</span>
                <Button onClick={() => navigate('/vendor/setup')}>
                  Create Profile
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!vendorProfile.is_approved) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your vendor profile is pending approval. You'll be notified once it's approved and you can start advertising.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const activeSubscription = subscriptions.find(sub => sub.status === 'active');

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Vendor Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your advertising campaigns and track performance
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{ads.filter(ad => ad.is_active).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Total Impressions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics?.totalImpressions || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointer className="w-4 h-4" />
              Total Clicks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics?.totalClicks || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Click-Through Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics?.ctr || 0}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">My Campaigns</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Your Campaigns</h2>
            <Button onClick={() => navigate('/vendor/create-ad')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>

          {!activeSubscription && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>You need an active subscription to create campaigns.</span>
                  <Button onClick={() => navigate('/vendor/packages')}>
                    View Packages
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {ads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No campaigns yet. Create your first campaign to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {ads.map((ad) => (
                <Card key={ad.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{ad.title}</CardTitle>
                        <CardDescription>{ad.description}</CardDescription>
                      </div>
                      <Badge variant={ad.is_active ? "default" : "secondary"}>
                        {ad.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Ad Type</p>
                        <p className="font-medium capitalize">{ad.ad_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Placement</p>
                        <p className="font-medium">{ad.placement_zone || 'All zones'}</p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/vendor/edit-ad/${ad.id}`)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/vendor/analytics/${ad.id}`)}>
                          View Analytics
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Your Subscriptions</h2>
            <Button onClick={() => navigate('/vendor/packages')}>
              View All Packages
            </Button>
          </div>

          {subscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No active subscriptions. Choose a package to get started.</p>
                <Button onClick={() => navigate('/vendor/packages')}>
                  Browse Packages
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {subscriptions.map((sub) => (
                <Card key={sub.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{sub.package.name}</CardTitle>
                        <CardDescription>{sub.package.description}</CardDescription>
                      </div>
                      <Badge variant={sub.status === 'active' ? "default" : "secondary"}>
                        {sub.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="font-medium">${sub.package.price}/month</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Start Date</p>
                        <p className="font-medium">{new Date(sub.start_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">End Date</p>
                        <p className="font-medium">{new Date(sub.end_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Performance Analytics</h2>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Detailed analytics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Vendor Profile</h2>
            <Button onClick={() => navigate('/vendor/edit-profile')}>
              Edit Profile
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{vendorProfile.company_name}</CardTitle>
              <CardDescription className="capitalize">{vendorProfile.business_type}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Contact Name</p>
                <p className="font-medium">{vendorProfile.contact_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{vendorProfile.email}</p>
              </div>
              {vendorProfile.phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{vendorProfile.phone}</p>
                </div>
              )}
              {vendorProfile.website && (
                <div>
                  <p className="text-sm text-muted-foreground">Website</p>
                  <a href={vendorProfile.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                    {vendorProfile.website}
                  </a>
                </div>
              )}
              {vendorProfile.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{vendorProfile.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};

export default VendorDashboard;