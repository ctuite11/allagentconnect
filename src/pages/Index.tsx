import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import FeaturedProperties from "@/components/FeaturedProperties";
import Benefits from "@/components/Benefits";
import CallToAction from "@/components/CallToAction";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <FeaturedProperties />
      <Benefits />
      <CallToAction />
      <Footer />
    </div>
  );
};

export default Index;
