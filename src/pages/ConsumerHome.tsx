import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FeaturedPropertyShowcase from "@/components/FeaturedPropertyShowcase";
import AdBanner from "@/components/AdBanner";
import { MapPin, Users, Shield } from "lucide-react";
import PropertySearchHero from "@/components/PropertySearchHero";

const benefits = [
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

const ConsumerHome = () => {
  const navigate = useNavigate();

  // Debug marker to verify this route is rendering
  console.info("[ConsumerHome] Rendered at", new Date().toISOString());

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        {/* Modern, unified hero */}
        <PropertySearchHero />

        {/* Featured Properties */}
        <section className="py-16 bg-background">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {benefits.map((benefit, idx) => {
                const Icon = benefit.icon;
                return (
                  <div className="text-center rounded-lg bg-card shadow-md p-8 border">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary rounded-full mb-4">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </div>
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
              <Button size="lg" variant="outline" onClick={() => navigate('/our-agents')}>
                Find an Agent
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ConsumerHome;
