import React, { useLayoutEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Seo } from "@/components/Seo";
import DcmlsHomeHero from "@/components/dcmls/DcmlsHomeHero";
import DcmlsSeeItFirst from "@/components/dcmls/DcmlsSeeItFirst";
import DcmlsWhatsInside from "@/components/dcmls/DcmlsWhatsInside";
import DcmlsFooter from "@/components/dcmls/DcmlsFooter";

const DCMLS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Direct Connect MLS",
  url: "https://directconnectmls.com",
  description:
    "Direct Connect MLS — a network of agent-published listings you won't find anywhere else.",
};

function clearAacHomeHeroShell() {
  document.getElementById("aac-home-hero-shell")?.remove();
  document.getElementById("aac-home-hero-shell-css")?.remove();
  document.documentElement.classList.remove("aac-home-hero-shell");
}

const DcmlsHome: React.FC = () => {
  useLayoutEffect(() => {
    clearAacHomeHeroShell();
  }, []);

  return (
    <>
      <Seo
        title="Direct Connect MLS — Find It First"
        description="Browse agent-published homes on Direct Connect MLS — including off-market and coming-soon listings. Contact the listing agent directly, or choose buyer representation."
        canonical="https://directconnectmls.com"
        brandType="dcmls"
        image="/images/dcmls/hero-house.jpg"
        jsonLd={DCMLS_JSON_LD}
      />
      <Helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
        />
        <style>{`
          @keyframes dcmls-hero-zoom {
            from { transform: scale(1.08); }
            to { transform: scale(1); }
          }
          @keyframes dcmls-fade-up {
            from { opacity: 0; transform: translateY(18px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </Helmet>

      <div className="flex min-h-screen flex-col bg-white">
        <main className="flex-1">
          <DcmlsHomeHero />
          <DcmlsSeeItFirst />
          <DcmlsWhatsInside />
        </main>
        <DcmlsFooter />
      </div>
    </>
  );
};

export default DcmlsHome;
