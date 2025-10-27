import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const CallToAction = () => {
  return (
    <section className="py-20 bg-hero-gradient text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Find Your Dream Home?
          </h2>
          <p className="text-xl mb-8 opacity-95">
            Join thousands of satisfied homebuyers who have saved millions with our transparent approach to real estate.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 bg-transparent text-white border-white hover:bg-white hover:text-primary">
              Contact an Agent
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
