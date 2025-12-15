import { useEffect, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ExternalLink, Phone, Mail, Globe } from "lucide-react";
import { toast } from "sonner";

const businessTypes = [
  { value: "all", label: "All Services" },
  { value: "mortgage", label: "Mortgage Broker/Lender" },
  { value: "inspection", label: "Home Inspector" },
  { value: "title", label: "Title Company" },
  { value: "insurance", label: "Home Insurance" },
  { value: "contractor", label: "Contractor/Handyman" },
  { value: "moving", label: "Moving Company" },
  { value: "staging", label: "Home Staging" },
  { value: "photography", label: "Real Estate Photography" },
  { value: "attorney", label: "Real Estate Attorney" },
  { value: "other", label: "Other Service" },
];

const VendorDirectory = () => {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    filterVendors();
  }, [searchQuery, selectedType, vendors]);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select(`
          *,
          subscriptions:vendor_subscriptions(
            status,
            package:ad_packages(ad_type)
          )
        `)
        .eq('is_approved', true)
        .eq('is_active', true)
        .order('company_name', { ascending: true });

      if (error) throw error;
      setVendors(data || []);
      setFilteredVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to load vendor directory');
    } finally {
      setLoading(false);
    }
  };

  const filterVendors = () => {
    let filtered = vendors;

    if (selectedType !== "all") {
      filtered = filtered.filter(v => v.business_type === selectedType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.company_name.toLowerCase().includes(query) ||
        v.description?.toLowerCase().includes(query)
      );
    }

    setFilteredVendors(filtered);
  };

  const isFeatured = (vendor: any) => {
    return vendor.subscriptions?.some((sub: any) => 
      sub.status === 'active' && sub.package?.ad_type === 'featured'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      <div className="mb-8">
        <PageTitle className="mb-4">Vendor Directory</PageTitle>
        <p className="text-xl text-muted-foreground">
          Find trusted service providers for your real estate needs
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by service type" />
          </SelectTrigger>
          <SelectContent>
            {businessTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vendor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className={isFeatured(vendor) ? 'border-primary' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  {vendor.logo_url && (
                    <img 
                      src={vendor.logo_url} 
                      alt={vendor.company_name}
                      className="h-12 w-auto mb-3 object-contain"
                    />
                  )}
                  <CardTitle>{vendor.company_name}</CardTitle>
                  <CardDescription className="capitalize">
                    {businessTypes.find(t => t.value === vendor.business_type)?.label || vendor.business_type}
                  </CardDescription>
                </div>
                {isFeatured(vendor) && (
                  <Badge>Featured</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {vendor.description}
              </p>
              
              <div className="space-y-2 mb-4">
                {vendor.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${vendor.email}`} className="hover:underline">
                      {vendor.email}
                    </a>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${vendor.phone}`} className="hover:underline">
                      {vendor.phone}
                    </a>
                  </div>
                )}
                {vendor.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a 
                      href={vendor.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      Visit Website
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <Button className="w-full" variant="outline">
                Contact Vendor
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVendors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No vendors found matching your criteria</p>
        </div>
      )}
    </div>
  );
};

export default VendorDirectory;