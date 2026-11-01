import Footer from "@/components/Footer";
import { Seo } from "@/components/Seo";

const ABOUT_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      name: "About All Agent Connect",
      url: "https://allagentconnect.com/about",
      description:
        "All Agent Connect is a private, verified network connecting real estate agents across brokerages to share properties, buyer needs, and market intelligence.",
      isPartOf: { "@type": "WebSite", name: "All Agent Connect", url: "https://allagentconnect.com/" },
    },
    {
      "@type": "Person",
      name: "Chris Tuite",
      jobTitle: "Founder",
      worksFor: { "@type": "Organization", name: "All Agent Connect", url: "https://allagentconnect.com/" },
      affiliation: { "@type": "Organization", name: "Compass" },
      address: { "@type": "PostalAddress", addressLocality: "Boston", addressRegion: "MA", addressCountry: "US" },
      knowsAbout: ["Real estate", "Boston real estate", "Charlestown real estate"],
      award: "U.S. Patent No. 11,379,939 B2, Real Estate Buyer Registry",
    },
  ],
};

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="About All Agent Connect | Private Network for Real Estate Agents"
        description="All Agent Connect is a private, verified network connecting real estate agents across brokerages. Founded by Boston broker Chris Tuite to help agents share properties, buyer needs, and market intelligence."
        canonical="https://allagentconnect.com/about"
        jsonLd={ABOUT_JSON_LD}
      />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">About All Agent Connect</h1>

          <p className="mt-6 text-base text-muted-foreground leading-7">
            All Agent Connect is a private, verified network for real estate agents. Agents across every brokerage use
            it to share properties being prepared for sale, buyer and renter needs, referrals, and market
            intelligence — directly with one another.
          </p>

          <h2 className="mt-10 text-2xl font-semibold tracking-tight text-foreground">Who it serves</h2>
          <p className="mt-4 text-base text-muted-foreground leading-7">
            All Agent Connect serves licensed, verified real estate agents and the buyers and sellers they represent.
            Membership is limited to verified agents, so every connection inside the network is a real professional
            relationship.
          </p>

          <h2 className="mt-10 text-2xl font-semibold tracking-tight text-foreground">Why it was created</h2>
          <p className="mt-4 text-base text-muted-foreground leading-7">
            After more than three decades in real estate, founder Chris Tuite saw an increasingly fragmented industry.
            Valuable property information, buyer needs, and professional relationships were scattered across
            brokerages, private groups, and disconnected platforms. He created All Agent Connect to bring agents from
            every brokerage together in one verified network, making it easier to collaborate, discover opportunities,
            and provide better service to their clients.
          </p>

          <h2 className="mt-10 text-2xl font-semibold tracking-tight text-foreground">How it connects agents</h2>
          <ul className="mt-4 list-disc pl-6 space-y-3 text-base text-muted-foreground leading-7">
            <li>Agents share off-market and coming-soon properties with verified agents across brokerages.</li>
            <li>Agents create Hot Sheets to identify properties matching their buyers' specific needs.</li>
            <li>
              The Communications Center allows agents to share buyer and renter needs, referrals, and market
              intelligence.
            </li>
            <li>
              Agents connect and communicate directly, building relationships that create more opportunities for their
              clients.
            </li>
          </ul>

          <h2 className="mt-10 text-2xl font-semibold tracking-tight text-foreground">Founder</h2>
          <p className="mt-4 text-base text-muted-foreground leading-7">
            Chris Tuite has spent 33 years as a real estate broker in Boston, with deep experience in Charlestown and
            the Greater Boston market. He is a broker with Compass and the founder of All Agent Connect.
          </p>
          <p className="mt-4 text-base text-muted-foreground leading-7">
            Chris is the inventor of U.S. Patent No. 11,379,939 B2, "Real Estate Buyer Registry" (granted July 5,
            2022) — a computerized system for connecting real estate professionals with buyer demand. That idea grew
            into All Agent Connect.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
