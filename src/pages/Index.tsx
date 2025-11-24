import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import PropertySearchHero from "@/components/PropertySearchHero";
import FeaturedPropertyShowcase from "@/components/FeaturedPropertyShowcase";
import RecentlySold from "@/components/RecentlySold";
import CommissionTransparency from "@/components/CommissionTransparency";
import AgentIdentificationSection from "@/components/AgentIdentificationSection";
import RealtimeListingUpdates from "@/components/RealtimeListingUpdates";
import Benefits from "@/components/Benefits";
import CallToAction from "@/components/CallToAction";
import Footer from "@/components/Footer";
import { ActiveAgentBanner } from "@/components/ActiveAgentBanner";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if this is a password reset redirect
    const authParam = searchParams.get('auth');
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isRecovery = hashParams.get('type') === 'recovery';

    if (authParam === 'buyer-reset' && isRecovery) {
      // Redirect to buyer auth page with hash params preserved
      navigate(`/buyer-auth${window.location.hash}`, { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen">
      <Navigation />
      <ActiveAgentBanner />
      <PropertySearchHero />
      <FeaturedPropertyShowcase />
      <RecentlySold />
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
