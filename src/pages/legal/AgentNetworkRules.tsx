import Footer from "@/components/Footer";

const AgentNetworkRules = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">Agent Network Rules</h1>
          <p className="text-xl text-muted-foreground mb-8">Code of Conduct</p>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Professional Standards</h2>
              <p className="text-muted-foreground leading-relaxed">
                Agents must act professionally, provide accurate information, respect the 
                confidentiality of off-market and coming-soon listings, and refrain from 
                scraping, redistributing, or misusing platform data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Enforcement</h2>
              <p className="text-muted-foreground leading-relaxed">
                Violations may result in warnings, suspension, or permanent removal from 
                the network.
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

export default AgentNetworkRules;
