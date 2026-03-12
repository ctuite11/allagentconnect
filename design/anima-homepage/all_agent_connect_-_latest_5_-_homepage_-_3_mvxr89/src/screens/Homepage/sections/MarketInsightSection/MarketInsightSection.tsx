import { Button } from "../../../../components/ui/button";

const marqueeItems = [
  "Professional specialists are available to serve",
  "Thousands of agents. One common goal: Success.",
  "Agent-focused. Results-driven.",
  "Real Estate Intelligence: Proven Since 2016.",
  "More than 50\u00a0companies joined the hands",
  "Specialization over generalization.",
];

export const MarketInsightSection = (): JSX.Element => {
  const allItems = [...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems];

  return (
    <section className="w-full bg-white flex flex-col items-center overflow-hidden">

      {/* CTA block */}
      <div className="w-full flex flex-col items-center gap-10 py-32 px-6">
        <div className="flex flex-col items-center gap-7 max-w-[720px] text-center">
          <h2 className="[font-family:'Manrope',Helvetica] font-extrabold text-[#292d32] text-[clamp(32px,5vw,60px)] tracking-[-2.5px] leading-[1.15]">
            See the Market Before<br className="hidden sm:block" /> it Happens.
          </h2>
          <p className="[font-family:'Manrope',Helvetica] font-medium text-[#40424d] text-[17px] leading-[1.7] max-w-[540px]">
            Build your professional profile to access exclusive network data and see the deals others are missing.
          </p>
          <Button className="h-auto inline-flex items-center gap-3 pl-7 pr-6 py-[14px] bg-[#2537ff] rounded-[90px] border-[5px] border-[#2537ff40] hover:bg-[#1e2fd4] transition-colors">
            <span className="[font-family:'Manrope',Helvetica] font-bold text-white text-[17px] whitespace-nowrap">Request access</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 5l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Button>
        </div>
      </div>

      {/* Marquee trust strip — continuously looping */}
      <div className="w-full border-t border-b border-[#e8eaf0] bg-[#f8f9fc] py-5 overflow-hidden">
        <div
          className="flex items-center w-max animate-marquee"
          style={{ "--duration": "52s" } as React.CSSProperties}
        >
          {allItems.map((item, i) => (
            <div key={i} className="flex items-center shrink-0" style={{ gap: "2.5rem", paddingRight: "2.5rem" }}>
              <span className="[font-family:'Manrope',Helvetica] font-semibold text-[#292d32] text-[16px] whitespace-nowrap">{item}</span>
              <span className="text-[#c0c8d8] text-[18px] leading-none shrink-0">✦</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
