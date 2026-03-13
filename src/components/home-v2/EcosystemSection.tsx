import { useState, ElementType } from "react";
import { motion } from "framer-motion";
import AACMonogram from "@/components/ui/AACMonogram";
import {
  Users,
  UserCheck,
  Home,
  BarChart3,
  Bell,
  TrendingUp,
  Zap,
  Network,
  BarChart2,
} from "lucide-react";

/* ─── Data ────────────────────────────────────────────────── */

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

/* ─── Brand colors ───────────────────────────────────────── */

const BLUE = "#0E56F5";
const GREEN = "#22C55E";

const TEXT_PRIMARY = "#0f172a";
const TEXT_SECONDARY = "#64748b";

/* Card tokens — clean, no glass */
const CARD_BG = "rgba(255,255,255,0.96)";
const CARD_BORDER = "rgba(15,23,42,0.08)";
const CARD_SHADOW = "0 2px 12px rgba(15,23,42,0.05)";
const CARD_SHADOW_HOVER = "0 8px 24px rgba(15,23,42,0.08)";

/* ─── Static constellation lines ─────────────────────────── */

const CONSTELLATION_LINES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x1: Math.random() * 100,
  y1: Math.random() * 100,
  x2: Math.random() * 100,
  y2: Math.random() * 100,
}));

const CONSTELLATION_NODES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
}));

/* ─── Sub-components ─────────────────────────────────────── */

function InputCard({ icon: Icon, label, description, delay = 0 }: { icon: ElementType; label: string; description: string; delay?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="cursor-default transition-shadow duration-300 ease-out"
      style={{
        borderRadius: 12,
        border: `1px solid ${CARD_BORDER}`,
        background: CARD_BG,
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Icon size={16} style={{ color: BLUE }} aria-hidden="true" className="flex-shrink-0" />
          <div className="min-w-0">
            <span className="font-sans text-sm font-semibold block" style={{ color: TEXT_PRIMARY }}>{label}</span>
            <p className="font-sans text-xs font-light truncate" style={{ color: TEXT_SECONDARY }}>{description}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ResultCard({ icon: Icon, label, description, delay = 0 }: { icon: ElementType; label: string; description: string; delay?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="cursor-default transition-shadow duration-300 ease-out"
      style={{
        borderRadius: 12,
        border: `1px solid ${CARD_BORDER}`,
        background: CARD_BG,
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Icon size={16} style={{ color: GREEN }} aria-hidden="true" className="flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-sans text-sm font-semibold block" style={{ color: TEXT_PRIMARY }}>{label}</span>
            <p className="font-sans text-xs font-light truncate" style={{ color: TEXT_SECONDARY }}>{description}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Hub (quiet, confident center) ──────────────────────── */

function Hub() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
      {/* Outer ring */}
      <div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 280, height: 280, border: "1px solid rgba(148,163,184,0.12)" }} />

      {/* Middle ring */}
      <div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 215, height: 215, border: "1px solid rgba(148,163,184,0.10)" }} />

      {/* Inner ring */}
      <div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 155, height: 155, border: "1px solid rgba(148,163,184,0.08)" }} />

      {/* Center — monogram */}
      <div className="relative z-10 flex flex-col items-center justify-center" style={{ width: 118, height: 118 }}>
        <AACMonogram className="w-[72px] h-[72px] text-emerald-500" />
      </div>

      {/* Hub labels */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-12 text-center">
        <p className="whitespace-nowrap font-sans text-base font-bold" style={{ color: TEXT_PRIMARY }}>
          All Agent Connect
        </p>
        <p className="whitespace-nowrap font-mono text-xs font-light tracking-wide" style={{ color: TEXT_SECONDARY }}>
          Private agent network
        </p>
      </div>
    </div>
  );
}

/* ─── Main Section ───────────────────────────────────────── */

export default function EcosystemSection() {
  return (
    <section
      aria-label="Ecosystem visualization"
      className="relative w-full overflow-hidden pt-36 pb-24 px-8 mt-[160px]"
      style={{ backgroundColor: "#ffffff" }}
    >
      {/* Soft gradient transition from previous section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 h-[160px] -top-[160px]"
        style={{ background: "linear-gradient(to bottom, #ffffff 0%, #ffffff 60%, #f8fafc 100%)" }}
      />

      {/* Static constellation lines — faint blueprint feel */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {CONSTELLATION_LINES.map((line) => (
          <line
            key={line.id}
            x1={`${line.x1}%`}
            y1={`${line.y1}%`}
            x2={`${line.x2}%`}
            y2={`${line.y2}%`}
            stroke="rgba(148,163,184,0.10)"
            strokeWidth="0.5"
          />
        ))}
      </svg>

      {/* Static constellation nodes */}
      {CONSTELLATION_NODES.map((node) => (
        <div
          key={node.id}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            width: 3,
            height: 3,
            backgroundColor: "rgba(148,163,184,0.18)",
          }}
        />
      ))}

      {/* Subtle grid — barely visible */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(148,163,184,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.6) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl">

        {/* Headline */}
        <motion.div className="mb-20 text-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h2 className="mb-3 font-sans text-4xl font-medium leading-tight lg:text-5xl" style={{ color: TEXT_PRIMARY }}>
            Turning network intelligence into real results.
          </h2>
          <p className="font-mono text-xl font-light tracking-wide" style={{ color: "#475569" }}>
            Data in. Dollars out.
          </p>
        </motion.div>

        {/* Three-column ecosystem grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_auto_380px] lg:gap-8 items-center justify-center">

          {/* Left — Input column */}
          <div className="flex flex-col justify-center space-y-3">
            <p className="mb-2 text-center font-mono text-xs font-light uppercase tracking-widest lg:text-left" style={{ color: BLUE, opacity: 0.85 }}>
              Data Inputs
            </p>
            {inputCards.map((card, i) => (
              <div key={card.label} className="relative">
                <InputCard icon={card.icon} label={card.label} description={card.description} delay={i * 0.1} />
                {/* Connector line — static, no particles */}
                <div aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-full lg:block"
                  style={{ width: 56, height: 2 }}
                >
                  <div className="h-full w-full" style={{ background: "linear-gradient(to right, rgba(14,86,245,0.22), rgba(14,86,245,0.08))" }} />
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
            <p className="mb-2 text-center font-mono text-xs font-light uppercase tracking-widest lg:text-left" style={{ color: GREEN, opacity: 0.85 }}>
              Results
            </p>
            {resultCards.map((card, i) => (
              <div key={card.label} className="relative">
                {/* Connector line — static, no particles */}
                <div aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1/2 hidden -translate-x-full -translate-y-1/2 lg:block"
                  style={{ width: 56, height: 2 }}
                >
                  <div className="h-full w-full" style={{ background: "linear-gradient(to right, rgba(34,197,94,0.08), rgba(34,197,94,0.22))" }} />
                </div>
                <ResultCard icon={card.icon} label={card.label} description={card.description} delay={i * 0.1} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
