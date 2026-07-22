import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Save, RotateCcw, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { PageTransition } from "@/components/page-transition";
import { useTemplates, templateMeta, type TemplateKey } from "@/lib/templates-store";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$type/$business/templates")({ component: TemplatesPage });

const order: TemplateKey[] = ["birthday", "anniversary", "recovery", "review", "festival", "welcome"];

function TemplatesPage() {
  const { templates, save, reset } = useTemplates();
  const [drafts, setDrafts] = useState<Record<TemplateKey, string | undefined>>({} as any);
  const [aiFor, setAiFor] = useState<TemplateKey | null>(null);

  function value(k: TemplateKey) {
    return drafts[k] ?? templates[k];
  }
  function setDraft(k: TemplateKey, v: string) {
    setDrafts((p) => ({ ...p, [k]: v }));
  }

  return (
    <PageTransition>
      <PageHeader
        title="Message templates"
        description="Edit the wording used across birthday, anniversary, recovery and review flows."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {order.map((k, i) => {
          const meta = templateMeta[k];
          const isDirty = drafts[k] !== undefined && drafts[k] !== templates[k];
          return (
            <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="rounded-2xl transition-all hover:shadow-glow">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="font-display flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" /> {meta.title}
                      {isDirty && <Badge variant="outline" className="ml-1 rounded-full text-[10px]">Unsaved</Badge>}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea rows={8} value={value(k)} onChange={(e) => setDraft(k, e.target.value)} className="font-mono text-xs" />
                  <p className="text-[11px] text-muted-foreground">
                    Placeholders: <code>{"{{name}}"}</code>{k === "review" && <> · <code>{"{{link}}"}</code></>}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setAiFor(k)}>
                      <Sparkles className="mr-1.5 h-4 w-4 text-primary" /> AI Improve
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => { reset(k); setDrafts((p) => ({ ...p, [k]: undefined })); toast("Reset to default"); }}
                      >
                        <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                        disabled={!isDirty}
                        onClick={() => { save(k, drafts[k]!); setDrafts((p) => ({ ...p, [k]: undefined })); toast.success("Template saved"); }}
                      >
                        <Save className="mr-1.5 h-4 w-4" /> Save
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title={aiFor ? `AI improve — ${templateMeta[aiFor].title}` : "AI"}
        description="Placeholder preview — Gemini integration lands with the backend."
        generate={() => aiFor ? improveDraft(value(aiFor), aiFor) : ""}
        onUse={(m) => {
          if (aiFor) setDraft(aiFor, m);
          toast.success("AI draft applied — remember to Save");
        }}
        useLabel="Use draft"
      />
    </PageTransition>
  );
}

function improveDraft(current: string, kind: TemplateKey) {
  const tone: Record<TemplateKey, string> = {
    birthday: "warmer, more celebratory",
    anniversary: "heartfelt, gratitude-first",
    recovery: "sincere, low-pressure",
    review: "friendly, one clear ask",
    festival: "festive, on-brand",
    welcome: "delighted, welcoming",
  };
  return `${current.trim()}\n\n— AI polish (${tone[kind]}): consider adding the customer's favourite dish and a short call to action at the end.`;
}