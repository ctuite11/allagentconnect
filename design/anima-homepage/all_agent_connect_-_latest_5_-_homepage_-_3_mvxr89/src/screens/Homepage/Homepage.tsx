import { useState, useEffect } from "react";
import { AgentUsageSection } from "./sections/AgentUsageSection/AgentUsageSection";
import { FeaturesOverviewSection } from "./sections/FeaturesOverviewSection/FeaturesOverviewSection";
import { FooterSection } from "./sections/FooterSection";
import { HeroSection } from "./sections/HeroSection";
import { MarketInsightSection } from "./sections/MarketInsightSection/MarketInsightSection";
import { NetworkIntelligenceDemoSection } from "./sections/NetworkIntelligenceDemoSection/NetworkIntelligenceDemoSection";
import { RealResultsVisualizationSection } from "./sections/RealResultsVisualizationSection";
import { ScaleAndPersistenceSection } from "./sections/ScaleAndPersistenceSection/ScaleAndPersistenceSection";
import { Button } from "../../components/ui/button";

const navLinks = [
  { label: "Network values" },
  { label: "For agents" },
  { label: "How it works" },
  { label: "Contact us" },
];

// ─── Hamburger icon (animated to X) ──────────────────────────────────────────
const HamburgerIcon = ({ open }: { open: boolean }) => (
  <div className="w-6 h-5 flex flex-col justify-between cursor-pointer" aria-label={open ? "Close menu" : "Open menu"}>
    <span className={`block h-[2px] w-full bg-white rounded-full transition-all duration-300 origin-top-left ${open ? "rotate-45 translate-x-[3px] -translate-y-[1px]" : ""}`} />
    <span className={`block h-[2px] bg-white rounded-full transition-all duration-300 ${open ? "w-0 opacity-0" : "w-full opacity-100"}`} />
    <span className={`block h-[2px] w-full bg-white rounded-full transition-all duration-300 origin-bottom-left ${open ? "-rotate-45 translate-x-[3px] translate-y-[1px]" : ""}`} />
  </div>
);

export const Homepage = (): JSX.Element => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Close drawer on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setDrawerOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="bg-white overflow-x-hidden w-full relative flex flex-col">
      {/* ─── Fixed Navigation ─── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(1210px,calc(100vw-32px))] flex justify-between items-center bg-[#292d32] rounded-[90px] border border-[#ffffff1a] px-6 h-[67px]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img className="w-[34px] h-[34px]" alt="Logo" src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-command.svg" />
          <span className="font-extrabold text-white text-xl tracking-[-0.8px] [font-family:'Manrope',Helvetica] whitespace-nowrap">
            All Agent Connect
          </span>
        </div>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-10">
          {navLinks.map((l) => (
            <a key={l.label} href="#" className="[font-family:'Manrope',Helvetica] font-semibold text-white text-base hover:opacity-75 transition-opacity whitespace-nowrap">
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          <Button className="h-auto px-[17px] py-3 bg-[#2537ff] rounded-[90px] border border-[#1859ea80] hover:bg-[#1e2fd4]">
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-white text-base whitespace-nowrap">Request access</span>
          </Button>
          <Button variant="ghost" className="h-auto px-[17px] py-3 bg-white rounded-[90px] hover:bg-gray-100">
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-[#292d32] text-base whitespace-nowrap">Login</span>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
        >
          <HamburgerIcon open={drawerOpen} />
        </button>
      </nav>

      {/* ─── Mobile Slide-out Drawer ─── */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        className={`lg:hidden fixed top-0 right-0 z-50 h-full w-[min(320px,90vw)] bg-[#1e2126] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!drawerOpen}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 h-[83px] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <img className="w-[28px] h-[28px]" alt="Logo" src="https://c.animaapp.com/mmm3cgevnH1M3s/img/vuesax-bold-command.svg" />
            <span className="font-extrabold text-white text-base tracking-[-0.6px] [font-family:'Manrope',Helvetica]">All Agent Connect</span>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-4 py-6 flex-1 overflow-y-auto">
          {navLinks.map((l, i) => (
            <a
              key={l.label}
              href="#"
              onClick={() => setDrawerOpen(false)}
              className="[font-family:'Manrope',Helvetica] font-semibold text-white text-lg px-4 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors"
              style={{ transitionDelay: drawerOpen ? `${i * 40 + 80}ms` : "0ms" }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Drawer CTAs */}
        <div className="px-6 py-6 flex flex-col gap-3 border-t border-white/10 shrink-0">
          <Button className="w-full h-auto py-3.5 bg-[#2537ff] rounded-[90px] border border-[#1859ea80] hover:bg-[#1e2fd4]">
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-white text-base">Request access</span>
          </Button>
          <Button variant="ghost" className="w-full h-auto py-3.5 bg-white/10 border border-white/20 rounded-[90px] hover:bg-white/20">
            <span className="[font-family:'Manrope',Helvetica] font-semibold text-white text-base">Login</span>
          </Button>
        </div>
      </div>

      {/* ─── Page Sections ─── */}
      <main className="flex flex-col w-full">
        <HeroSection />
        <RealResultsVisualizationSection />
        <FeaturesOverviewSection />
        <AgentUsageSection />
        <ScaleAndPersistenceSection />
        <NetworkIntelligenceDemoSection />
        <MarketInsightSection />
        <FooterSection />
      </main>
    </div>
  );
};
