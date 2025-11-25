import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingScreen";

type Listing = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  status: string;
  listing_type: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  created_at: string;
  go_live_date: string | null;
  auto_activate_on: string | null;
  auto_activate_days: number | null;
};

const formatAutoActivationInfo = (listing: Listing) => {
  if (listing.status === "coming_soon" && listing.go_live_date) {
    const date = new Date(listing.go_live_date).toLocaleDateString();
    return `Will go Active on ${date}`;
  }
  if (listing.status === "new" && listing.auto_activate_days) {
    return `Will auto-activate in ${listing.auto_activate_days} days`;
  }
  return null;
};

const MyListings: React.FC = () => {
  const { user } = useAuthRole();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadListings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading listings", error);
        setListings([]);
      } else {
        setListings(data ?? []);
      }
      setLoading(false);
    };

    loadListings();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">You must be signed in as an agent to view your listings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading your listings..." />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">My Listings</h1>
          <Button onClick={() => navigate("/agent/listings/new")}>
            + Create New Listing
          </Button>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-card">
            <p className="text-muted-foreground mb-4">
              You don't have any listings yet.
            </p>
            <Button onClick={() => navigate("/agent/listings/new")}>
              Create Your First Listing
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-xl bg-card">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Address</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">City</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Price</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Style</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Beds/Baths</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr 
                    key={listing.id} 
                    className="border-t hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
                      {listing.address}
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
                      {listing.city}, {listing.state}
                    </td>
                    <td className="px-4 py-3 font-medium cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
                      ${listing.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
                      {listing.listing_type === "for_rent" ? "Rental" : "Sale"}
                    </td>
                    <td className="px-4 py-3 capitalize cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
                      {listing.property_type === "condo"
                        ? "Condo"
                        : listing.property_type === "multi_family"
                        ? "Multi-Family"
                        : listing.property_type === "single_family"
                        ? "Single Family"
                        : listing.property_type?.replace(/_/g, " ") ?? "-"}
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
                      {listing.bedrooms ?? "-"} / {listing.bathrooms ?? "-"}
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          listing.status === "active" 
                            ? "bg-green-100 text-green-800"
                            : listing.status === "draft"
                            ? "bg-gray-100 text-gray-800"
                            : listing.status === "coming_soon"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {listing.status.replace("_", " ")}
                        </span>
                        {formatAutoActivationInfo(listing) && (
                          <span className="text-xs text-muted-foreground">
                            {formatAutoActivationInfo(listing)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/agent/listings/edit/${listing.id}`);
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyListings;
