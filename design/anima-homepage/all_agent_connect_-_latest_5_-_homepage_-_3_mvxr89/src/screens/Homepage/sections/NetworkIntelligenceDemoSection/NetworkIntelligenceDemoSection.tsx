import { Button } from "../../../../components/ui/button";

const features = [
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    title: "Dedicated to client-focused service",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
      </svg>
    ),
    title: "Increased velocity and higher close rates",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    ),
    title: "Buyer agents gain earlier access into inventory",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
      </svg>
    ),
    title: "Meaningful increases in agent production",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: "Built by agents, for agents",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    title: "Verified peer connections, and clearer paths to deals",
  },
];

export const NetworkIntelligenceDemoSection = (): JSX.Element => {
  return (
    <section className="relative w-full bg-[#060b17] overflow-hidden">
      {/* Globe / network background image — scaled up & shifted upward */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url(https://c.animaapp.com/mmm3cgevnH1M3s/img/mask-group.png)",
          backgroundSize: "118%",
          backgroundPosition: "center 38%",
          opacity: 0.92,
          filter: "brightness(1.45) contrast(1.25) saturate(1.3)",
        }}
      />
      {/* Arc glow layer — radial bloom around globe centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 55% at 50% 52%, rgba(37,55,255,0.18) 0%, rgba(80,200,120,0.08) 45%, transparent 75%)",
        }}
      />
      {/* Top fade so headline sits cleanly; reduced opacity so globe stays visible */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#060b17f0] via-[#060b1760] to-[#060b1790] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-28 flex flex-col items-center gap-20">

        {/* Top: headline + CTAs — centered */}
        <div className="flex flex-col items-center text-center gap-7 max-w-[680px]">
          <div className="inline-flex items-center gap-2 pl-3.5 pr-5 py-2 bg-[#ffffff0d] border border-[#ffffff20] rounded-full">
            <span className="w-[7px] h-[7px] rounded-full bg-[#50c878] shrink-0" />
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-[#ffffffcc] text-[14px] tracking-[0.28px]">GCI driven by better connections</span>
          </div>
          <h2 className="[font-family:'Manrope',Helvetica] font-extrabold text-white text-[clamp(28px,4vw,50px)] tracking-[-2px] leading-[1.18]">
            GCI driven by better<br />information and faster<br />connections.
          </h2>
          <p className="[font-family:'Manrope',Helvetica] font-medium text-[#ffffff80] text-[16px] leading-[1.7]">
            All Agent Connect gives agents the intelligence edge to close more deals and grow GCI with verified peers across brokerages.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4 pt-1">
            <Button className="h-auto inline-flex items-center gap-3 pl-7 pr-6 py-[14px] bg-[#50c878] rounded-[90px] border-[5px] border-[#50c87866] hover:bg-[#3dba68] transition-colors">
              <span className="[font-family:'Manrope',Helvetica] font-bold text-white text-[16px] whitespace-nowrap">Request access</span>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          </div>
        </div>

        {/* Bottom: 2×3 floating icon + text grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
          {features.map((f, i) => (
            <div key={i} className="flex flex-col gap-3.5">
              {/* Icon — brighter box with subtle glow */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.32)",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 14px 2px rgba(80,200,120,0.20), 0 2px 8px rgba(0,0,0,0.35)",
                  filter: "brightness(1.15)",
                }}
              >
                {f.icon}
              </div>
              {/* Text — pure white, slightly heavier */}
              <p className="[font-family:'Manrope',Helvetica] font-bold text-[#ffffff] text-[15px] leading-[1.55]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>
                {f.title}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
