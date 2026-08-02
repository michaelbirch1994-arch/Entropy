import { motion } from "framer-motion";

const LETTERS = "ENTROPY".split("");

// Fixed per-letter jitter (not randomized per-render) so each mount plays the
// same "stardust converging" pattern - letters drift in from alternating
// sides with a slight vertical scatter and a blur that resolves as they land.
const JITTER: { x: number; y: number; rotate: number }[] = [
  { x: -46, y: -14, rotate: -8 },
  { x: 38, y: 18, rotate: 6 },
  { x: -34, y: 16, rotate: -5 },
  { x: 44, y: -10, rotate: 7 },
  { x: -40, y: -8, rotate: -6 },
  { x: 30, y: 14, rotate: 5 },
  { x: -36, y: -16, rotate: -7 },
];

// A handful of drifting dust motes that fade in around the wordmark just
// before the letters resolve, reinforcing the "forming from stardust" feel.
const MOTES = [
  { left: "8%", top: "20%", delay: 0 },
  { left: "22%", top: "70%", delay: 0.08 },
  { left: "40%", top: "10%", delay: 0.05 },
  { left: "58%", top: "80%", delay: 0.12 },
  { left: "74%", top: "25%", delay: 0.03 },
  { left: "90%", top: "60%", delay: 0.1 },
];

export default function EntropyWordmarkReveal({ className = "" }: { className?: string }) {
  return (
    <h1 className={`relative ${className}`} aria-label="Entropy">
      {MOTES.map((m, i) => (
        <motion.span
          key={`mote-${i}`}
          className="absolute w-1 h-1 rounded-full bg-amber-300 pointer-events-none"
          style={{ left: m.left, top: m.top }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1.4, 0.6] }}
          transition={{ duration: 0.9, delay: m.delay, ease: "easeOut" }}
        />
      ))}
      <span aria-hidden="true">
        {LETTERS.map((char, i) => {
          const j = JITTER[i % JITTER.length];
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: j.x, y: j.y, rotate: j.rotate, filter: "blur(8px)" }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.65, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "inline-block" }}
            >
              {char}
            </motion.span>
          );
        })}
      </span>
    </h1>
  );
}
