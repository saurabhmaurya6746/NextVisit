import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  generate: () => string; // placeholder text producer
  onUse: (message: string) => void;
  useLabel?: string;
}

export function AiGenerateDialog({
  open,
  onOpenChange,
  title = "AI-generated message",
  description = "Preview available — connect Gemini later to generate live.",
  generate,
  onUse,
  useLabel = "Use message",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setText("");
    const t = setTimeout(() => {
      setText(generate());
      setLoading(false);
    }, 900);
    return () => clearTimeout(t);
  }, [open, generate]);

  function regenerate() {
    setLoading(true);
    setTimeout(() => {
      setText(generate());
      setLoading(false);
    }, 700);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-display">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-2">
            {[92, 74, 88, 60].map((w, i) => (
              <motion.div
                key={i}
                className="h-3 rounded-full bg-muted"
                style={{ width: `${w}%` }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
            <p className="pt-2 text-center text-xs text-muted-foreground">Drafting a personalized message…</p>
          </div>
        ) : (
          <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" />
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" className="rounded-full" onClick={regenerate} disabled={loading}>
            <Wand2 className="mr-1.5 h-4 w-4" /> Regenerate
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="rounded-full gradient-brand text-primary-foreground"
              disabled={loading || !text.trim()}
              onClick={() => {
                onUse(text);
                onOpenChange(false);
              }}
            >
              {useLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}