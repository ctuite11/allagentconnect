import Footer from "@/components/Footer";
import { Home } from "lucide-react";

const FairHousing = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Home className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">Fair Housing</h1>
          </div>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Our Commitment</h2>
              <p className="text-muted-foreground leading-relaxed">
                We support the principles of the Fair Housing Act and do not tolerate 
                discrimination based on protected characteristics.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Equal Opportunity</h2>
              <p className="text-muted-foreground leading-relaxed">
                All Agent Connect is committed to ensuring that all users have equal access 
                to housing opportunities regardless of race, color, religion, sex, national 
                origin, familial status, or disability.
              </p>
            </section>

            <section className="pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FairHousing;
