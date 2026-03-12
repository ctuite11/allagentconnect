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
    <section className="w-full bg-white flex flex-col items-center overflow-hidden">
      {/* CTA block */}
      <div className="w-full flex flex-col items-center gap-10 py-32 px-6">
        <div className="flex flex-col items-center gap-7 max-w-[720px] text-center">
          <h2 className="font-['Manrope'] font-extrabold text-[#292d32] text-[clamp(32px,5vw,60px)] tracking-[-2.5px] leading-[1.15]">
            See the Market Before<br className="hidden sm:block" /> it Happens.
          </h2>
          <p className="font-['Manrope'] font-medium text-[#40424d] text-[17px] leading-[1.7] max-w-[540px]">
            Build your professional profile to access exclusive network data and see the deals others are missing.
          </p>
          <button className="h-auto inline-flex items-center gap-3 pl-7 pr-6 py-[14px] bg-[#2537ff] rounded-[90px] border-[5px] border-[#2537ff40] hover:bg-[#1e2fd4] transition-colors font-['Manrope'] font-bold text-white text-[17px]">
            Request access
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 5l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Marquee trust strip */}
      <div className="w-full border-t border-b border-[#e8eaf0] bg-[#f8f9fc] py-5 overflow-hidden">
        <div className="flex items-center w-max homepage-v2-marquee">
          {allItems.map((item, i) => (
            <div key={i} className="flex items-center shrink-0 gap-10 pr-10">
              <span className="font-['Manrope'] font-semibold text-[#292d32] text-[16px] whitespace-nowrap">{item}</span>
              <span className="text-[#c0c8d8] text-[18px] leading-none shrink-0">✦</span>
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
