import React from "react";
import { Link } from "react-router-dom";

/**
 * Static marketing mock-ups only. No agents, listings, or buyer records are fetched
 * or exposed to anonymous visitors. All example criteria are fictional.
 */
export default function MemberPreviewSection() {
  const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const label = "text-xs font-semibold uppercase tracking-wider text-slate-500";
  return (
    <section id="member-preview" aria-labelledby="member-preview-title" className="bg-[#f8fafc] px-6 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[#0E56F5]">Inside the verified network</p>
          <h2 id="member-preview-title" className="mt-3 font-['Manrope'] text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            What approved agents can do
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
            Find properties being prepared for sale, share buyer and renter needs, and reach other verified agents directly.
            Member profiles and listing details remain private.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-500">Illustrative examples only — no real member, client, or listing data is shown.</p>
        </div>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          <article className={card}>
            <p className={label}>1 · Listing search</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Find property opportunities</h3>
            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Example search interface">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">Area <span className="float-right font-semibold text-slate-900">Boston area</span></div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">Property type <span className="float-right font-semibold text-slate-900">Residential</span></div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">Status <span className="float-right font-semibold text-slate-900">Preparing to list</span></div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">Search criteria are shown as an example, not live inventory.</p>
          </article>
          <article className={card}>
            <p className={label}>2 · Buyer demand</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Share what a buyer needs</h3>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#0E56F5]">Example buyer-need card</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">Boston · 2+ bedrooms</p>
              <p className="mt-2 text-sm text-slate-600">Agents can describe criteria for a buyer they represent, then look for possible matches.</p>
              <div className="mt-4 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-[#0E56F5] w-fit">Private to verified members</div>
            </div>
          </article>
          <article className={card}>
            <p className={label}>3 · Agent connection</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Contact a verified peer</h3>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0E56F5] text-sm font-bold text-white">AAC</div>
                <div>
                  <p className="font-semibold text-slate-900">Verified agent</p>
                  <p className="text-xs text-slate-500">Profile details visible after verification</p>
                </div>
              </div>
              <p className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">Direct message and collaboration tools are available to approved members.</p>
            </div>
          </article>
        </div>
        <div className="mt-10 border-t border-slate-200 pt-7">
          <h3 className="text-lg font-semibold text-slate-900">How membership starts</h3>
          <ol className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700" aria-label="Agent onboarding process">
            <li className="rounded-lg border border-slate-200 bg-white px-4 py-2">1. Request access</li>
            <li className="rounded-lg border border-slate-200 bg-white px-4 py-2">2. License verification</li>
            <li className="rounded-lg border border-slate-200 bg-white px-4 py-2">3. Set up your profile</li>
            <li className="rounded-lg border border-slate-200 bg-white px-4 py-2">4. Connect with agents</li>
          </ol>
          <Link to="/request-access" className="mt-6 inline-flex rounded-full bg-[#0E56F5] px-6 py-3 font-semibold text-white hover:bg-[#0648db]">
            Request access
          </Link>
        </div>
      </div>
    </section>
  );
}
