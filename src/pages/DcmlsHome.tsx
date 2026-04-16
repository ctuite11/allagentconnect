import React from "react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import DcmlsExclusiveListings from "@/components/DcmlsExclusiveListings";
import Footer from "@/components/Footer";

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
        <main className="flex-1">
          {/* Hero */}
          <section className="border-b border-border">
            <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
                Direct Connect MLS
              </p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-foreground mb-6 leading-[1.05]">
                The Direct-Connect MLS
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                A network of agent-published listings — off-market, coming-soon,
                and exclusives you won't find on the public MLS.
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
