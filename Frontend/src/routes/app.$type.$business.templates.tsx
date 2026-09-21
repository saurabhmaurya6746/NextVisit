import { createFileRoute } from "@/lib/route-compat";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { PageTransition } from "@/components/page-transition";
import { MessageSquare, Save, Play, RefreshCw, AlertTriangle, Eye, Zap, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  listMessageTemplatesApi,
  updateMessageTemplateApi,
  previewMessageTemplateApi,
  listAutomationRulesApi,
  updateAutomationRuleApi,
  runAllAutomationApi,
  runAutomationByCampaignTypeApi,
  type MessageTemplateModel,
  type AutomationRuleModel,
} from "@/lib/templates-api";

export const Route = createFileRoute("/app/$type/$business/templates")({ component: TemplatesPage });

export default function TemplatesPage() {
  // 1. ALL HOOKS CALLED UNCONDITIONALLY AT TOP LEVEL
  const [templates, setTemplates] = useState<MessageTemplateModel[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRuleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Template Editing State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>({});
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  // Live Preview State
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  // Automation Engine Running State
  const [runningAll, setRunningAll] = useState(false);
  const [runningCampaignType, setRunningCampaignType] = useState<string | null>(null);
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tData, aData] = await Promise.all([
        listMessageTemplatesApi(),
        listAutomationRulesApi(),
      ]);
      setTemplates(tData);
      setAutomationRules(aData);

      // Pre-fill initial draft messages
      const initialDrafts: Record<string, string> = {};
      tData.forEach((t) => {
        initialDrafts[t.id] = t.message;
      });
      setDraftMessages(initialDrafts);
    } catch (err: any) {
      console.error("[TEMPLATES] Error loading data:", err);
      setError(err.message || "Failed to load message templates & automations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate Live Preview for a template
  const handlePreview = async (t: MessageTemplateModel) => {
    const currentMessage = draftMessages[t.id] ?? t.message;
    setPreviewingId(t.id);
    try {
      const res = await previewMessageTemplateApi({
        template_id: t.id,
        campaign_type: t.campaign_type,
        message_override: currentMessage,
        discount: 20,
        points: 150,
      });
      setPreviews((prev) => ({ ...prev, [t.id]: res.preview_message }));
    } catch (err: any) {
      console.error("[TEMPLATES] Preview error:", err);
      toast.error("Failed to generate live preview.");
    } finally {
      setPreviewingId(null);
    }
  };

  // Save Message Template
  const handleSaveTemplate = async (t: MessageTemplateModel) => {
    const updatedMsg = draftMessages[t.id];
    if (!updatedMsg?.trim()) {
      toast.error("Template message content cannot be empty.");
      return;
    }

    setSavingTemplateId(t.id);
    try {
      const updated = await updateMessageTemplateApi(t.id, {
        message: updatedMsg,
      });
      setTemplates((prev) => prev.map((item) => (item.id === t.id ? updated : item)));
      toast.success(`${t.template_name} updated successfully!`);
    } catch (err: any) {
      console.error("[TEMPLATES] Save error:", err);
      toast.error(err.message || "Failed to save template.");
    } finally {
      setSavingTemplateId(null);
    }
  };

  // Update Automation Rule Enable / Disable toggle
  const handleToggleAutomationRule = async (rule: AutomationRuleModel, isEnabled: boolean) => {
    setUpdatingRuleId(rule.id);
    try {
      const updated = await updateAutomationRuleApi(rule.id, {
        is_enabled: isEnabled,
      });
      setAutomationRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      toast.success(
        `Automation rule for ${rule.campaign_type} ${isEnabled ? "enabled" : "disabled"}.`
      );
    } catch (err: any) {
      console.error("[AUTOMATION] Toggle error:", err);
      toast.error(err.message || "Failed to update automation rule.");
    } finally {
      setUpdatingRuleId(null);
    }
  };

  // Run All Automations
  const handleRunAllAutomation = async () => {
    setRunningAll(true);
    try {
      const res = await runAllAutomationApi();
      toast.success(
        `Processed ${res.campaigns_processed} campaigns and created ${res.total_logs_created} message logs!`
      );
      await loadData();
    } catch (err: any) {
      console.error("[AUTOMATION] Run all error:", err);
      toast.error(err.message || "Failed to run automation engine.");
    } finally {
      setRunningAll(false);
    }
  };

  // Run Single Campaign Automation
  const handleRunCampaignAutomation = async (campaignType: string) => {
    setRunningCampaignType(campaignType);
    try {
      const res = await runAutomationByCampaignTypeApi(campaignType);
      toast.success(
        `Evaluated ${campaignType} automation: ${res.total_logs_created} logs created.`
      );
      await loadData();
    } catch (err: any) {
      console.error("[AUTOMATION] Run campaign error:", err);
      toast.error(err.message || "Failed to run campaign automation.");
    } finally {
      setRunningCampaignType(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Templates & Automation Engine" description="Loading templates..." />
        <Card className="rounded-2xl p-6">
          <SkeletonRows rows={6} cols={3} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Templates & Automation Engine" description="Automated WhatsApp & SMS messaging engine." />
        <EmptyState
          title="Error loading templates & automation"
          description={error}
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          action={
            <Button variant="outline" className="rounded-full" onClick={loadData}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title="Templates & Automation Engine"
        description="Configure automated messaging rules, customized template wording, and live previews."
        actions={
          <Button
            size="sm"
            disabled={runningAll}
            className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            onClick={handleRunAllAutomation}
          >
            <Play className="mr-1.5 h-4 w-4" /> {runningAll ? "Running..." : "Run All Automations"}
          </Button>
        }
      />

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="rounded-full p-1 bg-muted/50 border">
          <TabsTrigger value="templates" className="rounded-full text-xs font-semibold px-4">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Message Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="automation" className="rounded-full text-xs font-semibold px-4">
            <Zap className="mr-1.5 h-3.5 w-3.5" /> Automation Rules ({automationRules.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Message Templates */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((t) => {
              const currentDraft = draftMessages[t.id] ?? t.message;
              const isDirty = currentDraft !== t.message;
              const livePreview = previews[t.id];

              return (
                <Card key={t.id} className="rounded-2xl transition-all hover:shadow-glow flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="font-display flex items-center gap-2 text-base">
                          <MessageSquare className="h-4 w-4 text-primary" /> {t.template_name}
                          {isDirty && (
                            <Badge variant="outline" className="rounded-full text-[10px] border-warning/40 text-warning-foreground">
                              Unsaved
                            </Badge>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground uppercase font-mono mt-0.5">{t.campaign_type}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs"
                        disabled={previewingId === t.id}
                        onClick={() => handlePreview(t)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> {previewingId === t.id ? "Rendering..." : "Live Preview"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div>
                      <Textarea
                        rows={6}
                        value={currentDraft}
                        onChange={(e) => setDraftMessages({ ...draftMessages, [t.id]: e.target.value })}
                        className="font-mono text-xs rounded-xl"
                      />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Placeholders: <code>{"{{customer_name}}"}</code> · <code>{"{{business_name}}"}</code> · <code>{"{{discount}}"}</code> · <code>{"{{points}}"}</code>
                      </p>
                    </div>

                    {livePreview && (
                      <div className="rounded-xl border p-3 bg-muted/40 text-xs">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-primary" /> Rendered Output Preview:
                        </p>
                        <p className="font-sans text-foreground whitespace-pre-wrap">{livePreview}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        size="sm"
                        className="rounded-full gradient-brand text-primary-foreground"
                        disabled={savingTemplateId === t.id || !isDirty}
                        onClick={() => handleSaveTemplate(t)}
                      >
                        <Save className="mr-1.5 h-4 w-4" /> {savingTemplateId === t.id ? "Saving..." : "Save Template"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 2: Automation Rules */}
        <TabsContent value="automation" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {automationRules.map((rule) => (
              <Card key={rule.id} className="rounded-2xl transition-all hover:shadow-glow">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="rounded-full text-xs font-mono uppercase">
                      {rule.campaign_type}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`switch-${rule.id}`} className="text-xs">
                        {rule.is_enabled ? "Active" : "Disabled"}
                      </Label>
                      <Switch
                        id={`switch-${rule.id}`}
                        checked={rule.is_enabled}
                        disabled={updatingRuleId === rule.id}
                        onCheckedChange={(checked) => handleToggleAutomationRule(rule, checked)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className="text-muted-foreground flex justify-between">
                      <span>Schedule Type:</span> <strong className="text-foreground">{rule.schedule_type}</strong>
                    </p>
                    <p className="text-muted-foreground flex justify-between">
                      <span>Daily Run Time:</span> <strong className="text-foreground">{rule.run_time || "09:00 AM"}</strong>
                    </p>
                    <p className="text-muted-foreground flex justify-between">
                      <span>Last Triggered:</span>{" "}
                      <strong className="text-foreground font-mono">
                        {rule.last_run_at ? new Date(rule.last_run_at).toLocaleDateString() : "Never"}
                      </strong>
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-full text-xs"
                    disabled={runningCampaignType === rule.campaign_type || !rule.is_enabled}
                    onClick={() => handleRunCampaignAutomation(rule.campaign_type)}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5 text-primary" />
                    {runningCampaignType === rule.campaign_type ? "Executing..." : `Trigger ${rule.campaign_type}`}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}