import AgentProfile from "./AgentProfile";
import Footer from "@/components/Footer";

export default function PublicAgentProfile() {
  return (
    <>
      <AgentProfile publicMode />
      <Footer />
    </>
  );
}
