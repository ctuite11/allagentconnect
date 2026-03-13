import React from "react";
import { AAC_BLUE } from "@/lib/brandColors";

const HowAgentsUseAAC = () => {
  return (
    <section className="w-full py-28 px-6 relative bg-white">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-14">
        {/* Header */}
        <div className="flex flex-col items-center gap-5 text-center max-w-[600px] mx-auto">
          <div className="inline-flex items-center gap-2 pl-3.5 pr-5 py-2 bg-[#0E56F50f] border border-[#0E56F526] rounded-full">
            <span className="font-['Manrope'] font-semibold text-[14px] tracking-[0.28px]" style={{ color: AAC_BLUE }}>How agents use the platform</span>
          </div>
          <h2 className="font-['Manrope'] font-bold text-[#0f172a] text-[clamp(30px,4vw,46px)] tracking-[-1.5px] leading-[1.18]">
            How agents are using<br />All Agent Connect
          </h2>
        </div>

        {/* Three cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1 — Discover */}
          <div className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-[0_2px_20px_rgba(15,23,42,0.07)] border border-[#e2e8f0]">
            <div className="flex flex-col justify-center bg-[#f8fafc] px-5 py-4 overflow-hidden" style={{ minHeight: 260 }}>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "Filter by property", icon: <path d="M3 6h18M7 12h10M11 18h2" stroke="#64748b" strokeWidth="2" strokeLinecap="round" /> },
                  { label: "Search by type", icon: <><circle cx="11" cy="11" r="8" stroke="#64748b" strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke="#64748b" strokeWidth="2" strokeLinecap="round" /></> },
                  { label: "Sort by date", icon: <><rect x="3" y="4" width="18" height="18" rx="2" stroke="#64748b" strokeWidth="2" /><path d="M3 9h18M8 2v4M16 2v4" stroke="#64748b" strokeWidth="2" strokeLinecap="round" /></> },
                  { label: "Group by status", icon: <><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#64748b" strokeWidth="2" /><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="#64748b" strokeWidth="2" /><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="#64748b" strokeWidth="2" /><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="#64748b" strokeWidth="2" /></> },
                ].map((row, i) => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#e2e8f0]" style={{ opacity: i === 3 ? 0.55 : 1 }}>
                    <span className="font-['Manrope'] font-medium text-[#0f172a] text-[13px]">{row.label}</span>
                    <div className="flex items-center gap-1.5 text-[#94a3b8]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">{row.icon}</svg>
                      <span className="w-1 h-1 rounded-full bg-[#cbd5e1]" />
                      <span className="w-1 h-1 rounded-full bg-[#cbd5e1]" />
                      <span className="w-1 h-1 rounded-full bg-[#cbd5e1]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2.5 p-5">
              <h3 className="font-['Manrope'] font-bold text-[#0f172a] text-[17px] leading-[1.3]">Discover opportunities</h3>
              <p className="font-['Manrope'] font-medium text-[#64748b] text-[13px] leading-[1.65]">Structured, searchable listings matching private listings with buyer and renter needs.</p>
            </div>
          </div>

          {/* Card 2 — Share inventory */}
          <div className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-[0_2px_20px_rgba(15,23,42,0.07)] border border-[#e2e8f0]">
            <div className="relative flex flex-col items-center justify-center bg-[#f8fafc] px-5 pt-7 pb-6 overflow-hidden" style={{ minHeight: 260 }}>
              <div className="relative w-full flex justify-center items-end gap-2 mb-5" style={{ height: 120 }}>
                <div className="relative rounded-xl overflow-hidden shadow-md shrink-0" style={{ width: 80, height: 100 }}>
                  <img src="https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=200&q=80" alt="Property" className="w-full h-full object-cover" />
                </div>
                <div className="relative rounded-xl overflow-hidden shadow-lg shrink-0 z-10" style={{ width: 95, height: 120 }}>
                  <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=200&q=80" alt="Property" className="w-full h-full object-cover" />
                </div>
                <div className="relative rounded-xl overflow-hidden shadow-md shrink-0" style={{ width: 80, height: 100 }}>
                  <img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=200&q=80" alt="Property" className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-full shadow-sm border border-[#e2e8f0]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(14,86,245,0.08)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" stroke={AAC_BLUE} strokeWidth="2" /><path d="M2 8l10 6 10-6" stroke={AAC_BLUE} strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                    <span className="font-['Manrope'] font-semibold text-[#0f172a] text-[12px]">Share via email</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-full shadow-sm" style={{ backgroundColor: AAC_BLUE }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="white" strokeWidth="2" strokeLinecap="round" /><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                    <span className="font-['Manrope'] font-semibold text-white text-[12px]">Share with agents</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-full shadow-sm border border-[#e2e8f0]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-[#fff7ed] flex items-center justify-center shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke="#f97316" strokeWidth="2" /><circle cx="6" cy="12" r="3" stroke="#f97316" strokeWidth="2" /><circle cx="18" cy="19" r="3" stroke="#f97316" strokeWidth="2" /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="#f97316" strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                    <span className="font-['Manrope'] font-semibold text-[#0f172a] text-[12px]">Share across social media</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 p-5">
              <h3 className="font-['Manrope'] font-bold text-[#0f172a] text-[17px] leading-[1.3]">Share inventory</h3>
              <p className="font-['Manrope'] font-medium text-[#64748b] text-[13px] leading-[1.65]">Verified agents share off-market and coming-soon opportunities inside the network.</p>
            </div>
          </div>

          {/* Card 3 — Collaborate */}
          <div className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-[0_2px_20px_rgba(15,23,42,0.07)] border border-[#e2e8f0]">
            <div className="relative flex items-center justify-center bg-[#f8fafc] overflow-hidden" style={{ minHeight: 260, paddingTop: 28, paddingBottom: 24 }}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 340 260" preserveAspectRatio="xMidYMid meet">
                <path d="M170 148 Q130 118 90 88" stroke="#cbd5e1" strokeWidth="1.5" fill="none" strokeDasharray="5 4" />
                <path d="M170 148 Q210 118 262 82" stroke="#cbd5e1" strokeWidth="1.5" fill="none" strokeDasharray="5 4" />
                <path d="M170 148 Q140 170 86 196" stroke="#cbd5e1" strokeWidth="1.5" fill="none" strokeDasharray="5 4" />
                <path d="M170 148 Q220 170 292 198" stroke="#cbd5e1" strokeWidth="1.5" fill="none" strokeDasharray="5 4" />
                <path d="M170 148 Q215 148 262 148" stroke="#cbd5e1" strokeWidth="1.5" fill="none" strokeDasharray="5 4" />
              </svg>
              <div className="relative z-10 w-[72px] h-[72px] rounded-full overflow-hidden border-[3px] border-white shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="Agent" className="w-full h-full object-cover" />
              </div>
              {[
                { src: "https://randomuser.me/api/portraits/men/32.jpg", size: 52, top: "18%", left: "14%" },
                { src: "https://randomuser.me/api/portraits/men/75.jpg", size: 56, top: "16%", right: "16%" },
                { src: "https://randomuser.me/api/portraits/women/68.jpg", size: 48, bottom: "12%", left: "16%" },
                { src: "https://randomuser.me/api/portraits/men/52.jpg", size: 52, bottom: "10%", right: "10%" },
                { src: "https://randomuser.me/api/portraits/women/29.jpg", size: 44, top: "46%", right: "7%" },
              ].map((a, i) => (
                <div
                  key={i}
                  className="absolute rounded-full overflow-hidden border-[2.5px] border-white shadow-md"
                  style={{ width: a.size, height: a.size, top: a.top, left: a.left, bottom: a.bottom, right: a.right }}
                />
              ))}
              {[
                { src: "https://randomuser.me/api/portraits/men/32.jpg", size: 52, top: "18%", left: "14%" },
                { src: "https://randomuser.me/api/portraits/men/75.jpg", size: 56, top: "16%", right: "16%" },
                { src: "https://randomuser.me/api/portraits/women/68.jpg", size: 48, bottom: "12%", left: "16%" },
                { src: "https://randomuser.me/api/portraits/men/52.jpg", size: 52, bottom: "10%", right: "10%" },
                { src: "https://randomuser.me/api/portraits/women/29.jpg", size: 44, top: "46%", right: "7%" },
              ].map((a, i) => (
                <div
                  key={`avatar-${i}`}
                  className="absolute rounded-full overflow-hidden border-[2.5px] border-white shadow-md"
                  style={{ width: a.size, height: a.size, top: a.top, left: a.left, bottom: a.bottom, right: a.right }}
                >
                  <img src={a.src} alt="Agent" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 p-5">
              <h3 className="font-['Manrope'] font-bold text-[#0f172a] text-[17px] leading-[1.3]">Collaborate</h3>
              <p className="font-['Manrope'] font-medium text-[#64748b] text-[13px] leading-[1.65]">Direct agent-to-agent coordination without public posts, email chains, or group noise.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowAgentsUseAAC;
