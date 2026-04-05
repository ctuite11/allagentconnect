import Footer from "@/components/Footer";
import { Seo } from "@/components/Seo";

const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo title="Cookie Policy" description="Cookie policy for All Agent Connect." canonical="https://allagentconnect.com/cookies" />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-4xl font-bold mb-3">Cookie Policy</h1>
          <p className="text-muted-foreground mb-8">This page outlines how All Agent Connect handles cookies on the platform.</p>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">What Are Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies are small text files stored on your device when you visit a website. They help 
                the site remember your preferences, keep you signed in, and understand how the platform 
                is being used. Most websites rely on cookies to function properly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Cookies We Use</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                All Agent Connect uses the following categories of cookies:
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Essential Cookies</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    These cookies are required for the platform to function. They handle authentication, 
                    session management, and security. Without them, you would not be able to sign in, 
                    access your dashboard, or submit listings. Essential cookies cannot be disabled.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Analytics Cookies</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Analytics cookies help us understand how agents and visitors use the platform — 
                    which pages are visited most, where users encounter issues, and how features are 
                    adopted. This data is aggregated and anonymized. We use it to improve the platform 
                    experience, not to identify individual users.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Functional Cookies</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Functional cookies remember your preferences, such as display settings, selected 
                    markets, or notification choices. They make the platform more convenient by 
                    restoring your prior selections when you return.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Third-Party Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may use third-party services for analytics and platform performance monitoring. 
                These services may set their own cookies to collect usage data on our behalf. 
                All Agent Connect does not use third-party advertising cookies or sell cookie data 
                to advertisers. Any third-party cookies are governed by the respective provider's 
                privacy policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">How to Manage Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                You can control and manage cookies through your browser settings. Most browsers allow 
                you to block or delete cookies, set preferences for specific websites, or receive 
                alerts when cookies are being set. Please note that disabling essential cookies will 
                affect core platform functionality — you may not be able to sign in or use features 
                that require authentication.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Cookie Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                Session cookies are temporary and are deleted when you close your browser. Persistent 
                cookies remain on your device for a set period or until you delete them manually. 
                Authentication cookies typically persist for the duration of your login session. 
                Analytics cookies are generally retained for up to 12 months. Functional preference 
                cookies may persist for up to 12 months to maintain your settings across visits.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Updates to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Cookie Policy from time to time to reflect changes in our 
                practices or for operational, legal, or regulatory reasons. When we make changes, 
                the "Last updated" date at the bottom of this page will be revised. Continued use 
                of the platform after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section className="pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Last updated: April 2026
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CookiePolicy;
