import { useNavigate, Navigate } from "react-router-dom";
import OurAgents from "./OurAgents";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuthRole } from "@/hooks/useAuthRole";

export default function PublicOurAgents() {
  const navigate = useNavigate();
  const { role, loading } = useAuthRole();

  if (!loading && (role === "agent" || role === "admin")) {
    return <Navigate to="/our-members" replace />;
  }

  if (loading) {
    return null;
  }

  return (
    <>
      <OurAgents isPublicMode defaultAgentMode={false} />
      <section className="border-t border-neutral-200/90 bg-white py-10 md:py-12">
        <div className="mx-auto max-w-2xl px-5 text-center md:px-6">
          <h2 className="mb-2 text-base font-semibold tracking-tight text-neutral-900 md:text-lg">
            Are you a real estate agent?
          </h2>
          <p className="mx-auto mb-6 max-w-xl text-[13px] leading-snug text-neutral-600">
            Join All Agent Connect and connect with buyers actively searching for properties in your area.
          </p>
          <Button type="button" size="sm" onClick={() => navigate("/auth?mode=register")}>
            Register as an agent
          </Button>
        </div>
      </section>
      <Footer />
    </>
  );
}
