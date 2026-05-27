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
      <div className="relative z-10 flex items-center justify-between w-full max-w-[1440px] mx-auto px-6 lg:px-[100px] py-5">
        <div className="flex items-center gap-1.5">
          <AACMonogram className="w-8 h-8 text-[#50c878]" />
          <span className="font-['Manrope'] font-semibold text-white text-lg tracking-[-0.4px] whitespace-nowrap">
            All Agent Connect
          </span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="/auth?mode=register"
            className="font-['Manrope'] font-semibold text-white bg-transparent border border-white/40 hover:bg-white/10 hover:border-white/70 transition-colors h-11 px-6 rounded-full inline-flex items-center text-sm"
          >
            Request Access
          </a>
          <a href="/auth" className="font-['Manrope'] font-medium text-white/85 hover:text-white text-sm transition-colors">
            Sign in
          </a>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex flex-col justify-center flex-1 w-full max-w-[1440px] mx-auto py-28 md:py-32" style={{ transform: "translateY(-30px)" }}>
        <div className="max-w-[580px] ml-8 md:ml-16 lg:ml-24 flex flex-col">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/10 border border-white/15 backdrop-blur-md rounded-full w-fit">
            <span className="w-[7px] h-[7px] rounded-full bg-[#50c878] shrink-0" />
            <span className="font-['Manrope'] font-medium text-white/90 text-sm tracking-[0.28px]">
              Verified Agent Network
            </span>
          </div>

          {/* Headline */}
          <h1
            className="mt-6 font-['Manrope'] font-semibold text-white text-4xl md:text-5xl tracking-tight leading-[1.05]"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.35)", textWrap: "balance" as any }}
          >
            The private network where agents share pre-market intelligence.
          </h1>

          {/* Sub-headline */}
          <p className="mt-5 font-['Manrope'] font-medium text-white/70 text-lg md:text-xl leading-relaxed max-w-2xl">
            Share coming-soon listings, off-market inventory, and active buyer demand with verified agents before it goes public.
          </p>

          {/* CTA */}
          <div className="flex items-center gap-4 mt-8 flex-wrap">
            <a
              href="/auth?mode=register"
              className="h-14 px-8 inline-flex items-center gap-2 bg-[#50C878] rounded-full hover:bg-[#45b96d] transition-colors font-['Manrope'] font-semibold text-black text-base shadow-sm"
            >
              Request access
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
