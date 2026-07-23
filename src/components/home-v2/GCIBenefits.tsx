import React from "react";
import { GCI_GLOBE } from "./heroImages";

const features = [
  {
    icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    title: "Dedicated to client-focused service",
  },
  {
    icon: <><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></>,
    title: "Increased velocity and higher close rates",
  },
  {
    icon: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></>,
    title: "Buyer agents gain earlier access into inventory",
  },
  {
    icon: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
    title: "Meaningful increases in agent production",
  },
];

const GCIBenefits = () => {
  return (
    <section className="relative w-full bg-[#060b17] overflow-hidden">
      {/* Globe background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `image-set(url(${GCI_GLOBE.avif.src1800}) type("image/avif"), url(${GCI_GLOBE.webp.src1800}) type("image/webp"))`,
          backgroundSize: "118%",
          backgroundPosition: "center 38%",
          opacity: 0.92,
          filter: "brightness(1.45) contrast(1.25) saturate(1.3)",
        }}
      />
      {/* Arc glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 50% 52%, rgba(37,55,255,0.18) 0%, rgba(80,200,120,0.08) 45%, transparent 75%)" }}
      />
      {/* Top fade */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#060b17f0] via-[#060b1760] to-[#060b1790] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-24 flex flex-col items-center gap-16">
        {/* Headline + CTA */}
        <div className="flex flex-col items-center text-center gap-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 pl-3.5 pr-5 py-2 bg-white/10 border border-white/15 backdrop-blur-md rounded-full">
            <span className="h-2 w-2 rounded-full bg-[#50c878] shrink-0" />
            <span className="font-['Manrope'] font-medium text-white/90 text-[14px] tracking-[0.28px] leading-none">GCI driven by better intelligence</span>
          </div>
          <h2 className="font-['Manrope'] font-semibold text-white text-4xl md:text-6xl tracking-tight leading-[1.0]" style={{ textWrap: "balance" as any }}>
            More GCI through better intelligence and faster connections.
          </h2>
          <p className="font-['Manrope'] font-medium text-white/70 text-lg md:text-xl leading-relaxed max-w-2xl">
            All Agent Connect gives agents the intelligence edge to close more deals and grow GCI with verified peers across brokerages.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4 pt-2">
            <a
              href="/auth?mode=register&source=home_gci"
              className="h-14 px-8 inline-flex items-center gap-2 bg-[#50C878] rounded-full hover:bg-[#45b96d] transition-colors font-['Manrope'] font-semibold text-black text-base shadow-sm"
            >
              Request access
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>

        {/* 2×2 feature grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-12 max-w-3xl">
          {features.map((f, i) => (
            <div key={i} className="flex flex-col gap-3.5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.32)",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 14px 2px rgba(80,200,120,0.20), 0 2px 8px rgba(0,0,0,0.35)",
                  filter: "brightness(1.15)",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  {f.icon}
                </svg>
              </div>
              <p className="font-['Manrope'] font-bold text-white text-[15px] leading-[1.55]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>
                {f.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GCIBenefits;
