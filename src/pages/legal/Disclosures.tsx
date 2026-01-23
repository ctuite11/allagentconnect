import Footer from "@/components/Footer";
import { AlertCircle } from "lucide-react";

const Disclosures = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">Disclosures</h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            <section className="p-6 bg-muted/50 rounded-lg border">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                No Agency Disclosure
              </h2>
              <p className="text-muted-foreground leading-relaxed m-0">
                Use of this platform does not create an agency relationship. All parties are 
                responsible for their own representation and due diligence.
              </p>
            </section>

            <section className="p-6 bg-muted/50 rounded-lg border">
              <h2 className="text-xl font-semibold mb-3">Off-Market / Coming Soon Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed m-0">
                Off-market and coming-soon listings are shared at the discretion of listing 
                agents and may not be publicly marketed. Availability, pricing, and terms are 
                subject to change without notice.
              </p>
            </section>

            <section className="p-6 bg-muted/50 rounded-lg border">
              <h2 className="text-xl font-semibold mb-3">Accuracy Disclaimer</h2>
              <p className="text-muted-foreground leading-relaxed m-0">
                Listing information is provided by participating agents and has not been 
                independently verified. Users should confirm all details directly with the 
                listing agent.
              </p>
            </section>

            <section className="p-6 bg-muted/50 rounded-lg border">
              <h2 className="text-xl font-semibold mb-3">MLS Non-Affiliation Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed m-0">
                This platform is not a multiple listing service and is not affiliated with 
                any MLS or REALTOR® association.
              </p>
            </section>

            <section className="p-6 bg-muted/50 rounded-lg border">
              <h2 className="text-xl font-semibold mb-3">Compensation Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed m-0">
                Buyer agent compensation, if any, is determined solely by the listing agent 
                or seller. No compensation is implied or guaranteed by the platform.
              </p>
            </section>

            <section className="p-6 bg-muted/50 rounded-lg border">
              <h2 className="text-xl font-semibold mb-3">Verification Disclaimer</h2>
              <p className="text-muted-foreground leading-relaxed m-0">
                Verification confirms license status at the time of review but does not 
                guarantee ongoing licensure or professional conduct.
              </p>
            </section>

            <section className="p-6 bg-muted/50 rounded-lg border">
              <h2 className="text-xl font-semibold mb-3">Intellectual Property & Patent Notice</h2>
              <p className="text-muted-foreground leading-relaxed m-0">
                Certain platform features are protected by issued and pending U.S. patents. 
                Unauthorized use is prohibited.
              </p>
            </section>

            <section className="p-6 bg-muted/50 rounded-lg border">
              <h2 className="text-xl font-semibold mb-3">Consumer Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed m-0">
                This site facilitates direct communication with listing agents. It does not 
                represent buyers or sellers and does not provide brokerage services.
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

export default Disclosures;
