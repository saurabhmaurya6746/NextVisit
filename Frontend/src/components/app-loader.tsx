import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function AppLoader({
  logo,
  emoji,
  name,
  minDuration = 2000,
  onDone,
}: {
  logo?: string;
  emoji: string;
  name: string;
  minDuration?: number;
  onDone?: () => void;
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
    }, 60);
    return () => clearInterval(tick);
  }, [minDuration]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
        >
          <div className="relative flex flex-col items-center">
            <div className="relative grid place-items-center">
              {[0, 0.6, 1.2].map((delay, i) => (
                <motion.span
                  key={i}
                  className="absolute h-28 w-28 rounded-full border-2 border-primary/40"
                  initial={{ scale: 0.6, opacity: 0.6 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
                />
              ))}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="relative grid h-28 w-28 place-items-center rounded-full border border-border bg-card shadow-lg"
              >
                {logo ? (
                  <img src={logo} alt={name} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className="text-5xl leading-none">{emoji}</span>
                )}
              </motion.div>
            </div>

            <motion.h2
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="mt-8 font-display text-xl font-semibold tracking-tight text-foreground"
            >
              {name}
            </motion.h2>
            <p className="mt-1 text-sm text-muted-foreground">Loading your workspace...</p>

            <div className="mt-6 w-64">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              </div>
              <div className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
                {progress}%
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Powered by</span>
            <BrandLogo />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}