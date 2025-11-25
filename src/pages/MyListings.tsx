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
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  created_at: string;
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
                  <th className="px-4 py-3 text-left font-medium text-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Beds/Baths</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Sq Ft</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr 
                    key={listing.id} 
                    className="border-t hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/property/${listing.id}`)}
                  >
                    <td className="px-4 py-3">{listing.address}</td>
                    <td className="px-4 py-3">{listing.city}, {listing.state}</td>
                    <td className="px-4 py-3 font-medium">
                      ${listing.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {listing.property_type?.replace(/_/g, " ") ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {listing.bedrooms ?? "-"} / {listing.bathrooms ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {listing.square_feet ? listing.square_feet.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        listing.status === "active" 
                          ? "bg-green-100 text-green-800"
                          : listing.status === "draft"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {listing.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(listing.created_at).toLocaleDateString()}
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
