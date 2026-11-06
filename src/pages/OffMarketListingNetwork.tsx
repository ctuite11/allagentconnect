import React from "react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import FooterV2 from "@/components/home-v2/FooterV2";

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Private agent-to-agent real estate collaboration",
  serviceType: "Off-market and pre-market real estate agent network",
  audience: { "@type": "Audience", audienceType: "Licensed real estate agents" },
  areaServed: { "@type": "AdministrativeArea", name: "Massachusetts" },
  provider: { "@type": "Organization", name: "All Agent Connect", url: "https://allagentconnect.com/" },
  url: "https://allagentconnect.com/off-market-listing-network",
};

export default function OffMarketListingNetwork() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Off-Market Listing Network for Agents | All Agent Connect"
        description="Private collaboration for verified Massachusetts real estate agents sharing properties being prepared for sale, seller-approved private opportunities, and buyer needs."
        canonical="https://allagentconnect.com/off-market-listing-network"
        jsonLd={serviceJsonLd}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <p className="text-sm font-semibold text-[#0E56F5]">Greater Boston · Massachusetts</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">An off-market listing network for verified real estate agents</h1>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">
          All Agent Connect helps licensed agents discuss properties being prepared for listing, seller-approved private opportunities,
          and active buyer demand with verified peers across brokerages.
        </p>
        <h2 className="mt-12 text-2xl font-semibold text-slate-900">What agents can do</h2>
        <ul className="mt-5 list-disc space-y-3 pl-6 text-slate-600 leading-relaxed">
          <li>Share details of a property when the seller permits private agent collaboration.</li>
          <li>Create Hot Sheets to search for properties matching represented buyers' needs.</li>
          <li>Post buyer or renter needs and communicate directly with other verified agents.</li>
          <li>Keep member listings and client details inside the verified network rather than publishing them on this page.</li>
        </ul>
        <h2 className="mt-12 text-2xl font-semibold text-slate-900">Privacy and compliance come first</h2>
        <p className="mt-4 text-slate-600 leading-relaxed">
          Private sharing does not automatically exempt a listing from MLS rules, Clear Cooperation obligations, or brokerage requirements.
          Agents must follow applicable rules and obtain seller authorization before sharing any property information.
        </p>
        <p className="mt-6 text-slate-600 leading-relaxed">
          AAC is based in Greater Boston and designed for cross-brokerage collaboration. This public page is informational;
          only approved agents can view the member network.
        </p>
        <div className="mt-10 flex flex-wrap gap-5">
          <Link to="/request-access" className="inline-flex rounded-full bg-[#0E56F5] px-6 py-3 font-semibold text-white">Request agent access</Link>
          <Link to="/faq" className="inline-flex items-center font-medium text-[#0E56F5] underline underline-offset-4">Read membership FAQs</Link>
        </div>
      </main>
      <FooterV2 />
    </div>
  );
}
