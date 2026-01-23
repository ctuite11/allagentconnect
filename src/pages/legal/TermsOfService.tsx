import Footer from "@/components/Footer";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Eligibility</h2>
              <p className="text-muted-foreground leading-relaxed">
                Access to agent-only features is limited to licensed real estate professionals. 
                Users are responsible for maintaining accurate account information and for all 
                activity conducted through their account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Platform Purpose</h2>
              <p className="text-muted-foreground leading-relaxed">
                The platform is a communications and discovery tool only. It does not represent 
                buyers or sellers, does not participate in real estate transactions, and does not 
                provide brokerage services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Account Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                The company may suspend or terminate accounts for violations, misuse, 
                misrepresentation, or conduct that undermines the integrity of the network.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All platform software, content, design, and features are the exclusive property 
                of the company and are protected by intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These terms are governed by the laws of the Commonwealth of Massachusetts. 
                Disputes shall be resolved through binding arbitration.
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

export default TermsOfService;
