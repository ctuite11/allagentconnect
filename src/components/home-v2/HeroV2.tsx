import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";

const HeroV2 = () => {
  return (
    <section className="relative min-h-[90vh] bg-zinc-950 overflow-hidden">
      {/* Nav overlay */}
      <nav className="relative z-20 flex items-center justify-between px-6 lg:px-16 py-5">
        <Link to="/homepage-v2" className="shrink-0">
          <Logo variant="reversed" size="md" />
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-300">
          <a href="#network" className="hover:text-white transition-colors">Network</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#results" className="hover:text-white transition-colors">Results</a>
          <a href="#about" className="hover:text-white transition-colors">About</a>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/auth" className="text-sm text-zinc-300 hover:text-white transition-colors hidden sm:block">
            Login
          </Link>
          <Link
            to="/auth?mode=register"
            className="bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Get Access
          </Link>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-16 pt-12 lg:pt-20 pb-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left text block */}
          <div className="max-w-xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight">
              See the market before it hits the MLS.
            </h1>
            <p className="mt-6 text-lg text-zinc-400 leading-relaxed max-w-md">
              The private network where agents share off-market listings, buyer demand, and deal intelligence before properties go public.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/auth?mode=register"
                className="bg-accent hover:bg-accent-hover text-accent-foreground font-semibold px-8 py-3.5 rounded-lg text-base transition-colors"
              >
                Get Access
              </Link>
              <a
                href="#network"
                className="border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white font-medium px-8 py-3.5 rounded-lg text-base transition-colors"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Right agent portrait */}
          <div className="relative hidden lg:flex justify-end">
            <div className="w-[420px] h-[520px] rounded-2xl bg-zinc-800/50 overflow-hidden">
              <img
                src="/brand/aac-globe.png"
                alt="Agent network"
                className="w-full h-full object-cover opacity-80"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent rounded-2xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Subtle background gradient accent */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/[0.04] to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
    </section>
  );
};

export default HeroV2;
