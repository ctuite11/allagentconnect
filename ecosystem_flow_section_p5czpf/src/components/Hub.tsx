import { motion } from "framer-motion";
import AACMonogram from "./ui/AACMonogram";

export default function Hub() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>

      {/* Deep radial glow — outermost */}
      <div
        aria-hidden="true"
        className="absolute rounded-full blur-3xl"
        style={{
          width: 300,
          height: 300,
          background: "radial-gradient(circle, rgba(14,86,245,0.22) 0%, transparent 70%)",
        }}
      />

      {/* Mid glow */}
      <div
        aria-hidden="true"
        className="absolute rounded-full blur-2xl"
        style={{
          width: 230,
          height: 230,
          background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)",
        }}
      />

      {/* Inner glow */}
      <div
        aria-hidden="true"
        className="absolute rounded-full blur-xl"
        style={{
          width: 160,
          height: 160,
          background: "radial-gradient(circle, rgba(14,86,245,0.45) 0%, transparent 70%)",
        }}
      />

      {/* Pulsing glow on the core */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{ width: 130, height: 130, background: "radial-gradient(circle, rgba(14,86,245,0.35) 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Outer rotating orbit ring — 30s */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full border"
        style={{ width: 280, height: 280, borderColor: "rgba(59,130,246,0.22)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {/* Blue orbit node */}
        <div
          className="absolute rounded-full"
          style={{
            width: 10, height: 10, top: -5, left: "50%", transform: "translateX(-50%)",
            background: "#3B82F6",
            boxShadow: "0 0 8px 3px rgba(59,130,246,0.7)",
          }}
        />
        {/* Green orbit node (opposite side) */}
        <div
          className="absolute rounded-full"
          style={{
            width: 8, height: 8, bottom: -4, left: "50%", transform: "translateX(-50%)",
            background: "#22C55E",
            boxShadow: "0 0 8px 3px rgba(34,197,94,0.7)",
          }}
        />
      </motion.div>

      {/* Middle orbit ring — counter-clockwise 22s */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full border"
        style={{ width: 215, height: 215, borderColor: "rgba(14,86,245,0.2)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 7, height: 7, top: -3.5, right: "15%",
            background: "#0E56F5",
            boxShadow: "0 0 6px 2px rgba(14,86,245,0.6)",
          }}
        />
      </motion.div>

      {/* Inner pulsing ring */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full border"
        style={{ width: 155, height: 155, borderColor: "rgba(14,86,245,0.35)" }}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />

      {/* Center hub core — no solid disk, just soft glow + monogram */}
      <div className="relative z-10 flex flex-col items-center justify-center" style={{ width: 118, height: 118 }}>
        {/* Soft ambient glow behind monogram */}
        <motion.div
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            width: 100,
            height: 100,
            background: "radial-gradient(circle, rgba(80,200,120,0.18) 0%, rgba(14,86,245,0.12) 55%, transparent 80%)",
          }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating monogram */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10"
        >
          <AACMonogram size={72} className="text-emerald-400" />
        </motion.div>
      </div>

      {/* Hub labels */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-12 text-center">
        <p className="whitespace-nowrap font-sans text-base font-bold text-white">
          All Agent Connect
        </p>
        <p className="whitespace-nowrap font-mono text-xs font-light tracking-wide" style={{ color: "#94A3B8" }}>
          Private agent network
        </p>
      </div>
    </div>
  );
}
