import React from "react";
import { Helmet } from "react-helmet-async";
import { PageTitle } from "@/components/ui/page-title";

/**
 * Agent Dashboard V2 — parallel redesign scaffold.
 * The live dashboard remains at AgentDashboard.tsx / /agent-dashboard.
 * This file is NOT routed yet; it will be wired in once approved.
 */
const AgentDashboardV2 = () => {
  return (
    <>
      <Helmet>
        <title>Dashboard V2 — All Agent Connect</title>
      </Helmet>

      <div className="p-6 space-y-6">
        <PageTitle>Dashboard V2</PageTitle>
        <p className="text-muted-foreground">
          Redesigned dashboard — scaffold only. Components will be added in{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            src/components/agent-dashboard-v2/
          </code>.
        </p>
      </div>
    </>
  );
};

export default AgentDashboardV2;
