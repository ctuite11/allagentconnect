import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";

/** Agent Settings → Social Media: pointer only. Profile is the single management place. */
export function SocialMediaSettingsCard() {
  return (
    <AgentSectionCard className="space-y-4 p-5 md:p-6">
      <div>
        <h2 className={agentSectionTitle}>Social Media</h2>
        <p className={`mt-0.5 ${agentSectionDesc}`}>
          Manage your social profile links and publishing connections from your Profile.
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/agent/profile#social-media">Go to Profile</Link>
      </Button>
    </AgentSectionCard>
  );
}
