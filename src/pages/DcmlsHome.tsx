import React, { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import DcmlsExclusiveListings from "@/components/DcmlsExclusiveListings";
import Footer from "@/components/Footer";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";
import DcmlsWhatsInside from "@/components/dcmls/DcmlsWhatsInside";
import { isDcmlsAuthAccessEnabled } from "@/lib/dcmlsAuthAccess";

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

function clearAacHomeHeroShell() {
  document.getElementById("aac-home-hero-shell")?.remove();
  document.getElementById("aac-home-hero-shell-css")?.remove();
  document.documentElement.classList.remove("aac-home-hero-shell");
}

const DcmlsHome: React.FC = () => {
  useLayoutEffect(() => {
    clearAacHomeHeroShell();
  }, []);

  return (
    <>
      <Seo
        title="Direct Connect MLS — The property. The listing agent. Your choice."
        description="Browse agent-published homes on Direct Connect MLS. Contact the listing agent directly, or choose buyer representation — your choice."
        canonical="https://directconnectmls.com"
        brandType="dcmls"
        jsonLd={DCMLS_JSON_LD}
      />

      <div className="bg-background min-h-screen flex flex-col">
        <DcmlsConsumerHeader />

        <main className="flex-1">
          {/* Hero */}
          <section className="border-b border-border/60">
            <div className="max-w-5xl mx-auto px-6 py-24 md:py-32 text-center">
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
                The property. The listing agent.{" "}
                <span style={{ color: AAC_BLUE }}>Your choice.</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                Browse agent-published homes — including off-market and coming-soon listings — then
                contact the listing agent directly, or work with a buyer&apos;s agent.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button asChild size="lg" className="text-white min-w-[180px]" style={{ backgroundColor: AAC_BLUE }}>
                  <Link to="/browse?dcmls=1">Browse Listings</Link>
                </Button>
                {isDcmlsAuthAccessEnabled() ? (
                  <div className="flex gap-2">
                    <Button asChild size="lg" variant="outline">
                      <Link to="/consumer/auth?mode=signin">Sign In</Link>
                    </Button>
                    <Button asChild size="lg" variant="ghost">
                      <Link to="/consumer/auth?mode=signup">Create Account</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

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

          <section className="py-16 md:py-20">
            <div className="max-w-6xl mx-auto px-6">
              <DcmlsExclusiveListings />
            </div>
          </section>

          <DcmlsWhatsInside />
        </main>

        <Footer />
      </div>
    </>
  );
};

export default DcmlsHome;
