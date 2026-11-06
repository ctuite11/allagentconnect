import React, { Suspense, useLayoutEffect } from "react";
import { Seo } from "@/components/Seo";
import { isDcmlsHost } from "@/lib/host";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import HeroSection from "@/components/home-v2/HeroSection";
import ProofStrip from "@/components/home-v2/ProofStrip";
// Below-the-fold sections are lazy so they don't inflate the initial JS payload
// on the public landing page. Hero + ProofStrip stay eager for LCP/FCP.
const NetworkIntelligence = lazyWithRetry(() => import("@/components/home-v2/NetworkIntelligence"));
const EcosystemSection = lazyWithRetry(() => import("@/components/home-v2/EcosystemSection"));
const HowAgentsUseAAC = lazyWithRetry(() => import("@/components/home-v2/HowAgentsUseAAC"));
const ScalePersistence = lazyWithRetry(() => import("@/components/home-v2/ScalePersistence"));
const GCIBenefits = lazyWithRetry(() => import("@/components/home-v2/GCIBenefits"));
const FinalCTA = lazyWithRetry(() => import("@/components/home-v2/FinalCTA"));
const FooterV2 = lazyWithRetry(() => import("@/components/home-v2/FooterV2"));
const MemberPreviewSection = lazyWithRetry(() => import("@/components/home-v2/MemberPreviewSection"));
const FounderTrustSection = lazyWithRetry(() => import("@/components/home-v2/FounderTrustSection"));
const AgentStoriesSection = lazyWithRetry(() => import("@/components/home-v2/AgentStoriesSection"));

const HOMEPAGE_DESCRIPTION =
  "A private network for verified real estate agents. Share buyer needs, properties being prepared for sale, and connect directly across brokerages.";

const HOMEPAGE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://allagentconnect.com/#organization",
      name: "All Agent Connect",
      url: "https://allagentconnect.com/",
      logo: "https://allagentconnect.com/og-image.jpg?v=20260902",
      description: HOMEPAGE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": "https://allagentconnect.com/#website",
      name: "All Agent Connect",
      url: "https://allagentconnect.com/",
      description: HOMEPAGE_DESCRIPTION,
      publisher: { "@id": "https://allagentconnect.com/#organization" },
    },
    {
      "@type": "Service",
      "@id": "https://allagentconnect.com/#agent-network",
      name: "All Agent Connect verified agent network",
      serviceType: "Private real estate agent collaboration network",
      audience: { "@type": "Audience", audienceType: "Licensed real estate agents" },
      areaServed: { "@type": "AdministrativeArea", name: "Massachusetts" },
      provider: { "@id": "https://allagentconnect.com/#organization" },
      description: HOMEPAGE_DESCRIPTION,
      url: "https://allagentconnect.com/",
    },
  ],
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
            : "All Agent Connect | Private Network for Real Estate Agents"
        }
        description={HOMEPAGE_DESCRIPTION}
        canonical={isDcmls ? undefined : "https://allagentconnect.com/"}
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
            <MemberPreviewSection />
            <FounderTrustSection />
            <AgentStoriesSection />
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
