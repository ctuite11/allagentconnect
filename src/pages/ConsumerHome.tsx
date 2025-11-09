import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FeaturedProperties from "@/components/FeaturedProperties";
import MinimalSearchHero from "@/components/MinimalSearchHero";

const ConsumerHome = () => {
  // Debug marker to verify this route is rendering
  console.info("[ConsumerHome] Rendered at", new Date().toISOString());

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        {/* Minimal, streamlined hero */}
        <MinimalSearchHero />

        {/* Featured Properties */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Featured Properties</h2>
              <p className="text-xl text-muted-foreground">
                Explore our hand-picked selection of exceptional homes
              </p>
            </div>
            <FeaturedProperties />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ConsumerHome;
