import { motion } from "framer-motion";
import { ElementType } from "react";

interface InputCardProps {
  icon: ElementType;
  label: string;
  description: string;
  delay?: number;
}

export default function InputCard({
  icon: Icon,
  label,
  description,
  delay = 0,
}: InputCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-md border border-blue-energy/20 bg-gray-800/80 backdrop-blur-sm cursor-default"
      style={{ borderRadius: "12px" }}
    >
      {/* Content */}
      <div className="relative px-4 py-3">
        {/* Hover glow overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-md opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />

        {/* Hover sweep */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, hsl(217,90%,60%,0.08) 50%, transparent 100%)",
          }}
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />

        <div className="flex items-center gap-3">
          {/* Pulsing dot */}
          <div className="relative flex-shrink-0">
            <motion.div
              className="h-2 w-2 rounded-full bg-blue-energy"
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-blue-energy/10 border border-blue-energy/20 flex items-center justify-center flex-shrink-0">
              <Icon
                size={16}
                className="text-blue-energy"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <span className="font-sans text-sm font-medium text-primary-foreground block">
                {label}
              </span>
              <p className="font-sans text-xs font-light text-gray-300 truncate">{description}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
