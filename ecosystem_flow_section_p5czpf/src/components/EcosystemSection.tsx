import { motion } from "framer-motion";
import ConstellationBackground from "./ConstellationBackground";
import Hub from "./Hub";
import InputCard from "./InputCard";
import ResultCard from "./ResultCard";
import { Users, UserCheck, Home, BarChart3, Bell, TrendingUp, Zap, Network, BarChart2 } from "lucide-react";

const inputCards = [
  { icon: Users, label: "Seller agent access", description: "Direct connections to listing agents" },
  { icon: UserCheck, label: "Buyer agent access", description: "Qualified buyer-side representation" },
  { icon: Home, label: "Buyer / Renter needs", description: "Real-time demand signals from clients" },
  { icon: BarChart3, label: "Off-market listings", description: "Exclusive inventory before it goes live" },
  { icon: Bell, label: "Coming-soon listings", description: "Early-access pipeline intelligence" },
];

const resultCards = [
  { icon: TrendingUp, label: "Increased deal velocity", description: "Close transactions faster with better intel" },
  { icon: Zap, label: "Actionable intelligence", description: "Insights you can act on immediately" },
  { icon: Network, label: "Stronger agent relationships", description: "Build a trusted referral network" },
  { icon: BarChart2, label: "Increased GCI", description: "More gross commission income per agent" },
  { icon: TrendingUp, label: "Higher agent production", description: "Lift output across your entire team" },
];

export default function EcosystemSection() {
  return (
    <section
      aria-label="Ecosystem visualization"
      className="relative w-full overflow-hidden py-24 px-8"
      style={{ backgroundColor: "#0A0E1A" }}
    >
      {/* Background network */}
      <ConstellationBackground />

      {/* Subtle grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#3B82F6 1px, transparent 1px), linear-gradient(90deg, #3B82F6 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl">

        {/* Headline */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h2 className="mb-3 font-sans text-4xl font-medium leading-tight lg:text-5xl" style={{ color: "#F0F8FF" }}>
            Turning network intelligence into real results.
          </h2>
          {/* Value statement — AAC Blue */}
          <p className="font-mono text-xl font-light tracking-wide" style={{ color: "#0E56F5" }}>
            Data in. Dollars out.
          </p>
        </motion.div>

        {/* Three-column ecosystem grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_auto_380px] lg:gap-8 items-center justify-center">

          {/* Left — Input column */}
          <div className="flex flex-col justify-center space-y-3">
            <p className="mb-2 text-center font-mono text-xs font-light uppercase tracking-widest lg:text-left" style={{ color: "#0E56F5" }}>
              Data Inputs
            </p>
            {inputCards.map((card, i) => (
              <div key={card.label} className="relative">
                <InputCard
                  icon={card.icon}
                  label={card.label}
                  description={card.description}
                  delay={i * 0.1}
                />
                {/* Blue connector — animated particle flow toward center */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-full lg:block overflow-hidden"
                  style={{ width: "56px", height: "2px" }}
                >
                  <div className="h-full w-full" style={{ background: "linear-gradient(to right, rgba(14,86,245,0.6), rgba(14,86,245,0.08))" }} />
                  {/* Particle */}
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 5, height: 5, background: "#0E56F5", boxShadow: "0 0 6px 2px rgba(14,86,245,0.7)" }}
                    animate={{ x: [0, 56] }}
                    transition={{ duration: 1.4 + i * 0.15, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Center — Hub */}
          <div className="flex flex-col items-center justify-center py-8 lg:py-0">
            <Hub />
          </div>

          {/* Right — Results column */}
          <div className="flex flex-col justify-center space-y-3">
            <p className="mb-2 text-center font-mono text-xs font-light uppercase tracking-widest lg:text-left" style={{ color: "#50C878" }}>
              Results
            </p>
            {resultCards.map((card, i) => (
              <div key={card.label} className="relative">
                {/* Green connector — animated particle flow outward (hub → card) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1/2 hidden -translate-x-full -translate-y-1/2 lg:block overflow-hidden"
                  style={{ width: "56px", height: "2px" }}
                >
                  <div className="h-full w-full" style={{ background: "linear-gradient(to right, rgba(80,200,120,0.08), rgba(80,200,120,0.6))" }} />
                  {/* Particle */}
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 5, height: 5, background: "#50C878", boxShadow: "0 0 6px 2px rgba(80,200,120,0.7)" }}
                    animate={{ x: [0, 56] }}
                    transition={{ duration: 1.4 + i * 0.15, repeat: Infinity, ease: "linear", delay: i * 0.3 + 0.7 }}
                  />
                </div>
                <ResultCard
                  icon={card.icon}
                  label={card.label}
                  description={card.description}
                  delay={i * 0.1}
                />
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
