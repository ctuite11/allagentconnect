import Navigation from "@/components/Navigation";
import PropertySearchHero from "@/components/PropertySearchHero";
import FeaturedPropertyShowcase from "@/components/FeaturedPropertyShowcase";
import CommissionTransparency from "@/components/CommissionTransparency";
import AgentIdentificationSection from "@/components/AgentIdentificationSection";
import RealtimeListingUpdates from "@/components/RealtimeListingUpdates";
import Benefits from "@/components/Benefits";
import CallToAction from "@/components/CallToAction";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <PropertySearchHero />
      <FeaturedPropertyShowcase />
      <CommissionTransparency />
      <AgentIdentificationSection />
      <RealtimeListingUpdates />
      <Benefits />
      <CallToAction />
      <Footer />
    </div>
  );
};

export default Index;
