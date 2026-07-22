import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: Props) {
  return (
    <Card className={cn("rounded-2xl border-dashed p-10 text-center", className)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mx-auto mb-4 grid h-20 w-20 place-items-center"
      >
        <div className="relative grid h-20 w-20 place-items-center">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/15 to-transparent blur-xl" />
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 text-primary shadow-elegant">
            {icon}
          </div>
        </div>
      </motion.div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}