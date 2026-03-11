import React from "react";
import { Helmet } from "react-helmet-async";
import HeroV2 from "@/components/home-v2/HeroV2";
import NetworkIntelSection from "@/components/home-v2/NetworkIntelSection";
import ResultsHubSection from "@/components/home-v2/ResultsHubSection";
import AgentUseCasesSection from "@/components/home-v2/AgentUseCasesSection";
import ScaleSection from "@/components/home-v2/ScaleSection";
import GCISection from "@/components/home-v2/GCISection";
import FinalCTAV2 from "@/components/home-v2/FinalCTAV2";
import TrustStrip from "@/components/home-v2/TrustStrip";
import FooterV2 from "@/components/home-v2/FooterV2";

const HomepageV2 = () => {
  return (
    <>
      <Helmet>
        <title>All Agent Connect — See the Market Before It Hits the MLS</title>
        <meta name="description" content="The private network where agents share off-market listings, buyer demand, and deal intelligence before properties go public." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <HeroV2 />
        <NetworkIntelSection />
        <ResultsHubSection />
        <AgentUseCasesSection />
        <ScaleSection />
        <GCISection />
        <FinalCTAV2 />
        <TrustStrip />
        <FooterV2 />
      </div>
    </>
  );
};

export default HomepageV2;
