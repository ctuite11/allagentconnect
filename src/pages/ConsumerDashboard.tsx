import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Heart, Bell, User, MapPin, Home, Search, Calendar } from "lucide-react";
import { toast } from "sonner";

const ConsumerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [hotSheets, setHotSheets] = useState<any[]>([]);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/buyer-auth');
        return;
      }

      setUser(user);

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      setProfile(profileData);

      // Fetch favorites with listing details
      const { data: favData } = await supabase
        .from('favorites')
        .select(`
          *,
          listing:listings(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setFavorites(favData || []);

      // Fetch hot sheets
      const { data: hotSheetData } = await supabase
        .from('hot_sheets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setHotSheets(hotSheetData || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-24">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback>
                <User className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">
                Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}!
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Saved Homes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{favorites.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Saved Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{hotSheets.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Search className="w-4 h-4" />
                Recent Views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="favorites" className="space-y-4">
          <TabsList>
            <TabsTrigger value="favorites">Saved Homes</TabsTrigger>
            <TabsTrigger value="searches">Saved Searches</TabsTrigger>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="favorites" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Your Saved Homes</h2>
              <Button onClick={() => navigate('/browse')}>
                <Search className="w-4 h-4 mr-2" />
                Find More Homes
              </Button>
            </div>

            {favorites.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No saved homes yet</p>
                  <Button onClick={() => navigate('/browse')}>
                    Start Browsing
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.map((fav) => (
                  <Card key={fav.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/consumer-property/${fav.listing.id}`)}>
                    {fav.listing.photos?.[0] && (
                      <img 
                        src={fav.listing.photos[0].url} 
                        alt={fav.listing.address}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <CardHeader>
                      <CardTitle className="text-xl">{formatCurrency(fav.listing.price)}</CardTitle>
                      <CardDescription className="flex items-start gap-1">
                        <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{fav.listing.address}, {fav.listing.city}, {fav.listing.state}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {fav.listing.bedrooms && <span>{fav.listing.bedrooms} beds</span>}
                        {fav.listing.bathrooms && <span>{fav.listing.bathrooms} baths</span>}
                        {fav.listing.square_feet && <span>{fav.listing.square_feet.toLocaleString()} sqft</span>}
                      </div>
                      <Badge className="mt-2" variant="secondary">
                        {fav.listing.listing_type === 'for_rent' ? 'For Rent' : 'For Sale'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="searches" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Your Saved Searches</h2>
              <Button onClick={() => navigate('/hot-sheets')}>
                <Bell className="w-4 h-4 mr-2" />
                Create Search Alert
              </Button>
            </div>

            {hotSheets.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No saved searches yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Save your search criteria and get notified when new homes match
                  </p>
                  <Button onClick={() => navigate('/hot-sheets')}>
                    Create Search Alert
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {hotSheets.map((sheet) => (
                  <Card key={sheet.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{sheet.name}</CardTitle>
                          <CardDescription>
                            Created {new Date(sheet.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge variant={sheet.is_active ? "default" : "secondary"}>
                          {sheet.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/hot-sheets/${sheet.id}/review`)}
                        >
                          View Matches
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate('/hot-sheets')}
                        >
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Manage your profile and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg">{user.email}</p>
                </div>
                {profile?.first_name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-lg">{profile.first_name} {profile.last_name}</p>
                  </div>
                )}
                {profile?.phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-lg">{profile.phone}</p>
                  </div>
                )}
                <div className="pt-4">
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate('/');
                    }}
                  >
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
};

export default ConsumerDashboard;