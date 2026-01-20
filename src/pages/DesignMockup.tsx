import React from "react";
import { Shield, Users, Zap, Lock, ArrowRight, Check } from "lucide-react";

/**
 * Design-Only Mockup Page
 * 
 * PURPOSE: Visual exploration of premium marketing aesthetic
 * NOT PRODUCTION CODE - No routing, auth, data, or functional buttons
 * Uses only AAC color palette (Royal Blue, Emerald, Zinc)
 */

const DesignMockup: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: HERO
          Soft blue-to-white gradient, large typography, abstract blur
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white to-zinc-50" />
        
        {/* Abstract gradient blur - top right */}
        <div 
          className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(14,86,245,0.15) 0%, rgba(14,86,245,0.05) 40%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        
        {/* Abstract gradient blur - bottom left */}
        <div 
          className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(5,150,105,0.12) 0%, rgba(5,150,105,0.04) 40%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200/60 shadow-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-zinc-600">The Agent-to-Agent Network</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-zinc-900 leading-[1.1] mb-6">
            Close more deals with
            <br />
            <span className="text-[#0E56F5]">agents who get it</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl mx-auto mb-12 leading-relaxed">
            The private network where top agents share inventory, 
            match buyers, and collaborate on deals before they hit the market.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white font-semibold rounded-full hover:shadow-[0_8px_24px_rgba(16,185,129,0.25)] transition-shadow">
              Get Early Access
              <ArrowRight className="w-5 h-5 text-emerald-400" />
            </button>
            <button className="inline-flex items-center gap-2 px-8 py-4 bg-white text-zinc-700 font-semibold rounded-full border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all">
              See How It Works
            </button>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 flex items-center justify-center gap-8 text-sm text-zinc-400">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              Licensed agents only
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              No consumer traffic
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              Free to join
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: FEATURES GRID
          4 rounded cards with icons, white background
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-20">
            <p className="text-sm font-semibold text-[#0E56F5] uppercase tracking-wider mb-4">
              Platform Capabilities
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 tracking-tight">
              Everything agents need,
              <br />
              nothing they don't
            </h2>
          </div>

          {/* Cards grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Users,
                title: "Private Listings Exchange",
                description: "Share pocket listings and coming-soons exclusively with verified agents in your network."
              },
              {
                icon: Zap,
                title: "Instant Buyer Matching",
                description: "Post buyer needs and get matched with agents who have the right inventory—in minutes."
              },
              {
                icon: Shield,
                title: "Verified Network Only",
                description: "Every member is a licensed, verified agent. No consumers, no noise, just professionals."
              },
              {
                icon: Lock,
                title: "Agent-to-Agent Workspace",
                description: "Communicate, share documents, and coordinate showings in one private space."
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group p-8 rounded-3xl bg-white border border-zinc-200/70 shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_46px_rgba(15,23,42,0.10)] hover:border-zinc-300/80 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-[#0E56F5]" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-zinc-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: VALUE PROPOSITION BAND
          Blue gradient band with centered headline
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-32 px-6 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-blue-100/50 to-zinc-50" />
        
        {/* Radial glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] opacity-60"
          style={{
            background: 'radial-gradient(ellipse, rgba(14,86,245,0.08) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 tracking-tight mb-6">
            Your deals. Your relationships.
            <br />
            <span className="text-[#0E56F5]">Your competitive edge.</span>
          </h2>
          <p className="text-xl text-zinc-600 max-w-2xl mx-auto leading-relaxed">
            In a market where speed wins, AllAgentConnect gives you access to 
            off-market inventory and qualified buyers before anyone else.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: HOW IT WORKS
          3 numbered steps on zinc-50 background
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 bg-zinc-50">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-20">
            <p className="text-sm font-semibold text-[#0E56F5] uppercase tracking-wider mb-4">
              Simple & Powerful
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 tracking-tight">
              Up and running in minutes
            </h2>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Verify Your License",
                description: "Quick verification confirms you're a licensed professional. No consumers allowed."
              },
              {
                step: "02",
                title: "Set Your Preferences",
                description: "Define your coverage areas, property types, and price ranges. We'll match you automatically."
              },
              {
                step: "03",
                title: "Start Collaborating",
                description: "Post listings, broadcast buyer needs, and connect with agents who have what you need."
              }
            ].map((item, index) => (
              <div key={index} className="relative">
                {/* Connector line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-[2px] bg-zinc-200" />
                )}
                
                <div className="text-center">
                  {/* Step number */}
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-zinc-200 text-xl font-bold text-zinc-900 mb-6 relative z-10">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-zinc-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: TESTIMONIAL-STYLE CARDS
          3-column grid with avatar placeholders
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-20">
            <p className="text-sm font-semibold text-[#0E56F5] uppercase tracking-wider mb-4">
              Trusted by Top Producers
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 tracking-tight">
              Agents are closing faster
            </h2>
          </div>

          {/* Testimonial cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                initials: "MK",
                name: "Michael K.",
                title: "Broker, Boston",
                quote: "I matched a buyer with a pocket listing in 3 hours. That deal would have taken weeks on the open market."
              },
              {
                initials: "SR",
                name: "Sarah R.",
                title: "Agent, Cambridge",
                quote: "Finally, a platform built for how agents actually work. No consumer drama, just real collaboration."
              },
              {
                initials: "JT",
                name: "James T.",
                title: "Team Lead, Brookline",
                quote: "My team closed 4 off-market deals last month through connections we made on AllAgentConnect."
              }
            ].map((testimonial, index) => (
              <div 
                key={index}
                className="p-8 rounded-2xl bg-white border border-zinc-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-300"
              >
                {/* Avatar and info */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-semibold text-zinc-600">
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{testimonial.name}</p>
                    <p className="text-sm text-zinc-500">{testimonial.title}</p>
                  </div>
                </div>
                {/* Quote */}
                <p className="text-zinc-600 leading-relaxed">
                  "{testimonial.quote}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6: FINAL CTA BAND
          Dark background with closing headline
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 bg-zinc-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Ready to work ahead
            <br />
            of the market?
          </h2>
          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto">
            Join the network of agents who are closing deals 
            before properties ever hit the MLS.
          </p>
          <button className="inline-flex items-center gap-2 px-10 py-5 bg-white text-zinc-900 font-semibold rounded-full hover:bg-zinc-100 transition-colors">
            Request Early Access
            <ArrowRight className="w-5 h-5" />
          </button>
          
          {/* Footer trust */}
          <p className="mt-12 text-sm text-zinc-500">
            Free for licensed agents · No credit card required · Invite-only access
          </p>
        </div>
      </section>

      {/* Minimal footer */}
      <footer className="py-8 px-6 bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            © 2026 AllAgentConnect. Design mockup only.
          </p>
          <p className="text-sm text-zinc-600">
            This page is for visual exploration — not production.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default DesignMockup;
