import { Helmet } from "react-helmet-async";
import HeroAgentFirst from "@/components/allagent/HeroAgentFirst";
import AgentOS from "@/components/allagent/AgentOS";
import NetworkEffect from "@/components/allagent/NetworkEffect";
import CoreFeatures from "@/components/allagent/CoreFeatures";
import ListingOwnership from "@/components/allagent/ListingOwnership";
import ProfessionalStandards from "@/components/allagent/ProfessionalStandards";
import PatentProtected from "@/components/allagent/PatentProtected";
import BuiltByAgents from "@/components/allagent/BuiltByAgents";
import AudienceGrid from "@/components/allagent/AudienceGrid";
import FinalCTA from "@/components/allagent/FinalCTA";

const AllAgentConnectHome = () => {
  return (
    <>
      <Helmet>
        <title>AllAgentConnect | More Agents. More Listings. More Deals.</title>
        <meta 
          name="description" 
          content="The agent-first collaboration network where real connections create real deal flow. Join thousands of verified agents growing their business together." 
        />
        <meta name="keywords" content="real estate agents, agent collaboration, buyer needs, off-market listings, referral network" />
      </Helmet>

      <div className="min-h-screen">
        <HeroAgentFirst />
        <AgentOS />
        <NetworkEffect />
        <CoreFeatures />
        <ListingOwnership />
        <ProfessionalStandards />
        <PatentProtected />
        <BuiltByAgents />
        <AudienceGrid />
        <FinalCTA />
      </div>
    </>
  );
};

export default AllAgentConnectHome;
