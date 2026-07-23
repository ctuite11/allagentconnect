import React from "react";
import { TILES } from "./heroImages";

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect width="16" height="16" rx="4" fill="#2537ff" fillOpacity="0.12" />
    <path d="M4.5 8L7 10.5L11.5 5.5" stroke="#2537ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const leftTags = ["No Days On Market", "Highest ROI", "Verified Agents"];
const rightTags = ["Pre-market data", "Agent controlled info, privacy and discretion", "Increased velocity and higher close rates"];

const ScalePersistence = () => {
  return (
    <section className="w-full bg-white py-20 md:py-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto flex flex-col gap-14">
        {/* Header */}
        <div className="flex flex-col items-center gap-6 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 pl-3.5 pr-5 py-2 bg-[#2537ff0f] border border-[#2537ff26] rounded-full">
            <span className="font-['Manrope'] font-semibold text-[#2537ff] text-[14px] tracking-[0.3px]">Why choose All Agent Connect</span>
          </div>
          <h2 className="font-['Manrope'] font-semibold text-[#292d32] text-4xl md:text-6xl tracking-tight leading-[1.0]" style={{ textWrap: "balance" as any }}>
            Deliberately designed<br />for scale and persistence
          </h2>
          <p className="font-['Manrope'] font-medium text-[#6b7280] text-lg md:text-xl leading-relaxed max-w-2xl">
            All Agent Connect is designed for scale and persistence: intelligence compounds, participation creates leverage, and network activity becomes visible and actionable.
          </p>
        </div>

        {/* Two column cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left card */}
          <div className="relative rounded-3xl overflow-hidden bg-[#111317] h-[520px] hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <img src={TILES.m1.url} alt="Property" width={800} height={520} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
            <div className="relative z-10 p-8 flex flex-col justify-between h-full">
              <h3 className="font-['Manrope'] font-semibold text-white text-3xl leading-tight max-w-[320px]">
                By Agents. For Agents.<br />Coming soon, Off Market,<br />and Client need intel.
              </h3>
              <div className="flex flex-col gap-3">
                {leftTags.slice(0, 2).map((tag) => (
                  <div key={tag} className="inline-flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.14)] w-fit">
                    <CheckIcon />
                    <span className="font-['Manrope'] font-semibold text-[#111317] text-[14px] leading-none">{tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right card */}
          <div className="relative rounded-3xl overflow-hidden bg-[#111317] h-[520px] hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <img src={TILES.m2.url} alt="Tech network" width={800} height={520} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
            <div className="relative z-10 p-8 flex flex-col justify-between h-full">
              <h3 className="font-['Manrope'] font-semibold text-white text-3xl leading-tight max-w-[320px]">
                Intel that creates real<br />demand and real results
              </h3>
              <div className="flex flex-col gap-3 items-end">
                {rightTags.slice(0, 2).map((tag) => (
                  <div key={tag} className="inline-flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.14)]">
                    <CheckIcon />
                    <span className="font-['Manrope'] font-semibold text-[#111317] text-[14px] leading-none">{tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScalePersistence;
