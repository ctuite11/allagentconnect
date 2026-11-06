import React from "react";
import { Link } from "react-router-dom";

export default function FounderTrustSection() {
  return (
    <section aria-labelledby="founder-trust-title" className="bg-white px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 p-8 md:p-12">
        <p className="text-sm font-semibold text-[#0E56F5]">Built by an agent, for agents</p>
        <h2 id="founder-trust-title" className="mt-3 font-['Manrope'] text-3xl font-semibold text-slate-900 md:text-4xl">
          Chris Tuite · Founder, All Agent Connect
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">
          Chris is a Boston real estate broker with more than 30 years of experience. He created
          All Agent Connect to make it easier for licensed agents from different brokerages
          to share opportunities and buyer needs without opening a private network to the public.
        </p>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
          He is the named inventor of U.S. Patent No. 11,379,939 B2, Real Estate Buyer Registry.
          The patent is a public record, not an endorsement of AAC or a claim of member results.
        </p>
        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
          <Link to="/about" className="font-semibold text-[#0E56F5] underline underline-offset-4">Read the founder story</Link>
          <a href="https://patents.google.com/patent/US11379939B2/en" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0E56F5] underline underline-offset-4">View patent record</a>
        </div>
      </div>
    </section>
  );
}
