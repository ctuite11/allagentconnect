import React from "react";
import { Link } from "react-router-dom";
import { approvedFounderProfile } from "@/content/publicNetworkProof";

export default function FounderTrustSection() {
  return (
    <section aria-labelledby="founder-trust-title" className="bg-white px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 p-8 md:p-12">
        {approvedFounderProfile.imageSrc && (
          <img
            src={approvedFounderProfile.imageSrc}
            alt="Chris Tuite, founder of All Agent Connect"
            width={128}
            height={128}
            loading="lazy"
            className="mb-5 h-32 w-32 rounded-2xl object-cover"
          />
        )}
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
          All Agent Connect also grew a separate Facebook community of thousands of agents.
          That Facebook group is currently paused and its participants are not counted as active website members.
        </p>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
          He is the named inventor of U.S. Patent No. 11,379,939 B2, Real Estate Buyer Registry.
          The patent is a public record, not an endorsement of AAC or a claim of member results.
        </p>
        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
          <Link to="/about" className="font-semibold text-[#0E56F5] underline underline-offset-4">Read the founder story</Link>
          <a href="https://patents.google.com/patent/US11379939B2/en" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0E56F5] underline underline-offset-4">View patent record</a>
          {approvedFounderProfile.linkedinUrl && (
            <a href={approvedFounderProfile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0E56F5] underline underline-offset-4">
              Chris on LinkedIn
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
