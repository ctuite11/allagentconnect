import React from "react";
import { TILES } from "./heroImages";

const NetworkIntelligence = () => {
  return (
    <section className="w-full bg-white flex flex-col items-center py-20 md:py-24 px-6">
      {/* Section label pill */}
      <div className="mb-6 inline-flex items-center gap-2 pl-3.5 pr-5 py-2 bg-[#2537ff0f] border border-[#2537ff26] rounded-full">
        <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-chart-1.svg" alt="" className="w-4 h-4 shrink-0" />
        <span className="font-['Manrope'] font-semibold text-[#2537ff] text-[14px] tracking-[0.28px]">Our network values</span>
      </div>

      {/* Headline + sub */}
      <div className="flex flex-col items-center gap-5 mb-12 max-w-4xl w-full text-center">
        <h2 className="font-['Manrope'] font-semibold text-[#292d32] text-4xl md:text-6xl tracking-tight leading-[1.0]" style={{ textWrap: "balance" as any }}>
          Operate on network intelligence,<br className="hidden sm:block" /> not the public feed.
        </h2>
        <p className="font-['Manrope'] font-medium text-[#40424d] text-lg md:text-xl leading-relaxed max-w-2xl">
          Your centralized workspace for managing coming-soon listings, private inventory, and active buyer and renter needs.
        </p>
      </div>

      {/* Dashboard mockup + value badges */}
      <div className="relative w-full max-w-[1260px] flex items-center justify-center">
        {/* Left property card */}
        <div className="hidden xl:block absolute left-0 z-20 w-[240px] rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.18)]" style={{ top: "50%", transform: "translateY(-55%)" }}>
          <img src={TILES.m4.url} alt="Property" width={480} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
        </div>

        {/* Right property card */}
        <div className="hidden xl:block absolute right-0 z-20 w-[240px] rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.18)]" style={{ top: "50%", transform: "translateY(-55%)" }}>
          <img src={TILES.m5.url} alt="Property" width={480} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
        </div>

        {/* Dashboard image */}
        <div className="relative z-10 w-full max-w-[900px] mx-auto">
          <div className="rounded-[28px] border-[10px] border-[#1a1d22] shadow-[0_48px_120px_rgba(15,23,42,0.38),0_16px_40px_rgba(15,23,42,0.18)] overflow-hidden">
            <img
                src={TILES.m3.url}
                alt="Platform dashboard"
                width={1800}
                height={1080}
                loading="lazy"
                decoding="async"
                className="w-full h-auto block"
                style={{ filter: "contrast(1.15) saturate(1.05)" }}
              />
          </div>

          {/* Desktop floating badges */}
          <div
            className="hidden md:flex absolute z-30 items-center gap-2.5 bg-white/90 backdrop-blur-md border border-white/60 rounded-full px-4 py-2.5 shadow-xl"
            style={{ top: "10%", left: "0%", transform: "translateX(-52%)" }}
          >
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-shield-tick.svg" alt="" className="w-[18px] h-[18px] shrink-0" />
            <span className="font-['Manrope'] font-semibold text-slate-900 text-[13px] leading-[1.4] whitespace-nowrap">For those clients looking for privacy</span>
          </div>

          <div
            className="hidden md:flex absolute z-30 items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
            style={{ top: "60%", left: "0%", transform: "translateX(-52%)" }}
          >
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-chart-1.svg" alt="" className="w-[18px] h-[18px] shrink-0" />
            <span className="font-['Manrope'] font-semibold text-[#292d32] text-[13px] leading-[1.4] whitespace-nowrap">Increased agent production / GCI</span>
          </div>

          <div
            className="hidden md:flex absolute z-30 items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
            style={{ top: "10%", right: "0%", transform: "translateX(52%)" }}
          >
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-archive-tick.svg" alt="" className="w-[18px] h-[18px] shrink-0" />
            <span className="font-['Manrope'] font-semibold text-[#292d32] text-[13px] leading-[1.4] whitespace-nowrap">Access the Unlisted</span>
          </div>

          <div
            className="hidden md:flex absolute z-30 items-center gap-2.5 bg-white/90 backdrop-blur-md border border-white/60 rounded-full px-4 py-2.5 shadow-xl"
            style={{ top: "60%", right: "4%", transform: "translateX(52%)" }}
          >
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-star.svg" alt="" className="w-[18px] h-[18px] shrink-0" />
            <span className="font-['Manrope'] font-semibold text-slate-900 text-[13px] leading-[1.4] whitespace-nowrap">Direct seller + buyer-agent opportunities</span>
          </div>
        </div>
      </div>

      {/* Mobile badge grid */}
      <div className="md:hidden w-full max-w-[900px] mx-auto mt-6 grid grid-cols-2 gap-3 px-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 bg-white/90 backdrop-blur-md border border-white/60 rounded-full px-4 py-2.5 shadow-xl">
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-shield-tick.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="font-['Manrope'] font-semibold text-slate-900 text-[12px] leading-[1.4]">For those clients looking for privacy</span>
          </div>
          <div className="flex items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-[0_4px_16px_rgba(41,45,50,0.16)]">
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-chart-1.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="font-['Manrope'] font-semibold text-[#292d32] text-[12px] leading-[1.4]">Increased agent production / GCI</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-[0_4px_16px_rgba(41,45,50,0.16)]">
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-archive-tick.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="font-['Manrope'] font-semibold text-[#292d32] text-[12px] leading-[1.4]">Access the Unlisted</span>
          </div>
          <div className="flex items-center gap-2.5 bg-white/90 backdrop-blur-md border border-white/60 rounded-full px-4 py-2.5 shadow-xl">
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-star.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="font-['Manrope'] font-semibold text-slate-900 text-[12px] leading-[1.4]">Direct seller + buyer-agent opportunities</span>
          </div>
        </div>
      </div>

      {/* Property listing cards row */}
      <div className="w-full max-w-[1080px] mx-auto mt-20 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { tile: TILES.m7, label: "Off-Market listing", price: "$4,000,000", dot: "#2537ff" },
            { tile: TILES.m8, label: "Coming soon", price: "$2,450,000", dot: "#fac022" },
            { tile: TILES.m9, label: "Active", price: "$999,000", dot: "#50c878" },
            { tile: TILES.m10, label: "Sold Off-Market", price: "$3,500,000", dot: "#ff6b56" },
          ].map((card) => (
            <div key={card.label} className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "350/365" }}>
              <img src={card.tile.url} alt={card.label} width={350} height={365} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute top-3 left-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: card.dot }} />
                  <span className="font-['Manrope'] font-semibold text-[#292d32] text-[12px] tracking-[0.2px] whitespace-nowrap">{card.label}</span>
                </div>
              </div>
              <div className="absolute bottom-5 left-5">
                <span className="font-['Manrope'] font-semibold text-white text-[16px] tracking-[0.16px]">{card.price}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NetworkIntelligence;
