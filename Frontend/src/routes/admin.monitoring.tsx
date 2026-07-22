import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Clock, XCircle, Megaphone, UsersRound, Wallet, Activity, UserPlus, ShoppingBag, Send, LogIn } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClients, useActivity } from "@/lib/clients-store";

export const Route = createFileRoute("/admin/monitoring")({ component: Monitoring });

const iconFor: Record<string, any> = { signup: UserPlus, approval: LogIn, campaign: Send, order: ShoppingBag, login: LogIn };

function Monitoring() {
  const clients = useClients();
  const activity = useActivity();
  const activeTrials = clients.filter((c) => c.status === "trial" && !c.isTrialExpired).length;
  const expired = clients.filter((c) => c.status === "expired" || c.isTrialExpired).length;
  const activeCampaigns = clients.reduce((s, c) => s + (c.campaignsSent || 0), 0);
  const customers = clients.reduce((s, c) => s + c.customers, 0);
  const revenue = clients.reduce((s, c) => s + c.revenue, 0) * 83;

  return (
    <>
      <PageHeader title="Monitoring" description="Real-time platform health and activity." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Total clients" value={clients.length} icon={Users} accent="primary" index={0} />
        <StatCard label="Active trials" value={activeTrials} icon={Clock} accent="warning" index={1} />
        <StatCard label="Expired" value={expired} icon={XCircle} accent="destructive" index={2} />
        <StatCard label="Active campaigns" value={activeCampaigns} icon={Megaphone} accent="info" index={3} />
        <StatCard label="Total customers" value={customers.toLocaleString()} icon={UsersRound} accent="accent" index={4} />
        <StatCard label="Total revenue" value={`₹${revenue.toLocaleString("en-IN")}`} icon={Wallet} accent="primary" index={5} />
      </div>

      <Card className="mt-6 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="font-display flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent activity</CardTitle><p className="text-xs text-muted-foreground">Signups, campaigns and orders across all merchants</p></div>
          <Badge variant="secondary" className="rounded-full">{activity.length} events</Badge>
        </CardHeader>
        <CardContent className="divide-y">
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity yet. New signups, approvals and campaigns will show up here.</p>
          ) : activity.slice(0, 30).map((a) => {
            const Icon = iconFor[a.type] || Activity;
            const inner = (
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 text-sm">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                <div>
                  <p className="font-medium">{a.message}</p>
                  {a.business && <p className="text-xs text-muted-foreground">{a.business}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
              </div>
            );
            return a.clientId ? (
              <Link key={a.id} to="/admin/clients/$id" params={{ id: a.clientId }} className="block hover:bg-muted/40 rounded-lg px-2 -mx-2">{inner}</Link>
            ) : <div key={a.id} className="px-2 -mx-2">{inner}</div>;
          })}
        </CardContent>
      </Card>
    </>
  );
}