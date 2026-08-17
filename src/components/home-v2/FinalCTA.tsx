import React from "react";

const marqueeItems = [
  "Professional specialists are available to serve",
  "Thousands of agents. One common goal: Success.",
  "Agent-focused. Results-driven.",
  "Real Estate Intelligence: Proven Since 2016.",
  "More than 50\u00a0companies joined the hands",
  "Specialization over generalization.",
];

const FinalCTA = () => {
  const allItems = [...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems];

  return (
    <section className="w-full bg-[#070708] flex flex-col items-center overflow-hidden">
      {/* Dark premium CTA block */}
      <div className="w-full flex flex-col items-center gap-8 py-24 md:py-28 px-6">
        <div className="flex flex-col items-center gap-6 max-w-3xl text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/10 border border-white/15 backdrop-blur-md rounded-full">
            <span className="w-[7px] h-[7px] rounded-full bg-[#50c878] shrink-0" />
            <span className="font-['Manrope'] font-medium text-white/90 text-sm tracking-[0.28px]">
              Verified Agent Network
            </span>
          </div>

          <h2
            className="font-['Manrope'] font-semibold text-white text-4xl md:text-6xl tracking-tight leading-[1.0]"
            style={{ textWrap: "balance" as any }}
          >
            See deals before they reach the public feed.
          </h2>
          <p className="font-['Manrope'] font-medium text-white/70 text-lg md:text-xl leading-relaxed max-w-2xl">
            Join licensed professionals sharing inventory, buyer demand, and real opportunity.
          </p>
          <a
            href="/request-access"
            className="mt-2 h-14 px-8 inline-flex items-center gap-2 bg-[#50C878] rounded-full hover:bg-[#45b96d] transition-colors font-['Manrope'] font-semibold text-black text-base shadow-sm"
          >
            Request access
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>

      {/* Marquee trust strip */}
      <div className="w-full border-t border-white/10 bg-[#0b0b0d] py-5 overflow-hidden">
        <div className="flex items-center w-max homepage-v2-marquee">
          {allItems.map((item, i) => (
            <div key={i} className="flex items-center shrink-0 gap-10 pr-10">
              <span className="font-['Manrope'] font-medium text-white/70 text-[15px] whitespace-nowrap">{item}</span>
              <span className="text-white/25 text-[18px] leading-none shrink-0">✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* Homepage-scoped marquee animation */}
      <style>{`
        @keyframes homepageV2Marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .homepage-v2-marquee {
          animation: homepageV2Marquee 52s linear infinite;
        }
      `}</style>
    </section>
  );
};

export default FinalCTA;
