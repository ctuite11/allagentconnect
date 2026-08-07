import React, { useLayoutEffect, useState } from "react";
import AACMonogram from "@/components/ui/AACMonogram";

/**
 * First-party responsive hero assets (Netlify static).
 * Do not use animaapp.com or /__l5e/ — those paths either inflate LCP or 404-as-HTML.
 *
 * Keep SRCSET / SIZES / src identical to the homepage preload +
 * #aac-home-hero-shell in index.html so the browser reuses one transfer.
 *
 * On first homepage load the pre-React shell owns the LCP <img>. We must NOT
 * remove that node (removal clears the early LCP candidate). Instead we hand
 * off: keep the shell image in the DOM behind React chrome, and skip a second
 * <img> so there is no duplicate download or accessible double content.
 */
const HERO_WEBP_SRCSET =
  "/images/home/hero-768.webp 768w, /images/home/hero-1200.webp 1200w, /images/home/hero-1920.webp 1920w";
const HERO_SIZES = "100vw";
/** Default src matches preload href + shell; srcset picks 768/1200/1920 by viewport. */
const HERO_SRC = "/images/home/hero-768.webp";

function handOffHomeHeroShell() {
  const shell = document.getElementById("aac-home-hero-shell");
  if (!shell) return false;

  // Keep the early LCP image mounted; place it behind React content.
  shell.style.zIndex = "0";
  shell.setAttribute("data-aac-hero-handoff", "1");

  const root = document.getElementById("root");
  if (root) {
    root.style.position = "relative";
    root.style.zIndex = "1";
    root.style.backgroundColor = "transparent";
  }

  // HomepageV2 wrapper is bg-white; make it transparent so the shell shows through
  // the hero viewport. Below-the-fold sections bring their own backgrounds.
  const homeWrap = root?.querySelector(":scope > div");
  if (homeWrap instanceof HTMLElement) {
    homeWrap.style.backgroundColor = "transparent";
  }

  return true;
}

function removeHomeHeroShell() {
  document.getElementById("aac-home-hero-shell")?.remove();
  document.getElementById("aac-home-hero-shell-css")?.remove();
  document.documentElement.classList.remove("aac-home-hero-shell");
  const root = document.getElementById("root");
  if (root) {
    root.style.position = "";
    root.style.zIndex = "";
    root.style.backgroundColor = "";
  }
}

const HeroSection = () => {
  // Sync read so the first paint never mounts a second <img> when the shell exists.
  const [shellBacked] = useState(
    () => typeof document !== "undefined" && !!document.getElementById("aac-home-hero-shell"),
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.aacHeroMounted = "1";
    if (shellBacked) handOffHomeHeroShell();
    return () => {
      delete document.documentElement.dataset.aacHeroMounted;
      // Defer removal so React StrictMode remount can reclaim the shell.
      requestAnimationFrame(() => {
        if (!document.documentElement.dataset.aacHeroMounted) {
          removeHomeHeroShell();
        }
      });
    };
  }, [shellBacked]);

  return (
    <section
      className={`relative w-full min-h-screen overflow-hidden flex flex-col ${
        shellBacked ? "bg-transparent" : "bg-[#111317]"
      }`}
    >
      {/* Background image — skipped when pre-React shell already provides it (LCP). */}
      {!shellBacked && (
        <div className="absolute inset-0">
          <img
            src={HERO_SRC}
            srcSet={HERO_WEBP_SRCSET}
            sizes={HERO_SIZES}
            alt="Real estate agents collaborating"
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "55% center" }}
          />
        </div>
      )}

      {/* Lower-left readability wash — soft gradient, not a panel */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 90% 75% at 12% 88%, rgba(8, 10, 16, 0.78) 0%, rgba(8, 10, 16, 0.42) 42%, transparent 68%)",
            "linear-gradient(105deg, rgba(10, 12, 18, 0.55) 0%, rgba(10, 12, 18, 0.22) 38%, transparent 58%)",
          ].join(", "),
        }}
      />

      {/* Blue glow accent */}
      <div className="absolute top-1/3 left-0 w-[560px] h-[560px] rounded-full bg-aac opacity-[0.07] blur-[140px] pointer-events-none" />

      {/* Top access row */}
      <div className="relative z-10 flex items-center justify-between gap-3 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[100px] py-5">
        <div className="inline-grid grid-cols-[auto_auto] items-center gap-x-2.5 gap-y-0.5 min-w-0">
          <AACMonogram className="w-8 h-8 sm:w-9 sm:h-9 text-[#50c878] row-span-2 self-center" />
          <span className="font-['Manrope'] font-semibold text-white text-base sm:text-xl tracking-[-0.4px] whitespace-nowrap">
            All Agent Connect
          </span>
          <span className="font-['Manrope'] font-light text-[10px] sm:text-[11px] tracking-[0.2em] text-neutral-400 whitespace-nowrap">
            Massachusetts
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-5 shrink-0">
          <a
            href="/auth?mode=register&source=home_nav"
            className="font-['Manrope'] font-semibold text-white bg-transparent border border-white/40 hover:bg-white/10 hover:border-white/70 transition-colors h-9 sm:h-11 px-3 sm:px-6 rounded-full inline-flex items-center text-xs sm:text-sm whitespace-nowrap"
          >
            Request Access
          </a>
          <a href="/auth" className="font-['Manrope'] font-medium text-white/85 hover:text-white text-xs sm:text-sm transition-colors whitespace-nowrap">
            Sign in
          </a>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex flex-col justify-center flex-1 w-full max-w-[1440px] mx-auto py-28 md:py-32" style={{ transform: "translateY(-30px)" }}>
        <div className="max-w-[580px] ml-8 md:ml-16 lg:ml-24 flex flex-col">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/10 border border-white/15 backdrop-blur-md rounded-full w-fit">
            <span className="w-[7px] h-[7px] rounded-full bg-[#50c878] shrink-0" />
            <span className="font-['Manrope'] font-medium text-white/90 text-sm tracking-[0.28px]">
              Verified Agent Network
            </span>
          </div>

          {/* Headline */}
          <h1
            className="mt-6 font-['Manrope'] font-semibold text-white text-5xl md:text-6xl tracking-tight leading-[1.05]"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.35)", textWrap: "balance" as any }}
          >
            The private listing network where agents share pre-market intelligence.
          </h1>

          {/* Sub-headline */}
          <p
            className="mt-5 font-['Manrope'] font-medium text-white/90 text-lg md:text-xl leading-relaxed max-w-2xl"
            style={{ textShadow: "0 1px 10px rgba(0,0,0,0.45)" }}
          >
            See buyer demand and pre-market opportunities before they hit the public market.
          </p>

          {/* CTA */}
          <div className="flex items-center gap-4 mt-8 flex-wrap">
            <a
              href="/auth?mode=register&source=home_hero"
              className="h-14 px-8 inline-flex items-center gap-2 bg-[#50C878] rounded-full hover:bg-[#45b96d] transition-colors font-['Manrope'] font-semibold text-black text-base shadow-sm"
            >
              Request access
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
