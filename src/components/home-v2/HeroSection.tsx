import React from "react";
import AACMonogram from "@/components/ui/AACMonogram";

const HeroSection = () => {
  return (
    <section className="relative w-full min-h-screen bg-[#111317] overflow-hidden flex flex-col">
      {/* Background: full-bleed hero image */}
      <div className="absolute inset-0">
        <img
          src="https://c.animaapp.com/mmm3cgevnH1M3s/img/group-1707484446.png"
          alt="Real estate agents collaborating"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "55% center" }}
        />
      </div>

      {/* Blue glow accent */}
      <div className="absolute top-1/3 left-0 w-[560px] h-[560px] rounded-full bg-aac opacity-[0.07] blur-[140px] pointer-events-none" />

      {/* Top access row */}
      <div className="relative z-10 flex items-baseline justify-between w-full max-w-[1440px] mx-auto px-6 lg:px-[100px] pt-12 mb-12">
        <div className="flex items-center gap-2.5">
          <AACMonogram className="w-8 h-8 text-[#50c878] relative top-[1px]" />
          <span className="font-['Manrope'] font-semibold text-white text-lg tracking-[-0.4px] whitespace-nowrap">
            All Agent Connect
          </span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="/auth?mode=register"
            className="font-['Manrope'] font-semibold text-white text-[13px] bg-[#50c878] hover:bg-[#3dba68] transition-colors px-[14px] py-[6px] rounded-full"
          >
            Request Access
          </a>
          <a href="/auth" className="font-['Manrope'] font-medium text-white/80 text-sm hover:text-white transition-colors">
            Sign in
          </a>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex flex-col justify-center flex-1 px-6 lg:px-[100px] pt-20 pb-32 max-w-[1440px] mx-auto w-full">
        <div className="max-w-[580px] flex flex-col">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/5 border border-white/10 rounded-full w-fit mt-4">
            <span className="w-[7px] h-[7px] rounded-full bg-[#50c878] shrink-0" />
            <span className="font-['Manrope'] font-semibold text-white/80 text-sm tracking-[0.28px]">
              Verified Agent Network
            </span>
          </div>

          {/* Headline */}
          <h1
            className="mt-6 font-['Manrope'] font-extrabold text-white text-[clamp(38px,4.8vw,64px)] tracking-[-2.5px] leading-[1.07]"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.35)" }}
          >
            The private network where agents share pre-market intelligence.
          </h1>

          {/* Sub-headline */}
          <p className="mt-5 font-['Manrope'] font-medium text-white/50 text-[17px] leading-[1.75] tracking-[0.2px]">
            Share coming-soon listings, off-market inventory, and active buyer demand with verified agents before it goes public.
          </p>

          {/* CTA */}
          <div className="flex items-center gap-4 mt-8 flex-wrap">
            <button className="h-auto inline-flex items-center gap-2.5 px-[20px] py-[11px] bg-[#50c878] rounded-[90px] border-[5px] border-[#50c87866] hover:bg-[#3dba68] transition-colors font-['Manrope'] font-bold text-white text-base">
              Request access
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
