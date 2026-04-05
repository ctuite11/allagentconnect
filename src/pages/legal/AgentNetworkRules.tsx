import Footer from "@/components/Footer";
import { Seo } from "@/components/Seo";

const AgentNetworkRules = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo title="Agent Network Rules" description="Code of conduct and professional standards for agents on All Agent Connect." canonical="https://allagentconnect.com/agent-network-rules" />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-4xl font-bold mb-3">Agent Network Rules</h1>
          <p className="text-muted-foreground mb-8">Professional standards and code of conduct for agents on the All Agent Connect network.</p>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Membership Eligibility</h2>
              <p className="text-muted-foreground leading-relaxed">
                All Agent Connect is a verified network. Membership is limited to licensed real 
                estate agents who hold an active license in good standing in at least one U.S. state. 
                License verification is required during onboarding and may be re-verified periodically. 
                Agents whose licenses lapse, are suspended, or are revoked will have their network 
                access suspended until their license status is restored.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Professional Conduct</h2>
              <p className="text-muted-foreground leading-relaxed">
                Agents are expected to conduct themselves professionally in all interactions on 
                the platform. This includes providing accurate and truthful information in listings 
                and communications, responding to inquiries in a timely manner, representing 
                themselves and their listings honestly, and treating other agents, clients, and 
                platform staff with respect and courtesy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Confidentiality</h2>
              <p className="text-muted-foreground leading-relaxed">
                Off-market, coming-soon, and pre-market listing information shared through the 
                network is confidential. Agents must not share, redistribute, or publicly disclose 
                non-public listing data outside the platform without the express permission of the 
                listing agent. Scraping, data harvesting, or automated extraction of platform data 
                is strictly prohibited. Agents who receive confidential listing information through 
                the network are expected to use it solely for the purpose of serving their clients' 
                legitimate real estate needs.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Listing Integrity</h2>
              <p className="text-muted-foreground leading-relaxed">
                All listings must contain accurate pricing, property details, and photographs. 
                Agents must update listing statuses promptly when properties go under contract, 
                are sold, or are withdrawn. Misleading descriptions, inflated claims, or materially 
                inaccurate information undermine the trust of the network and are not permitted. 
                Photos must accurately represent the current condition of the property.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Prohibited Conduct</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The following activities are prohibited on the platform:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Posting false, misleading, or fraudulent listing information</li>
                <li>Spamming other agents with unsolicited messages or solicitations</li>
                <li>Scraping, crawling, or bulk downloading platform data</li>
                <li>Circumventing verification, access controls, or security features</li>
                <li>Using the platform to facilitate discriminatory practices in violation of fair housing laws</li>
                <li>Impersonating another agent, brokerage, or entity</li>
                <li>Sharing login credentials or allowing unauthorized access to your account</li>
                <li>Soliciting clients from other agents' listings in a manner that violates industry ethics standards</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Enforcement</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Violations of these rules are subject to enforcement at the discretion of All Agent 
                Connect. Enforcement actions are tiered based on severity and may include:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Warning:</strong> A formal notice identifying the violation and expected corrective action.</li>
                <li><strong>Temporary Suspension:</strong> Restricted access to platform features for a defined period.</li>
                <li><strong>Permanent Removal:</strong> Termination of network membership and revocation of platform access.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Agents who receive an enforcement action may request a review by contacting 
                All Agent Connect at <a href="mailto:hello@allagentconnect.com" className="text-primary hover:underline">hello@allagentconnect.com</a>. 
                Reviews are handled on a case-by-case basis and decisions are final.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Reporting Violations</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you observe conduct that violates these rules, please report it to{" "}
                <a href="mailto:hello@allagentconnect.com" className="text-primary hover:underline">hello@allagentconnect.com</a>. 
                Include as much detail as possible, including the name of the agent involved, 
                a description of the issue, and any supporting documentation. All reports are 
                reviewed confidentially.
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

export default AgentNetworkRules;
