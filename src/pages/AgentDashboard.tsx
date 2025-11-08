import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import ListingCard from "@/components/ListingCard";
import forSaleImg from "@/assets/listing-for-sale.jpg";
import privateSaleImg from "@/assets/listing-private-sale.jpg";
import forRentImg from "@/assets/listing-for-rent.jpg";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LayoutGrid, List } from "lucide-react";

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  status: string;
  photos: any;
  open_houses: any;
  listing_type: string | null;
  created_at: string;
}

const AgentDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tempStatusFilters, setTempStatusFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    document.title = "Agent Dashboard - Agent Connect";
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setListings(data);
    } catch (error: any) {
      toast.error("Error loading listings: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (listingId: string) => {
    setListingToDelete(listingId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!listingToDelete) return;

    try {
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listingToDelete);

      if (error) throw error;

      setListings(listings.filter((l) => l.id !== listingToDelete));
      toast.success("Listing deleted successfully");
    } catch (error: any) {
      toast.error("Error deleting listing: " + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setListingToDelete(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const listingTypes = [
    {
      title: "For Sale",
      description: "Add a new listing for sale.",
      image: forSaleImg,
      action: () => navigate("/add-listing?type=sale"),
    },
    {
      title: "For Off Market Sale",
      description: "Add a new off market listing for sale.",
      image: privateSaleImg,
      action: () => navigate("/add-listing?type=private"),
    },
    {
      title: "For Rent",
      description: "Add a new listing for rent.",
      image: forRentImg,
      action: () => navigate("/add-listing?type=rent"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Hello. Bonjour. Hola. 你好. Ciao
            </p>
            <h1 className="text-4xl font-bold">My Listings</h1>
            <p className="text-muted-foreground mt-2">
              A convenient way to add for sale and for rent listings, update listing status, easily edit property details and track all of your listings.
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
        {/* Quick Access to new pages */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Quick Access</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Button onClick={() => navigate("/add-listing")}>
              New Listing
            </Button>
            <Button variant="outline" onClick={() => navigate("/hot-sheets")}>
              Manage Hot Sheets
            </Button>
            <Button variant="outline" onClick={() => navigate("/favorites")}>
              Favorites
            </Button>
            <Button variant="outline" onClick={() => navigate("/manage-coverage-areas")}>
              Coverage Areas
            </Button>
          </div>
        </div>

        {/* Listing Type Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-12">
          {listingTypes.map((type) => (
            <Card key={type.title} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] relative overflow-hidden">
                <img
                  src={type.image}
                  alt={type.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-2">{type.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{type.description}</p>
                <Button onClick={type.action} className="w-full">
                  Create Here
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Existing Listings */}
        {listings.length > 0 ? (
          <div className="space-y-8">
            {/* Draft Listings */}
            {listings.filter(l => (l.status || '').toLowerCase() === "draft" && (!showResults || statusFilters.length === 0 || statusFilters.includes((l.status || '').toLowerCase()))).length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Draft Listings</h2>
                <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                  {listings.filter(l => (l.status || '').toLowerCase() === "draft" && (!showResults || statusFilters.length === 0 || statusFilters.includes((l.status || '').toLowerCase()))).map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onDelete={handleDeleteClick}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Active Listings */}
            {listings.filter(l => (l.status || '').toLowerCase() !== "draft" && (!showResults || statusFilters.length === 0 || statusFilters.includes((l.status || '').toLowerCase()))).length > 0 && (
              <div>
                {/* Status Filter and View Toggle - Moved above Active Listings */}
                <div className="mb-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Filter by Status</h2>
                    <div className="flex gap-2">
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                      >
                        <List className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={tempStatusFilters.length === 8}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempStatusFilters(["active", "pending", "draft", "sold", "rented", "temporarily withdrawn", "cancelled", "expired"]);
                          } else {
                            setTempStatusFilters([]);
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">All</span>
                    </label>
                    {["active", "pending", "draft", "sold", "rented", "temporarily withdrawn", "cancelled", "expired"].map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tempStatusFilters.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempStatusFilters([...tempStatusFilters, status]);
                            } else {
                              setTempStatusFilters(tempStatusFilters.filter(s => s !== status));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      setStatusFilters(tempStatusFilters);
                      setShowResults(true);
                    }}>
                      View Results
                    </Button>
                    {showResults && (
                      <Button variant="outline" onClick={() => {
                        setStatusFilters([]);
                        setTempStatusFilters([]);
                        setShowResults(false);
                      }}>
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>

                {showResults && statusFilters.length > 0 && (
                  <div className="mb-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">
                      Showing {listings.filter(l => statusFilters.includes((l.status || '').toLowerCase())).length} listing(s) with status: {statusFilters.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
                    </p>
                  </div>
                )}
                <h2 className="text-2xl font-bold mb-6">Active Listings</h2>
                <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                  {listings.filter(l => (l.status || '').toLowerCase() !== "draft" && (!showResults || statusFilters.length === 0 || statusFilters.includes((l.status || '').toLowerCase()))).map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onDelete={handleDeleteClick}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">You haven't added any listings yet.</p>
              <Button onClick={() => navigate("/add-listing")}>
                Add Your First Listing
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AgentDashboard;
