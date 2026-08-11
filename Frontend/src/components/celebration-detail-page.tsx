import { AppLink } from "@/lib/app-nav";
import { motion } from "framer-motion";
import { Cake, Gift, Phone, MessageCircle, Sparkles, Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { CampaignSendModal } from "@/components/campaign-send-modal";
import { EmptyState } from "@/components/empty-state";
import { PageTransition } from "@/components/page-transition";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth";
import {
  couponFor,
  formatDateLabel,
  groupByDate,
  messageFor,
  openWhatsApp,
  sendWhatsAppWithStatusTracking,
  type Bucket,
  type Kind,
} from "@/lib/celebration-utils";

interface Props {
  kind: Kind;
  bucket: Bucket;
}

export default function CelebrationDetailPage({ kind, bucket }: Props) {
  const params = useParams({ strict: false });
  const type = params.type || "restaurant";
  const business = params.business || "my-business";

  const [aiFor, setAiFor] = useState<any | null>(null);
  const [sendCampaignOpen, setSendCampaignOpen] = useState(false);
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const isBday = kind === "birthday";
  const emoji = isBday ? "🎂" : "❤️";
  const listEndpoint = isBday ? "/api/v1/customers/birthday-list" : "/api/v1/customers/anniversary-list";

  // Fetch real database celebration customer list with server-side pagination
  const { data: celData, isLoading, refetch } = useQuery({
    queryKey: [isBday ? "birthday-list" : "anniversary-list", bucket, page, search, sortBy, sortOrder],
    queryFn: async () => {
      const query = new URLSearchParams({
        bucket,
        page: page.toString(),
        page_size: "20",
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      if (search ? search.trim() : "") query.append("search", search.trim());

      const res = await apiFetch(`${listEndpoint}?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch celebration customer list");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const list = celData?.items ?? [];
  const totalItems = celData?.total_items ?? 0;
  const totalPages = celData?.total_pages ?? 1;

  const titleMap = {
    today: isBday ? "Today's Birthdays" : "Today's Anniversaries",
    tomorrow: isBday ? "Tomorrow's Birthdays" : "Tomorrow's Anniversaries",
    week: isBday ? "This Week Birthdays" : "This Week Anniversaries",
    month: isBday ? "This Month Birthdays" : "This Month Anniversaries",
  } as const;

  const descMap = {
    today: `${emoji} Reach out to ${totalItems} guest${totalItems === 1 ? "" : "s"} celebrating today.`,
    tomorrow: `${emoji} Prepare tomorrow's outreach — ${totalItems} guest${totalItems === 1 ? "" : "s"}.`,
    week: `${emoji} ${totalItems} guest${totalItems === 1 ? "" : "s"} in the next 7 days.`,
    month: `${emoji} ${totalItems} guest${totalItems === 1 ? "" : "s"} in the next 30 days.`,
  } as const;

  const campaignPath = isBday ? "birthday-campaigns" : "anniversary-campaigns";
  const backHref = `/app/${type}/${business}/${campaignPath}`;

  async function handleSend(c: any) {
    const msg = customMessages[c.id] ?? messageFor(kind, c.name);
    await sendWhatsAppWithStatusTracking({
      customerId: c.id,
      customerPhone: c.phone,
      message: msg,
      campaignType: isBday ? "BIRTHDAY" : "ANNIVERSARY",
      onSuccess: () => refetch(),
    });
  }

  const grouped = groupByDate(list, kind);

  return (
    <PageTransition>
      <PageHeader
        title={titleMap[bucket]}
        description={descMap[bucket]}
        actions={
          <div className="flex items-center gap-2">
            <Link to={backHref}>
              <Button variant="outline" className="rounded-full text-xs">
                Back to Overview
              </Button>
            </Link>

            <Button
              className="rounded-full bg-primary text-primary-foreground font-semibold text-xs px-4"
              disabled={list.length === 0}
              onClick={() => setSendCampaignOpen(true)}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Launch {isBday ? "Birthday" : "Anniversary"} Campaign ({list.length})
            </Button>
          </div>
        }
      />

      {/* SEARCH AND SORT BAR */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-full pl-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full text-xs"
            onClick={() => {
              setSortBy((s) => (s === "name" ? "date" : "name"));
              setPage(1);
            }}
          >
            <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            Sort: {sortBy === "name" ? "Name" : "Date"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full text-xs"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
          >
            {sortOrder.toUpperCase()}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading celebration customers…</div>
      ) : list.length === 0 ? (
        <EmptyState
          title={isBday ? "No birthday customers found" : "No anniversary customers found"}
          description="Check back soon — customer special dates update automatically."
          icon={isBday ? <Cake className="h-7 w-7" /> : <Gift className="h-7 w-7" />}
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([dateKey, group]) => (
            <div key={dateKey ?? "all"}>
              {dateKey && (
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-display text-lg font-semibold">{formatDateLabel(dateKey)}</h2>
                  <div className="h-px flex-1 bg-border" />
                  <Badge variant="outline" className="rounded-full">{group.length} guest{group.length === 1 ? "" : "s"}</Badge>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((c: any, i: number) => (
                  <CelebrantCard
                    key={c.id}
                    c={c}
                    index={i}
                    kind={kind}
                    bucket={bucket}
                    customMessage={customMessages[c.id]}
                    onSetMessage={(m) => setCustomMessages((prev) => ({ ...prev, [c.id]: m }))}
                    onOpenAi={() => setAiFor(c)}
                    onSend={() => handleSend(c)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* SERVER SIDE PAGINATION BAR */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <p>Showing Page {page} of {totalPages} ({totalItems} total customers)</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI GENERATE DIALOG WITH ALL CONTROLS */}
      {aiFor && (
        <AiGenerateDialog
          open={!!aiFor}
          onOpenChange={(o) => !o && setAiFor(null)}
          title={`AI ${isBday ? "Birthday" : "Anniversary"} Wish Generator`}
          description={aiFor ? `Generating Gemini AI wish for ${aiFor.name}` : ""}
          customerId={aiFor.id}
          campaignType={kind}
          couponCode={couponFor(kind)}
          discountPercent="20%"
          onUse={(m) => {
            setCustomMessages((prev) => ({ ...prev, [aiFor.id]: m }));
            toast.success("AI wish template applied!");
          }}
        />
      )}

      {/* MULTI-CUSTOMER WHATSAPP SEND MODAL WITH RESUME STATE & LOGS */}
      <CampaignSendModal
        open={sendCampaignOpen}
        onOpenChange={setSendCampaignOpen}
        campaignId={`${kind}_campaign_${bucket}`}
        campaignTitle={`${isBday ? "Birthday" : "Anniversary"} Campaign (${titleMap[bucket]})`}
        campaignType={kind}
        templateMessage={`Hi {name}! ${isBday ? "🎂 Happy Birthday!" : "💖 Happy Anniversary!"} Celebrate with us — use coupon {coupon} for {discount} on your special meal ❤️`}
        couponCode={couponFor(kind)}
        discountPercent="20%"
        customers={list}
        onComplete={() => refetch()}
      />
    </PageTransition>
  );
}

function CelebrantCard({
  c,
  index,
  kind,
  bucket,
  customMessage,
  onSetMessage,
  onOpenAi,
  onSend,
}: {
  c: any;
  index: number;
  kind: Kind;
  bucket: Bucket;
  customMessage?: string;
  onSetMessage: (m: string) => void;
  onOpenAi: () => void;
  onSend: () => void;
}) {
  const isBday = kind === "birthday";
  const coupon = couponFor(kind);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ y: -2 }}
    >
      <Card className="overflow-hidden rounded-2xl border transition-all hover:shadow-glow bg-card">
        <div className="h-1.5 gradient-brand" />
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {c.name ? c.name.slice(0, 2).toUpperCase() : "CU"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold hover:text-primary block text-xs">
                {c.name}
              </AppLink>
              <p className="text-[11px] text-muted-foreground font-mono">{c.phone}</p>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="outline" className="rounded-full font-mono text-[10px]">
                {coupon}
              </Badge>
              <Badge variant="secondary" className={`rounded-full text-[9px] ${c.status === "Sent" ? "bg-emerald-500/10 text-emerald-600 font-semibold" : ""}`}>
                {c.status || "Pending"}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {customMessage ?? messageFor(kind, c.name)}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button size="sm" className="h-7 rounded-full bg-primary text-primary-foreground text-xs font-medium" onClick={onSend}>
              <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={onOpenAi}>
              <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Wish
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full ml-auto" onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}>
              <Phone className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}