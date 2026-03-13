import React from "react";

const NetworkIntelligence = () => {
  return (
    <section className="w-full bg-white flex flex-col items-center pt-28 pb-0 px-6">
      {/* Section label pill */}
      <div className="mb-6 inline-flex items-center gap-2 pl-3.5 pr-5 py-2 bg-[#2537ff0f] border border-[#2537ff26] rounded-full">
        <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-chart-1.svg" alt="" className="w-4 h-4 shrink-0" />
        <span className="font-['Manrope'] font-semibold text-[#2537ff] text-[14px] tracking-[0.28px]">Our network values</span>
      </div>

      {/* Headline + sub */}
      <div className="flex flex-col items-center gap-4 mb-12 max-w-[820px] w-full text-center">
        <h2 className="font-['Manrope'] font-bold text-[#292d32] text-[clamp(30px,3.8vw,52px)] tracking-[-2px] leading-[1.18]">
          Operate on network intelligence,<br className="hidden sm:block" /> not the public feed.
        </h2>
        <p className="font-['Manrope'] font-medium text-[#40424d] text-[17px] leading-[1.7] max-w-[540px]">
          Your centralized workspace for managing coming-soon listings, private inventory, and active buyer and renter needs.
        </p>
      </div>

      {/* Dashboard mockup + value badges */}
      <div className="relative w-full max-w-[1260px] flex items-center justify-center">
        {/* Left property card */}
        <div className="hidden xl:block absolute left-0 z-20 w-[240px] rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.18)]" style={{ top: "50%", transform: "translateY(-55%)" }}>
          <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/mask-group-4.png" alt="Property" className="w-full h-auto block" />
        </div>

        {/* Right property card */}
        <div className="hidden xl:block absolute right-0 z-20 w-[240px] rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.18)]" style={{ top: "50%", transform: "translateY(-55%)" }}>
          <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/mask-group-5.png" alt="Property" className="w-full h-auto block" />
        </div>

        {/* Dashboard image */}
        <div className="relative z-10 w-full max-w-[900px] mx-auto">
          <div className="rounded-[28px] border-[10px] border-[#292d32] shadow-[0_32px_80px_rgba(41,45,50,0.22)] overflow-hidden">
            <img
              src="https://c.animaapp.com/mmm3cgevnH1M3s/img/mask-group-3.png"
              alt="Platform dashboard"
              className="w-full h-auto block"
            />
          </div>

          {/* Desktop floating badges */}
          <div
            className="hidden md:flex absolute z-30 items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
            style={{ top: "10%", left: "0%", transform: "translateX(-52%)" }}
          >
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-shield-tick.svg" alt="" className="w-[18px] h-[18px] shrink-0" />
            <span className="font-['Manrope'] font-semibold text-[#292d32] text-[13px] leading-[1.4] whitespace-nowrap">For those clients looking for privacy</span>
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
            className="hidden md:flex absolute z-30 items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
            style={{ top: "60%", right: "4%", transform: "translateX(52%)" }}
          >
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-star.svg" alt="" className="w-[18px] h-[18px] shrink-0" />
            <span className="font-['Manrope'] font-semibold text-[#292d32] text-[13px] leading-[1.4] whitespace-nowrap">Direct seller + buyer-agent opportunities</span>
          </div>
        </div>
      </div>

      {/* Mobile badge grid */}
      <div className="md:hidden w-full max-w-[900px] mx-auto mt-6 grid grid-cols-2 gap-3 px-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-[0_4px_16px_rgba(41,45,50,0.16)]">
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-shield-tick.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="font-['Manrope'] font-semibold text-[#292d32] text-[12px] leading-[1.4]">For those clients looking for privacy</span>
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
          <div className="flex items-center gap-2.5 bg-white rounded-full px-4 py-2.5 shadow-[0_4px_16px_rgba(41,45,50,0.16)]">
            <img src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-star.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="font-['Manrope'] font-semibold text-[#292d32] text-[12px] leading-[1.4]">Direct seller + buyer-agent opportunities</span>
          </div>
        </div>
      </div>

      {/* Property listing cards row */}
      <div className="w-full max-w-[1080px] mx-auto mt-20 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { image: "https://c.animaapp.com/mmm3cgevnH1M3s/img/mask-group-7.png", label: "Off-Market listing", price: "$4,000,000", dot: "#2537ff" },
            { image: "https://c.animaapp.com/mmm3cgevnH1M3s/img/mask-group-8.png", label: "Coming soon", price: "$2,450,000", dot: "#fac022" },
            { image: "https://c.animaapp.com/mmm3cgevnH1M3s/img/mask-group-9.png", label: "Active", price: "$999,000", dot: "#50c878" },
            { image: "https://c.animaapp.com/mmm3cgevnH1M3s/img/mask-group-10.png", label: "Sold Off-Market", price: "$3,500,000", dot: "#ff6b56" },
          ].map((card) => (
            <div key={card.label} className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "350/365" }}>
              <img src={card.image} alt={card.label} className="absolute inset-0 w-full h-full object-cover" />
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
