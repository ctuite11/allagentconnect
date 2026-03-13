import { useState, useMemo, ElementType } from "react";
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

/* ─── Brand colors (inline, scoped to this section) ──────── */

const BG_LIGHT = "#f8fafc";
const BLUE = "#0E56F5";
const GREEN = "#22C55E";

/* Light-theme card tokens */
const CARD_BG_QUIET = "rgba(255,255,255,0.72)";
const CARD_BORDER_QUIET = "rgba(15,23,42,0.08)";
const CARD_BG_HOVER = "rgba(255,255,255,0.95)";
const CARD_BORDER_HOVER = "rgba(15,23,42,0.14)";
const CARD_SHADOW_HOVER = "0 12px 40px rgba(0,0,0,0.08)";
const CARD_SHADOW_REST = "0 1px 3px rgba(0,0,0,0.04)";

/* Light-theme palette */
const TEXT_PRIMARY = "#0f172a";
const TEXT_SECONDARY = "#64748b";
const RING_MUTED = "rgba(148,163,184,0.15)";

/* ─── Sub-components ─────────────────────────────────────── */

function InputCard({ icon: Icon, label, description, delay = 0 }: { icon: ElementType; label: string; description: string; delay?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="group relative overflow-hidden backdrop-blur-sm cursor-default transition-all duration-300 ease-out"
      style={{
        borderRadius: 12,
        border: `1px solid ${hovered ? CARD_BORDER_HOVER : CARD_BORDER_QUIET}`,
        background: hovered ? CARD_BG_HOVER : CARD_BG_QUIET,
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW_REST,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative px-4 py-3">
        {/* Apple light sweep — blue tinted */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700 ease-out"
          style={{
            background: "linear-gradient(110deg, transparent 40%, rgba(14,86,245,0.18) 50%, transparent 60%)",
          }}
        />
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <motion.div
              className="h-2 w-2 rounded-full"
              style={{ background: BLUE }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.2, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon size={16} style={{ color: BLUE }} aria-hidden="true" className="flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-sans text-sm font-semibold block" style={{ color: TEXT_PRIMARY }}>{label}</span>
              <p className="font-sans text-xs font-light truncate" style={{ color: TEXT_SECONDARY }}>{description}</p>
            </div>
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
      className="group relative overflow-hidden backdrop-blur-sm cursor-default transition-all duration-300 ease-out"
      style={{
        borderRadius: 12,
        border: `1px solid ${hovered ? CARD_BORDER_HOVER : CARD_BORDER_QUIET}`,
        background: hovered ? CARD_BG_HOVER : CARD_BG_QUIET,
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW_REST,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative px-4 py-3">
        {/* Apple light sweep — emerald tinted */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700 ease-out"
          style={{
            background: "linear-gradient(110deg, transparent 40%, rgba(34,197,94,0.18) 50%, transparent 60%)",
          }}
        />
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <motion.div
              className="h-2 w-2 rounded-full"
              style={{ background: GREEN }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.2, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
          </div>
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

/* ─── Hub (center core) ──────────────────────────────────── */

function Hub() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
      {/* Deep radial glow */}
      <div aria-hidden="true" className="absolute rounded-full blur-3xl"
        style={{ width: 300, height: 300, background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)" }} />
      {/* Mid glow — blended blue + emerald */}
      <div aria-hidden="true" className="absolute rounded-full blur-2xl"
        style={{ width: 230, height: 230, background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, rgba(5,150,105,0.04) 50%, transparent 75%)" }} />
      {/* Inner glow */}
      <div aria-hidden="true" className="absolute rounded-full blur-xl"
        style={{ width: 160, height: 160, background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />
      {/* Pulsing glow */}
      <motion.div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 130, height: 130, background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Outer orbit ring */}
      <motion.div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 280, height: 280, border: `1px solid ${RING_MUTED}` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute rounded-full"
          style={{ width: 9, height: 9, top: -4.5, left: "50%", transform: "translateX(-50%)",
            background: "rgba(59,130,246,0.5)", }} />
        <div className="absolute rounded-full"
          style={{ width: 7, height: 7, bottom: -3.5, left: "50%", transform: "translateX(-50%)",
            background: "rgba(5,150,105,0.5)", }} />
      </motion.div>

      {/* Middle orbit ring */}
      <motion.div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 215, height: 215, border: `1px solid ${RING_MUTED}` }}
        animate={{ rotate: -360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute rounded-full"
          style={{ width: 6, height: 6, top: -3, right: "15%",
            background: "rgba(14,86,245,0.4)", }} />
      </motion.div>

      {/* Inner pulsing ring */}
      <motion.div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 155, height: 155, border: "1px solid rgba(148,163,184,0.12)" }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />

      {/* Center — monogram */}
      <div className="relative z-10 flex flex-col items-center justify-center" style={{ width: 118, height: 118 }}>
        <motion.div aria-hidden="true" className="absolute rounded-full"
          style={{ width: 100, height: 100,
            background: "radial-gradient(circle, rgba(5,150,105,0.06) 0%, rgba(59,130,246,0.04) 55%, transparent 80%)" }}
          animate={{ opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10"
        >
          <AACMonogram className="w-[72px] h-[72px] text-emerald-500" />
        </motion.div>
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
      style={{ backgroundColor: BG_LIGHT }}
    >
      {/* Light gradient transition band */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 h-[160px] -top-[160px]"
        style={{ background: "linear-gradient(to bottom, #ffffff 0%, #f8fafc 40%, #f8fafc 80%, #f8fafc 100%)" }}
      />

      {/* Constellation web lines */}
      <ConstellationLines />

      {/* Subtle grid — lines only, no nodes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.06]"
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
          <p className="font-mono text-xl font-light tracking-wide" style={{ color: BLUE }}>
            Data in. Dollars out.
          </p>
        </motion.div>

        {/* Three-column ecosystem grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_auto_380px] lg:gap-8 items-center justify-center">

          {/* Left — Input column */}
          <div className="flex flex-col justify-center space-y-3">
            <p className="mb-2 text-center font-mono text-xs font-light uppercase tracking-widest lg:text-left" style={{ color: BLUE }}>
              Data Inputs
            </p>
            {inputCards.map((card, i) => (
              <div key={card.label} className="relative">
                <InputCard icon={card.icon} label={card.label} description={card.description} delay={i * 0.1} />
                {/* Blue connector with particle */}
                <div aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-full lg:block overflow-hidden"
                  style={{ width: 56, height: 2 }}
                >
                  <div className="h-full w-full" style={{ background: `linear-gradient(to right, rgba(14,86,245,0.18), rgba(14,86,245,0.06))` }} />
                  <motion.div className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 5, height: 5, background: "rgba(59,130,246,0.5)" }}
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
            <p className="mb-2 text-center font-mono text-xs font-light uppercase tracking-widest lg:text-left" style={{ color: GREEN }}>
              Results
            </p>
            {resultCards.map((card, i) => (
              <div key={card.label} className="relative">
                {/* Green connector with particle */}
                <div aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1/2 hidden -translate-x-full -translate-y-1/2 lg:block overflow-hidden"
                  style={{ width: 56, height: 2 }}
                >
                  <div className="h-full w-full" style={{ background: `linear-gradient(to right, rgba(34,197,94,0.06), rgba(34,197,94,0.18))` }} />
                  <motion.div className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 5, height: 5, background: "rgba(5,150,105,0.5)" }}
                    animate={{ x: [0, 56] }}
                    transition={{ duration: 1.4 + i * 0.15, repeat: Infinity, ease: "linear", delay: i * 0.3 + 0.7 }}
                  />
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
