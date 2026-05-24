import AgentProfile from "./AgentProfile";
import Footer from "@/components/Footer";
import { useAuthRole } from "@/hooks/useAuthRole";

export default function PublicAgentProfile() {
  const { role } = useAuthRole();
  const isAgentAppViewer = role === "agent" || role === "admin";

  return (
    <>
      <AgentProfile publicMode={!isAgentAppViewer} />
      {!isAgentAppViewer && <Footer />}
    </>
  );
}
