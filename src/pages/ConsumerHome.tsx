import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FeaturedPropertyShowcase from "@/components/FeaturedPropertyShowcase";
import AdBanner from "@/components/AdBanner";
import { Search, Home, DollarSign, MapPin, TrendingUp, Users, Shield } from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";

const ConsumerHome = () => {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState<"buy" | "rent">("buy");
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    params.append("status", "active");
    if (searchType === "rent") {
      params.append("listing_type", "for_rent");
    } else {
      params.append("listing_type", "for_sale");
    }
    if (location) {
      params.append("location", location);
    }
    if (minPrice) {
      params.append("minPrice", minPrice);
    }
    if (maxPrice) {
      params.append("maxPrice", maxPrice);
    }
    navigate(`/search-results?${params.toString()}`);
  };


  const quickLinks = [
    { label: "Homes for sale", type: "buy", icon: Home },
    { label: "Homes for rent", type: "rent", icon: Home },
    { label: "Recently sold", status: "sold", icon: TrendingUp },
    { label: "Price reduced", icon: DollarSign },
  ];

  const benefits = [
    {
      icon: Search,
      title: "Advanced Search",
      description: "Filter by price, location, bedrooms, and more to find your perfect home",
    },
    {
      icon: MapPin,
      title: "Interactive Maps",
      description: "Explore neighborhoods and see properties on interactive maps",
    },
    {
      icon: Shield,
      title: "Verified Listings",
      description: "All listings are verified by licensed real estate professionals",
    },
    {
      icon: Users,
      title: "Expert Agents",
      description: "Connect with experienced agents who know your local market",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section with Search */}
      <section 
        className="relative pt-24 pb-32 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${heroImage})`
        }}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Find Your Dream Home
            </h1>
            <p className="text-xl text-white/90">
              Search thousands of homes for sale and rent across the country
            </p>
          </div>

          {/* Search Box */}
          <Card className="max-w-4xl mx-auto shadow-2xl">
            <CardContent className="p-6">
              <Tabs value={searchType} onValueChange={(v) => setSearchType(v as "buy" | "rent")} className="mb-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="buy">Buy</TabsTrigger>
                  <TabsTrigger value="rent">Rent</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-4">
                <Input
                  placeholder="Enter city, neighborhood, or ZIP code"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-12 text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="h-12 text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="h-12 text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>

              <Button 
                onClick={handleSearch}
                className="w-full h-12 text-lg mt-4"
                size="lg"
              >
                <Search className="w-5 h-5 mr-2" />
                Search Properties
              </Button>

              {/* Quick Links */}
              <div className="flex flex-wrap gap-3 mt-6">
                {quickLinks.map((link, idx) => {
                  const Icon = link.icon;
                  return (
                    <Button
                      key={idx}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const params = new URLSearchParams();
                        params.append("status", link.status || "active");
                        if (link.type) {
                          params.append("listing_type", link.type === "rent" ? "for_rent" : "for_sale");
                        }
                        navigate(`/search-results?${params.toString()}`);
                      }}
                      className="text-sm"
                    >
                      <Icon className="w-4 h-4 mr-1" />
                      {link.label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Featured Properties</h2>
            <p className="text-xl text-muted-foreground">
              Explore our hand-picked selection of exceptional homes
            </p>
          </div>
          <FeaturedPropertyShowcase />
        </div>
      </section>

      {/* Vendor Advertisement Banner */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <AdBanner placementZone="homepage_hero" />
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Choose Us</h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to find and secure your perfect home
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <Card key={idx} className="text-center">
                  <CardContent className="pt-8 pb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Find Your Home?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of happy homeowners and renters who found their perfect place
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" onClick={() => navigate('/browse')}>
              Browse All Properties
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/our-agents')} className="border-white text-white hover:bg-white hover:text-primary">
              Find an Agent
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ConsumerHome;