import Footer from "@/components/Footer";
import { Seo } from "@/components/Seo";

const FairHousing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo title="Fair Housing" description="All Agent Connect's commitment to fair housing and equal opportunity." canonical="https://allagentconnect.com/fair-housing" />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">Fair Housing</h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Our Commitment</h2>
              <p className="text-muted-foreground leading-relaxed">
                All Agent Connect is committed to the letter and spirit of the Fair Housing Act 
                (Title VIII of the Civil Rights Act of 1968) and all applicable federal, state, 
                and local fair housing laws. We believe that everyone deserves equal access to 
                housing opportunities, and we design and operate our platform with that principle 
                at the center.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Protected Classes</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Under federal law, it is illegal to discriminate in the sale, rental, or financing 
                of housing based on:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Race</li>
                <li>Color</li>
                <li>National origin</li>
                <li>Religion</li>
                <li>Sex (including gender identity and sexual orientation)</li>
                <li>Familial status</li>
                <li>Disability</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Many states and localities provide additional protections covering characteristics 
                such as age, marital status, source of income, veteran status, and others. Agents 
                on this platform are expected to comply with all applicable fair housing protections 
                in their jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">What This Means on Our Platform</h2>
              <p className="text-muted-foreground leading-relaxed">
                Listings on All Agent Connect must not contain language that expresses a preference 
                for or against any protected class. Property matching and search features are based 
                solely on property characteristics — such as price, location, size, and type — and 
                are never filtered by the characteristics of potential buyers or renters. We do not 
                use algorithms or data that would result in discriminatory outcomes in how listings 
                are displayed, recommended, or shared.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Agent Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed">
                Every agent on the All Agent Connect network is individually responsible for 
                complying with fair housing laws in all communications, transactions, and client 
                interactions facilitated through the platform. This includes listing descriptions, 
                client correspondence, showing availability, and any other professional activity 
                conducted through or in connection with the network. Agents who engage in 
                discriminatory practices are subject to enforcement under our{" "}
                <a href="/agent-network-rules" className="text-primary hover:underline">Agent Network Rules</a>, 
                which may include suspension or permanent removal from the platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Reporting Discrimination</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you believe you have experienced or witnessed housing discrimination on this 
                platform, please contact us at{" "}
                <a href="mailto:hello@allagentconnect.com" className="text-primary hover:underline">hello@allagentconnect.com</a>. 
                We take all reports seriously and will investigate promptly.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You may also file a complaint with the U.S. Department of Housing and Urban 
                Development (HUD) at{" "}
                <a href="https://www.hud.gov/program_offices/fair_housing_equal_opp/online-complaint" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  www.hud.gov
                </a>{" "}
                or by calling 1-800-669-9777.
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
