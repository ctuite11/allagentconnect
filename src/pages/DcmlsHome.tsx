import React from "react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import DcmlsExclusiveListings from "@/components/DcmlsExclusiveListings";
import Footer from "@/components/Footer";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";

// AAC brand identity — applied to DCMLS surface
const AAC_BLUE = "#0E56F5";
const AAC_GREEN = "#50C878"; // luxury accent — used sparingly

const DCMLS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Direct Connect MLS",
  url: "https://directconnectmls.com",
  description:
    "Direct Connect MLS — a network of agent-published listings you won't find anywhere else.",
};

const DcmlsHome: React.FC = () => {
  return (
    <>
      <Seo
        title="Direct Connect MLS — Homes You Won't Find Anywhere Else"
        description="Direct Connect MLS is a network of agent-published listings, including off-market and coming-soon homes you won't find on the public MLS."
        canonical="https://directconnectmls.com"
        jsonLd={DCMLS_JSON_LD}
      />

      <div className="bg-background min-h-screen flex flex-col">
        <DcmlsConsumerHeader />

        <main className="flex-1">
          {/* Hero */}
          <section className="border-b border-border/60">
            <div className="max-w-5xl mx-auto px-6 py-24 md:py-32 text-center">
              {/* Eyebrow with luxury green accent dot */}
              <div className="inline-flex items-center gap-2 mb-8">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: AAC_GREEN }}
                  aria-hidden
                />
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                  Direct Connect MLS
                </p>
              </div>

              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-foreground mb-6 leading-[1.05]">
                Homes you won't find{" "}
                <span style={{ color: AAC_BLUE }}>anywhere else</span>.
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                A private network of agent-published listings — off-market,
                coming-soon, and exclusives outside the public MLS.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg">
                  <Link to="/browse?dcmls=1">Browse DCMLS Listings</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">Agent Sign In</Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Opportunity callout strip — restrained, with green as luxury accent */}
          <section className="border-b border-border/60 bg-muted/30">
            <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: "Off-Market", desc: "Pre-public opportunities" },
                { label: "Coming Soon", desc: "Listings before they hit MLS" },
                { label: "Agent Exclusive", desc: "Network-only inventory" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 inline-block w-1 h-1 rounded-full shrink-0"
                    style={{ backgroundColor: AAC_GREEN }}
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground tracking-tight">
                      {item.label}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Exclusive listings */}
          <section className="py-16 md:py-20">
            <div className="max-w-6xl mx-auto px-6">
              <DcmlsExclusiveListings />
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default DcmlsHome;
