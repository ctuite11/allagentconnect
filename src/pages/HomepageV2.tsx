import React, { lazy, Suspense, useLayoutEffect } from "react";
import { Seo } from "@/components/Seo";
import { isDcmlsHost } from "@/lib/host";
import HeroSection from "@/components/home-v2/HeroSection";
import ProofStrip from "@/components/home-v2/ProofStrip";
// Below-the-fold sections are lazy so they don't inflate the initial JS payload
// on the public landing page. Hero + ProofStrip stay eager for LCP/FCP.
const NetworkIntelligence = lazy(() => import("@/components/home-v2/NetworkIntelligence"));
const EcosystemSection = lazy(() => import("@/components/home-v2/EcosystemSection"));
const HowAgentsUseAAC = lazy(() => import("@/components/home-v2/HowAgentsUseAAC"));
const ScalePersistence = lazy(() => import("@/components/home-v2/ScalePersistence"));
const GCIBenefits = lazy(() => import("@/components/home-v2/GCIBenefits"));
const FinalCTA = lazy(() => import("@/components/home-v2/FinalCTA"));
const FooterV2 = lazy(() => import("@/components/home-v2/FooterV2"));

const HOMEPAGE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "All Agent Connect",
  url: "https://allagentconnect.com",
  description:
    "A private, agent-only network for off-market and coming-soon listings, powered by real buyer and renter needs.",
  sameAs: [],
};

/**
 * After HeroSection LCP handoff, the pre-React shell stays mounted (required so
 * the early LCP image is not discarded) but remains `position:fixed` from
 * index.html. That makes the hero photo stick behind scrolling sections.
 * Convert it to document-absolute so it scrolls away with the page without
 * changing preload, shell markup, or HeroSection.tsx.
 */
function pinHomeHeroShellToDocumentScroll() {
  const shell = document.getElementById("aac-home-hero-shell");
  if (!shell || shell.getAttribute("data-aac-hero-handoff") !== "1") return;

  shell.style.position = "absolute";
  shell.style.top = "0";
  shell.style.left = "0";
  shell.style.right = "0";
  shell.style.bottom = "auto";
  shell.style.width = "100%";
  shell.style.height = "100vh";
  shell.style.minHeight = "100dvh";
  shell.style.zIndex = "0";
}

const HomepageV2 = () => {
  const isDcmls = isDcmlsHost();

  useLayoutEffect(() => {
    pinHomeHeroShellToDocumentScroll();
  }, []);

  return (
    <>
      <Seo
        title={
          isDcmls
            ? "See the Market Before It Hits the MLS"
            : "All Agent Connect | Private Listing Network"
        }
        description="The private network where agents share off-market listings, buyer demand, and deal intelligence before properties go public."
        canonical={isDcmls ? undefined : "https://allagentconnect.com"}
        brandType={isDcmls ? "dcmls" : "aac"}
        jsonLd={HOMEPAGE_JSON_LD}
      />

      <div className="bg-white overflow-x-hidden w-full relative flex flex-col">
        <main className="flex flex-col w-full">
          <HeroSection />
          <ProofStrip />
          <Suspense
            fallback={
              <div
                aria-hidden
                style={{ minHeight: 400, backgroundColor: "#ffffff" }}
              />
            }
          >
            <NetworkIntelligence />
            <EcosystemSection />
            <HowAgentsUseAAC />
            <ScalePersistence />
            <GCIBenefits />
            <FinalCTA />
            <FooterV2 />
          </Suspense>
        </main>
      </div>
    </>
  );
};

export default HomepageV2;
