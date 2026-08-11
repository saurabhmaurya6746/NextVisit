import { createFileRoute } from "@/lib/route-compat";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { PageTransition } from "@/components/page-transition";
import {
  Send,
  MessageCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Zap,
  Clock,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Loader2,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import {
  listCampaignsApi,
  createCampaignApi,
  updateCampaignApi,
  deleteCampaignApi,
  generateCampaignAudienceApi,
  listPendingLogsApi,
  listSentLogsApi,
  listFailedLogsApi,
  markLogSentApi,
  markLogFailedApi,
  generateCampaignMessageWithGemini,
  type CampaignModel,
  type CampaignLogItem,
} from "@/lib/campaigns-api";
import { openWhatsApp } from "@/lib/celebration-utils";

export const Route = createFileRoute("/app/$type/$business/whatsapp-campaigns")({ component: WhatsAppPage });

export default function WhatsAppPage() {
  // 1. ALL HOOKS CALLED UNCONDITIONALLY AT TOP LEVEL
  const [campaignsList, setCampaignsList] = useState<CampaignModel[]>([]);
  const [pendingLogs, setPendingLogs] = useState<CampaignLogItem[]>([]);
  const [sentLogs, setSentLogs] = useState<CampaignLogItem[]>([]);
  const [failedLogs, setFailedLogs] = useState<CampaignLogItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Campaign Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState("BIRTHDAY");
  const [cSegment, setCSegment] = useState("ALL_CUSTOMERS");
  const [cTitle, setCTitle] = useState("");
  const [cDiscount, setCDiscount] = useState("20% OFF");
  const [cMessage, setCMessage] = useState("Happy Birthday {{customer_name}}! 🎉 Enjoy {{discount}} on your next visit. See you soon! ❤️");
  const [creating, setCreating] = useState(false);
  const [generatingCreateAi, setGeneratingCreateAi] = useState(false);

  // Edit Campaign Modal State
  const [editCampaign, setEditCampaign] = useState<CampaignModel | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("BIRTHDAY");
  const [editSegment, setEditSegment] = useState("ALL_CUSTOMERS");
  const [editTitle, setEditTitle] = useState("");
  const [editDiscount, setEditDiscount] = useState("20% OFF");
  const [editMessage, setEditMessage] = useState("");
  const [updating, setUpdating] = useState(false);
  const [generatingEditAi, setGeneratingEditAi] = useState(false);

  // Delete Campaign Confirm Modal State
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Audience Generation Loading State
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Log status action loading
  const [processingLogId, setProcessingLogId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cData, pLogs, sLogs, fLogs] = await Promise.all([
        listCampaignsApi(),
        listPendingLogsApi().catch(() => []),
        listSentLogsApi().catch(() => []),
        listFailedLogsApi().catch(() => []),
      ]);
      setCampaignsList(cData);
      setPendingLogs(pLogs);
      setSentLogs(sLogs);
      setFailedLogs(fLogs);
    } catch (err: any) {
      console.error("[CAMPAIGNS] Error loading campaigns & logs:", err);
      setError(err.message || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Gemini AI Generator Handlers
  const handleGenerateCreateAiMessage = async () => {
    setGeneratingCreateAi(true);
    try {
      const aiText = await generateCampaignMessageWithGemini(cType, cTitle, cDiscount);
      setCMessage(aiText);
      toast.success("✨ New AI Message variation generated!");
    } catch (err: any) {
      console.error("[GEMINI AI] Error generating message:", err);
      toast.error("Failed to generate AI message.");
    } finally {
      setGeneratingCreateAi(false);
    }
  };

  const handleGenerateEditAiMessage = async () => {
    setGeneratingEditAi(true);
    try {
      const aiText = await generateCampaignMessageWithGemini(editType, editTitle, editDiscount);
      setEditMessage(aiText);
      toast.success("✨ New AI Message variation generated!");
    } catch (err: any) {
      console.error("[GEMINI AI] Error generating message:", err);
      toast.error("Failed to generate AI message.");
    } finally {
      setGeneratingEditAi(false);
    }
  };

  // Create Campaign Handler
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cTitle.trim() || !cMessage.trim()) {
      toast.error("Please fill in all required campaign fields.");
      return;
    }

    setCreating(true);
    try {
      await createCampaignApi({
        name: cName.trim(),
        campaign_type: cType,
        target_segment: cSegment,
        title: cTitle.trim(),
        message: cMessage.trim(),
        is_active: true,
      });
      toast.success("New campaign created successfully!");
      setCreateOpen(false);
      setCName("");
      setCTitle("");
      setCDiscount("20% OFF");
      setCMessage("Happy Birthday {{customer_name}}! 🎉 Enjoy {{discount}} on your next visit. See you soon! ❤️");
      await loadData();
    } catch (err: any) {
      console.error("[CAMPAIGNS] Create error:", err);
      toast.error(err.message || "Failed to create campaign.");
    } finally {
      setCreating(false);
    }
  };

  // Edit Campaign Handlers
  const handleOpenEdit = (c: CampaignModel) => {
    setEditCampaign(c);
    setEditName(c.name);
    setEditType(c.campaign_type);
    setEditSegment(c.target_segment);
    setEditTitle(c.title);
    setEditDiscount("20% OFF");
    setEditMessage(c.message);
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCampaign) return;

    setUpdating(true);
    try {
      await updateCampaignApi(editCampaign.id, {
        name: editName.trim(),
        campaign_type: editType,
        target_segment: editSegment,
        title: editTitle.trim(),
        message: editMessage.trim(),
      });
      toast.success("Campaign updated successfully!");
      setEditCampaign(null);
      await loadData();
    } catch (err: any) {
      console.error("[CAMPAIGNS] Update error:", err);
      toast.error(err.message || "Failed to update campaign.");
    } finally {
      setUpdating(false);
    }
  };

  // Delete Campaign Handler
  const handleDeleteCampaign = async () => {
    if (!deleteCampaignId) return;

    setDeleting(true);
    try {
      await deleteCampaignApi(deleteCampaignId);
      toast.success("Campaign deleted successfully!");
      setDeleteCampaignId(null);
      await loadData();
    } catch (err: any) {
      console.error("[CAMPAIGNS] Delete error:", err);
      toast.error(err.message || "Failed to delete campaign.");
    } finally {
      setDeleting(false);
    }
  };

  // Generate Campaign Audience Logs
  const handleGenerateAudience = async (campaignId: string) => {
    setGeneratingId(campaignId);
    try {
      const res = await generateCampaignAudienceApi(campaignId);
      toast.success(
        `Audience evaluated! Found ${res.customers_found} customers, created ${res.logs_created} pending messages.`
      );
      await loadData();
    } catch (err: any) {
      console.error("[CAMPAIGNS] Generate audience error:", err);
      toast.error(err.message || "Failed to generate campaign audience.");
    } finally {
      setGeneratingId(null);
    }
  };

  // Log Execution Queue Handlers
  const handleMarkSent = async (log: CampaignLogItem) => {
    setProcessingLogId(log.id);
    try {
      await markLogSentApi(log.id);
      toast.success(`Message to ${log.customer_name} marked as SENT.`);
      await loadData();
    } catch (err: any) {
      console.error("[LOGS] Mark sent error:", err);
      toast.error(err.message || "Failed to mark log as SENT.");
    } finally {
      setProcessingLogId(null);
    }
  };

  const handleMarkFailed = async (log: CampaignLogItem) => {
    setProcessingLogId(log.id);
    try {
      await markLogFailedApi(log.id, "Manually marked failed by user");
      toast.success(`Message to ${log.customer_name} marked as FAILED.`);
      await loadData();
    } catch (err: any) {
      console.error("[LOGS] Mark failed error:", err);
      toast.error(err.message || "Failed to mark log as FAILED.");
    } finally {
      setProcessingLogId(null);
    }
  };

  const handleSendViaWhatsAppWeb = (log: CampaignLogItem) => {
    openWhatsApp(log.customer_phone, log.message);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="WhatsApp & Campaign Engine" description="Loading campaigns and delivery queues..." />
        <Card className="rounded-2xl p-6">
          <SkeletonRows rows={5} cols={4} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="WhatsApp & Campaign Engine" description="Marketing campaigns and message execution queues." />
        <EmptyState
          title="Failed to load campaigns"
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
        title="WhatsApp & Campaign Engine"
        description="Design targeted segment campaigns and manage message delivery queues."
        actions={
          <Button
            size="sm"
            className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Create Campaign
          </Button>
        }
      />

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="rounded-full p-1 bg-muted/50 border">
          <TabsTrigger value="campaigns" className="rounded-full text-xs font-semibold px-4">
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Campaigns ({campaignsList.length})
          </TabsTrigger>
          <TabsTrigger value="queue" className="rounded-full text-xs font-semibold px-4">
            <Clock className="mr-1.5 h-3.5 w-3.5" /> Pending Queue ({pendingLogs.length})
          </TabsTrigger>
          <TabsTrigger value="sent" className="rounded-full text-xs font-semibold px-4">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Sent History ({sentLogs.length})
          </TabsTrigger>
          <TabsTrigger value="failed" className="rounded-full text-xs font-semibold px-4">
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Failed Logs ({failedLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Campaigns Roster */}
        <TabsContent value="campaigns" className="space-y-4">
          {campaignsList.length === 0 ? (
            <EmptyState
              title="No campaigns found"
              description="Create your first marketing campaign to reach your target customer segment."
              icon={<MessageCircle className="h-8 w-8 text-muted-foreground" />}
              action={
                <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Create Campaign
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaignsList.map((c) => (
                <Card key={c.id} className="rounded-2xl transition-all hover:shadow-glow flex flex-col justify-between">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-base">{c.name}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Badge variant="secondary" className="rounded-full text-[10px] uppercase font-mono">
                            {c.campaign_type}
                          </Badge>
                          <Badge variant="outline" className="rounded-full text-[10px] uppercase font-mono">
                            {c.target_segment}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                          onClick={() => handleOpenEdit(c)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full"
                          onClick={() => setDeleteCampaignId(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border p-3 bg-muted/20 text-xs">
                      <p className="font-semibold text-foreground">{c.title}</p>
                      <p className="mt-1 text-muted-foreground line-clamp-3 font-mono">{c.message}</p>
                    </div>

                    <Button
                      size="sm"
                      className="w-full rounded-full gradient-brand text-primary-foreground"
                      disabled={generatingId === c.id}
                      onClick={() => handleGenerateAudience(c.id)}
                    >
                      <Zap className="mr-1.5 h-3.5 w-3.5" />
                      {generatingId === c.id ? "Evaluating Segment..." : "Generate Audience Queue"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Pending Execution Queue */}
        <TabsContent value="queue" className="space-y-4">
          {pendingLogs.length === 0 ? (
            <EmptyState
              title="Pending queue is empty"
              description="No messages waiting in the delivery queue. Click 'Generate Audience Queue' on any active campaign to populate this queue."
              icon={<CheckCircle2 className="h-8 w-8 text-success" />}
            />
          ) : (
            <div className="space-y-3">
              {pendingLogs.map((log) => (
                <Card key={log.id} className="rounded-2xl">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{log.customer_name}</p>
                        <Badge variant="outline" className="rounded-full text-[10px] font-mono">
                          {log.customer_phone}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full text-[10px] font-mono">
                          {log.campaign_name}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground bg-muted/40 p-2.5 rounded-xl whitespace-pre-wrap">
                        {log.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs border-success/40 text-success hover:bg-success/10"
                        onClick={() => handleSendViaWhatsAppWeb(log)}
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        disabled={processingLogId === log.id}
                        className="rounded-full gradient-brand text-primary-foreground text-xs"
                        onClick={() => handleMarkSent(log)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Sent
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={processingLogId === log.id}
                        className="rounded-full text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => handleMarkFailed(log)}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Mark Failed
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Sent History */}
        <TabsContent value="sent" className="space-y-3">
          {sentLogs.length === 0 ? (
            <EmptyState title="No sent logs yet" description="Delivered messages will appear here once marked as SENT." icon={<Send className="h-8 w-8 text-muted-foreground" />} />
          ) : (
            <div className="space-y-3">
              {sentLogs.map((log) => (
                <Card key={log.id} className="rounded-2xl">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm">{log.customer_name} ({log.customer_phone})</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{log.campaign_name} · Sent at: {log.sent_at ? new Date(log.sent_at).toLocaleString() : "Recently"}</p>
                    </div>
                    <Badge variant="outline" className="border-success/40 text-success rounded-full">SENT</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Failed Logs */}
        <TabsContent value="failed" className="space-y-3">
          {failedLogs.length === 0 ? (
            <EmptyState title="No failed logs" description="All campaign deliveries are operating cleanly." icon={<CheckCircle2 className="h-8 w-8 text-success" />} />
          ) : (
            <div className="space-y-3">
              {failedLogs.map((log) => (
                <Card key={log.id} className="rounded-2xl border-destructive/30">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm">{log.customer_name} ({log.customer_phone})</p>
                      <p className="text-xs text-destructive mt-0.5">Reason: {log.failure_reason || "Marked failed by user"}</p>
                    </div>
                    <Badge variant="outline" className="border-destructive/40 text-destructive rounded-full">FAILED</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Campaign Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Create New Campaign
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Campaign Name *</Label>
              <Input id="c-name" placeholder="e.g. Birthday Special Promo" value={cName} onChange={(e) => setCName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-type">Campaign Type *</Label>
                <Select value={cType} onValueChange={setCType}>
                  <SelectTrigger id="c-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIRTHDAY">BIRTHDAY</SelectItem>
                    <SelectItem value="ANNIVERSARY">ANNIVERSARY</SelectItem>
                    <SelectItem value="WELCOME">WELCOME</SelectItem>
                    <SelectItem value="RECOVERY">RECOVERY</SelectItem>
                    <SelectItem value="FESTIVAL">FESTIVAL</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="CUSTOM">CUSTOM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-segment">Target Segment *</Label>
                <Select value={cSegment} onValueChange={setCSegment}>
                  <SelectTrigger id="c-segment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_CUSTOMERS">ALL_CUSTOMERS</SelectItem>
                    <SelectItem value="VIP_CUSTOMERS">VIP_CUSTOMERS</SelectItem>
                    <SelectItem value="NEW_CUSTOMERS">NEW_CUSTOMERS</SelectItem>
                    <SelectItem value="INACTIVE_15">INACTIVE_15 (15+ Days)</SelectItem>
                    <SelectItem value="INACTIVE_30">INACTIVE_30 (30+ Days)</SelectItem>
                    <SelectItem value="INACTIVE_60">INACTIVE_60 (60+ Days)</SelectItem>
                    <SelectItem value="INACTIVE_90">INACTIVE_90 (90+ Days)</SelectItem>
                    <SelectItem value="BIRTHDAY_TODAY">BIRTHDAY_TODAY</SelectItem>
                    <SelectItem value="ANNIVERSARY_TODAY">ANNIVERSARY_TODAY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-title">Offer Title / Subject *</Label>
                <Input id="c-title" placeholder="e.g. Enjoy 20% off your next visit!" value={cTitle} onChange={(e) => setCTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-discount">Discount / Offer Value (Optional)</Label>
                <div className="relative">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="c-discount" className="pl-9" placeholder="e.g. 20% OFF, ₹150 OFF" value={cDiscount} onChange={(e) => setCDiscount(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="c-msg">Message Content *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={generatingCreateAi}
                  className="h-7 text-xs rounded-full border-primary/40 text-primary hover:bg-primary/10"
                  onClick={handleGenerateCreateAiMessage}
                >
                  {generatingCreateAi ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1 h-3 w-3" /> ✨ Generate AI Message
                    </>
                  )}
                </Button>
              </div>
              <Textarea id="c-msg" rows={4} value={cMessage} onChange={(e) => setCMessage(e.target.value)} required />
              <p className="text-[11px] text-muted-foreground">Placeholders: <code>{"{{customer_name}}"}</code>, <code>{"{{discount}}"}</code></p>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating} className="rounded-full gradient-brand text-primary-foreground">
                {creating ? "Creating..." : "Create Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Modal */}
      <Dialog open={!!editCampaign} onOpenChange={(o) => !o && setEditCampaign(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" /> Edit Campaign
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCampaign} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cname">Campaign Name</Label>
              <Input id="edit-cname" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-ctype">Campaign Type</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger id="edit-ctype"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIRTHDAY">BIRTHDAY</SelectItem>
                    <SelectItem value="ANNIVERSARY">ANNIVERSARY</SelectItem>
                    <SelectItem value="WELCOME">WELCOME</SelectItem>
                    <SelectItem value="RECOVERY">RECOVERY</SelectItem>
                    <SelectItem value="FESTIVAL">FESTIVAL</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="CUSTOM">CUSTOM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-csegment">Target Segment</Label>
                <Select value={editSegment} onValueChange={setEditSegment}>
                  <SelectTrigger id="edit-csegment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_CUSTOMERS">ALL_CUSTOMERS</SelectItem>
                    <SelectItem value="VIP_CUSTOMERS">VIP_CUSTOMERS</SelectItem>
                    <SelectItem value="NEW_CUSTOMERS">NEW_CUSTOMERS</SelectItem>
                    <SelectItem value="INACTIVE_15">INACTIVE_15</SelectItem>
                    <SelectItem value="INACTIVE_30">INACTIVE_30</SelectItem>
                    <SelectItem value="INACTIVE_60">INACTIVE_60</SelectItem>
                    <SelectItem value="INACTIVE_90">INACTIVE_90</SelectItem>
                    <SelectItem value="BIRTHDAY_TODAY">BIRTHDAY_TODAY</SelectItem>
                    <SelectItem value="ANNIVERSARY_TODAY">ANNIVERSARY_TODAY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-ctitle">Offer Title</Label>
                <Input id="edit-ctitle" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-cdiscount">Discount / Offer Value (Optional)</Label>
                <div className="relative">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="edit-cdiscount" className="pl-9" placeholder="e.g. 20% OFF, ₹150 OFF" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-cmsg">Message Content</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={generatingEditAi}
                  className="h-7 text-xs rounded-full border-primary/40 text-primary hover:bg-primary/10"
                  onClick={handleGenerateEditAiMessage}
                >
                  {generatingEditAi ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1 h-3 w-3" /> ✨ Generate AI Message
                    </>
                  )}
                </Button>
              </div>
              <Textarea id="edit-cmsg" rows={4} value={editMessage} onChange={(e) => setEditMessage(e.target.value)} required />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditCampaign(null)}>Cancel</Button>
              <Button type="submit" disabled={updating} className="rounded-full gradient-brand text-primary-foreground">
                {updating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Campaign Confirm Modal */}
      <Dialog open={!!deleteCampaignId} onOpenChange={(o) => !o && setDeleteCampaignId(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Campaign
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to delete this campaign? All associated pending logs and delivery records will be permanently removed.
          </div>
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDeleteCampaignId(null)}>Cancel</Button>
            <Button variant="destructive" className="rounded-full" disabled={deleting} onClick={handleDeleteCampaign}>
              {deleting ? "Deleting..." : "Delete Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}