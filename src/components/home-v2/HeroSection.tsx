import React from "react";

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
      <div className="absolute top-1/3 left-0 w-[560px] h-[560px] rounded-full bg-[#2537ff] opacity-[0.07] blur-[140px] pointer-events-none" />

      {/* Nav spacer */}
      <div className="h-[83px] shrink-0" />

      {/* Hero content */}
      <div className="relative z-10 flex flex-col justify-center flex-1 px-6 lg:px-[100px] pt-20 pb-32 max-w-[1440px] mx-auto w-full">
        <div className="max-w-[580px] flex flex-col gap-6">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/5 border border-white/10 rounded-full w-fit">
            <span className="w-[7px] h-[7px] rounded-full bg-[#50c878] shrink-0" />
            <span className="font-['Manrope'] font-semibold text-white/80 text-sm tracking-[0.28px]">
              Verified Agent Network
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-['Manrope'] font-extrabold text-white text-[clamp(38px,4.8vw,64px)] tracking-[-2.5px] leading-[1.07]"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.35)" }}
          >
            The private network where agents share pre-market intelligence.
          </h1>

          {/* Sub-headline */}
          <p className="font-['Manrope'] font-medium text-white/50 text-[17px] leading-[1.75] tracking-[0.2px]">
            Share coming-soon listings, off-market inventory, and active buyer demand with verified agents before it goes public.
          </p>

          {/* CTA */}
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <button className="h-auto inline-flex items-center gap-3 pl-7 pr-6 py-[14px] bg-[#50c878] rounded-[90px] border-[5px] border-[#50c87866] hover:bg-[#3dba68] transition-colors font-['Manrope'] font-bold text-white text-[17px]">
              Request access
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
