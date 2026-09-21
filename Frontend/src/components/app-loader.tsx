import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function AppLoader({
  minDuration = 1800,
  onDone,
}: {
  minDuration?: number;
  onDone?: () => void;
  // Kept for backward compatibility if passed, but ignored for standardized NextVisit branding
  logo?: string;
  emoji?: string;
  name?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / minDuration) * 100));
      setProgress(pct);
      if (elapsed >= minDuration) {
        clearInterval(tick);
        setVisible(false);
        onDoneRef.current?.();
      }
    }, 50);
    return () => clearInterval(tick);
  }, [minDuration]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
        >
          <div className="relative flex flex-col items-center">
            {/* Animated Pulse Outer Ring */}
            <div className="relative grid place-items-center">
              {[0, 0.6, 1.2].map((delay, i) => (
                <motion.span
                  key={i}
                  className="absolute h-28 w-28 rounded-full border-2 border-primary/30"
                  initial={{ scale: 0.6, opacity: 0.6 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
                />
              ))}

              {/* Standardized NextVisit Logo Container */}
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="relative grid h-24 w-24 place-items-center rounded-2xl border border-primary/20 bg-card p-4 shadow-xl gradient-brand-subtle"
              >
                <BrandLogo showText={false} />
              </motion.div>
            </div>

            {/* Standardized Branding Header */}
            <motion.h2
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground"
            >
              NextVisit
            </motion.h2>

            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-primary">
              Business Growth Platform
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Loading NextVisit...
            </p>

            {/* Progress Bar */}
            <div className="mt-6 w-64">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.05 }}
                />
              </div>
              <div className="mt-2 text-right text-xs tabular-nums text-muted-foreground font-mono">
                {progress}%
              </div>
            </div>
          </div>

          {/* Footer Branding */}
          <div className="absolute bottom-8 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Powered by</span>
            <BrandLogo />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}