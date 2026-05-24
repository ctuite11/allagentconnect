import AgentProfile from "./AgentProfile";
import Footer from "@/components/Footer";
import { useAuthRole } from "@/hooks/useAuthRole";

export default function PublicAgentProfile() {
  const { role, loading } = useAuthRole();
  const showPublicFooter = !loading && role !== "agent" && role !== "admin";

  return (
    <>
      <AgentProfile publicMode />
      {showPublicFooter && <Footer />}
    </>
  );
}
