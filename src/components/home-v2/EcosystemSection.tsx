import { useMemo, useEffect, useState, ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const BLUE = "#0E56F5";
const BLUE_60 = "rgba(14,86,245,0.6)";
const BLUE_08 = "rgba(14,86,245,0.08)";
const GREEN = "#059669";
const GREEN_60 = "rgba(5,150,105,0.6)";
const GREEN_08 = "rgba(5,150,105,0.08)";

/* ─── Sub-components ─────────────────────────────────────── */

function InputCard({ icon: Icon, label, description, delay = 0 }: { icon: ElementType; label: string; description: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="group relative overflow-hidden backdrop-blur-sm cursor-default"
      style={{ borderRadius: 12, border: `1px solid rgba(14,86,245,0.2)`, background: "rgba(31,41,55,0.8)" }}
    >
      <div className="relative px-4 py-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-md opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
        {/* Hover sweep */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{ background: "linear-gradient(90deg, transparent 0%, hsl(217,90%,60%,0.08) 50%, transparent 100%)" }}
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <motion.div
              className="h-2 w-2 rounded-full"
              style={{ background: BLUE }}
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: BLUE_08, border: `1px solid rgba(14,86,245,0.2)` }}
            >
              <Icon size={16} style={{ color: BLUE }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="font-sans text-sm font-medium block" style={{ color: "#F0F8FF" }}>{label}</span>
              <p className="font-sans text-xs font-light truncate" style={{ color: "#D1D5DB" }}>{description}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ResultCard({ icon: Icon, label, description, delay = 0 }: { icon: ElementType; label: string; description: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="group relative overflow-hidden backdrop-blur-sm cursor-default"
      style={{ borderRadius: 12, border: `1px solid rgba(5,150,105,0.2)`, background: "rgba(31,41,55,0.8)" }}
    >
      <div className="relative px-4 py-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-md opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
        {/* Hover sweep */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{ background: "linear-gradient(90deg, transparent 0%, hsl(161,78%,45%,0.08) 50%, transparent 100%)" }}
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <motion.div
              className="h-2 w-2 rounded-full"
              style={{ background: GREEN }}
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: GREEN_08, border: `1px solid rgba(5,150,105,0.2)` }}
          >
            <Icon size={16} style={{ color: GREEN }} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-sans text-sm font-medium block" style={{ color: "#F0F8FF" }}>{label}</span>
            <p className="font-sans text-xs font-light truncate" style={{ color: "#D1D5DB" }}>{description}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Constellation Background ───────────────────────────── */

interface Dot { id: number; x: number; y: number; duration: number; delay: number }
interface Line { id: number; x1: number; y1: number; x2: number; y2: number }
interface WakeNode { id: number; x: number; y: number; color: "blue" | "green" }

function ConstellationBackground() {
  const dots: Dot[] = useMemo(
    () => Array.from({ length: 80 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      duration: 3 + Math.random() * 2, delay: Math.random() * 4,
    })), []
  );

  const lines: Line[] = useMemo(
    () => Array.from({ length: 30 }, (_, i) => ({
      id: i, x1: Math.random() * 100, y1: Math.random() * 100,
      x2: Math.random() * 100, y2: Math.random() * 100,
    })), []
  );

  const [wakeNodes, setWakeNodes] = useState<WakeNode[]>([]);

  useEffect(() => {
    let counter = 0;
    const fireWave = () => {
      const isBlue = counter % 2 === 0;
      const color: "blue" | "green" = isBlue ? "blue" : "green";
      const side = isBlue ? [0, 38] : [62, 100];
      const count = 4 + Math.floor(Math.random() * 4);
      const nodes: WakeNode[] = Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        x: side[0] + Math.random() * (side[1] - side[0]),
        y: 10 + Math.random() * 80,
        color,
      }));
      setWakeNodes(nodes);
      counter++;
      setTimeout(() => setWakeNodes([]), 1800);
    };
    const interval = setInterval(fireWave, 3200);
    const timeout = setTimeout(fireWave, 1200);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        {lines.map((line) => (
          <line key={line.id} x1={`${line.x1}%`} y1={`${line.y1}%`} x2={`${line.x2}%`} y2={`${line.y2}%`}
            stroke="#3B82F6" strokeWidth="0.5" strokeOpacity="0.18" />
        ))}
      </svg>
      {dots.map((dot) => (
        <motion.div key={dot.id} className="absolute rounded-full"
          style={{ left: `${dot.x}%`, top: `${dot.y}%`, width: 3, height: 3, backgroundColor: "#3B82F6" }}
          animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.4, 1] }}
          transition={{ duration: dot.duration, delay: dot.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <AnimatePresence>
        {wakeNodes.map((node) => (
          <motion.div key={node.id} className="absolute rounded-full"
            style={{
              left: `${node.x}%`, top: `${node.y}%`, width: 8, height: 8,
              marginLeft: -4, marginTop: -4,
              backgroundColor: node.color === "blue" ? "#3B82F6" : "#059669",
              boxShadow: node.color === "blue"
                ? "0 0 12px 4px rgba(59,130,246,0.6)"
                : "0 0 12px 4px rgba(5,150,105,0.6)",
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0.9, 0.9, 0], scale: [0.4, 1.4, 1.2, 0.6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Hub (center core) ──────────────────────────────────── */

function Hub() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
      {/* Deep radial glow */}
      <div aria-hidden="true" className="absolute rounded-full blur-3xl"
        style={{ width: 300, height: 300, background: "radial-gradient(circle, rgba(14,86,245,0.22) 0%, transparent 70%)" }} />
      {/* Mid glow */}
      <div aria-hidden="true" className="absolute rounded-full blur-2xl"
        style={{ width: 230, height: 230, background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)" }} />
      {/* Inner glow */}
      <div aria-hidden="true" className="absolute rounded-full blur-xl"
        style={{ width: 160, height: 160, background: "radial-gradient(circle, rgba(14,86,245,0.45) 0%, transparent 70%)" }} />
      {/* Pulsing glow */}
      <motion.div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 130, height: 130, background: "radial-gradient(circle, rgba(14,86,245,0.35) 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Outer orbit ring — 30s */}
      <motion.div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 280, height: 280, border: "1px solid rgba(59,130,246,0.22)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute rounded-full"
          style={{ width: 10, height: 10, top: -5, left: "50%", transform: "translateX(-50%)",
            background: "#3B82F6", boxShadow: "0 0 8px 3px rgba(59,130,246,0.7)" }} />
        <div className="absolute rounded-full"
          style={{ width: 8, height: 8, bottom: -4, left: "50%", transform: "translateX(-50%)",
            background: "#059669", boxShadow: "0 0 8px 3px rgba(5,150,105,0.7)" }} />
      </motion.div>

      {/* Middle orbit ring — counter-clockwise 22s */}
      <motion.div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 215, height: 215, border: "1px solid rgba(14,86,245,0.2)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute rounded-full"
          style={{ width: 7, height: 7, top: -3.5, right: "15%",
            background: BLUE, boxShadow: "0 0 6px 2px rgba(14,86,245,0.6)" }} />
      </motion.div>

      {/* Inner pulsing ring */}
      <motion.div aria-hidden="true" className="absolute rounded-full"
        style={{ width: 155, height: 155, border: "1px solid rgba(14,86,245,0.35)" }}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />

      {/* Center — monogram + ambient glow */}
      <div className="relative z-10 flex flex-col items-center justify-center" style={{ width: 118, height: 118 }}>
        <motion.div aria-hidden="true" className="absolute rounded-full"
          style={{ width: 100, height: 100,
            background: "radial-gradient(circle, rgba(5,150,105,0.18) 0%, rgba(14,86,245,0.12) 55%, transparent 80%)" }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
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
        <p className="whitespace-nowrap font-sans text-base font-bold" style={{ color: "#ffffff" }}>
          All Agent Connect
        </p>
        <p className="whitespace-nowrap font-mono text-xs font-light tracking-wide" style={{ color: "#94A3B8" }}>
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
      className="relative w-full overflow-hidden py-24 px-8"
      style={{ backgroundColor: "#0A0E1A" }}
    >
      {/* Background constellation */}
      <ConstellationBackground />

      {/* Subtle grid */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#3B82F6 1px, transparent 1px), linear-gradient(90deg, #3B82F6 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl">

        {/* Headline */}
        <motion.div className="mb-16 text-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h2 className="mb-3 font-sans text-4xl font-medium leading-tight lg:text-5xl" style={{ color: "#F0F8FF" }}>
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
                  <div className="h-full w-full" style={{ background: `linear-gradient(to right, ${BLUE_60}, rgba(14,86,245,0.08))` }} />
                  <motion.div className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 5, height: 5, background: BLUE, boxShadow: `0 0 6px 2px rgba(14,86,245,0.7)` }}
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
                  <div className="h-full w-full" style={{ background: `linear-gradient(to right, ${GREEN_08}, ${GREEN_60})` }} />
                  <motion.div className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 5, height: 5, background: GREEN, boxShadow: `0 0 6px 2px rgba(5,150,105,0.7)` }}
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
