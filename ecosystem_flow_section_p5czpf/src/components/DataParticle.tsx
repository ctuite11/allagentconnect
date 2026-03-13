import { motion } from "framer-motion";

interface DataParticleProps {
  delay?: number;
  duration?: number;
  direction?: "right" | "left";
}

export default function DataParticle({
  delay = 0,
  duration = 2,
  direction = "right",
}: DataParticleProps) {
  const isRight = direction === "right";

  return (
    <motion.div
      aria-hidden="true"
      className="absolute top-1/2 -translate-y-1/2 rounded-full"
      style={{
        width: 6,
        height: 6,
        background: isRight ? "hsl(217,90%,60%)" : "hsl(161,78%,45%)",
        left: isRight ? 0 : undefined,
        right: isRight ? undefined : 0,
      }}
      animate={{
        x: isRight ? [0, 64] : [0, -64],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
        times: [0, 0.2, 0.8, 1],
      }}
    />
  );
}