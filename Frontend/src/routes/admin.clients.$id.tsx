import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Send, ArrowUpRight, PauseCircle, Trash2, Store, LogIn, Cake, Gift, Utensils, Ticket, Star, ShoppingBag, Megaphone, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { customers, coupons, campaigns, reviews, revenueSeries, customerGrowthSeries } from "@/lib/sample-data";
import { getClientById } from "@/lib/clients-store";
import { toast } from "sonner";
import { useMenu } from "@/lib/menu-store";

export const Route = createFileRoute("/admin/clients/$id")({
  loader: ({ params }) => {
    const client = getClientById(params.id);
    if (!client) throw notFound();
    return { client };
  },
  component: ClientDetail,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p className="text-sm text-muted-foreground">This client could not be found.</p>
      <Button asChild variant="link"><Link to="/admin/clients">Back to clients</Link></Button>
    </div>
  ),
});

function ClientDetail() {
  const { client } = Route.useLoaderData();
  const menu = useMenu();
  // Deterministic demo metrics scaled by the client's own numbers so each business feels distinct
  const cust = client.customers;
  const totalOrders = Math.round(cust * 4.2);
  const totalRevenue = Math.round(cust * 1250);
  const todaysOrders = Math.max(4, Math.round(cust / 42));
  const activeTables = client.type === "Restaurant" ? Math.max(4, Math.round(cust / 96)) : 0;
  const pendingReviews = Math.max(1, Math.round(cust / 210));
  const activeCampaigns = campaigns.filter((c) => c.status !== "draft").length;
  const totalWhatsApp = Math.round(cust * 3.4);
  const revenueByMonth = revenueSeries.map((r) => ({ month: r.month, revenue: Math.round((r.revenue / 240) * (client.revenue || 40)) }));
  const growth = customerGrowthSeries.map((r, i) => ({ month: r.month, customers: Math.round((cust * (i + 1)) / customerGrowthSeries.length) }));
  const todaysBdays = 2, tomorrowsBdays = 3, weekBdays = 11;
  const todaysAnni = 1, tomorrowsAnni = 2;
  return (
    <>
      <Link to="/admin/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>
      <PageHeader
        title={client.business}
        description={`${client.id.toUpperCase()} · ${client.type} · ${client.city} · Owner ${client.owner}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => toast.success(`Logged in as ${client.owner} (demo)`) }><LogIn className="mr-1.5 h-4 w-4" /> Login as client</Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => toast.success("Password reset link sent")}><KeyRound className="mr-1.5 h-4 w-4" /> Reset password</Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => toast.success("Notification queued")}><Send className="mr-1.5 h-4 w-4" /> Send notification</Button>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => toast.success("Upgrade flow initiated")}><ArrowUpRight className="mr-1.5 h-4 w-4" /> Upgrade plan</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Last login" value={client.lastLogin ? new Date(client.lastLogin).toLocaleDateString() : "—"} icon={LogIn} accent="info" />
        <StatCard label="Campaigns sent" value={client.campaignsSent ?? 0} icon={Megaphone} accent="primary" />
        <StatCard label="Orders processed" value={(client.ordersProcessed ?? 0).toLocaleString()} icon={ShoppingBag} accent="accent" />
        <StatCard label={client.trialEnd ? (client.isTrialExpired ? "Trial" : "Trial ends in") : "Plan expiry"} value={client.trialEnd ? (client.isTrialExpired ? "Expired" : `${client.trialDaysRemaining}d`) : client.expiry} icon={Star} accent={client.isTrialExpired ? "destructive" : "warning"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Business information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow"><Store className="h-6 w-6" /></div>
              <div>
                <p className="font-semibold">{client.business}</p>
                <p className="text-xs text-muted-foreground">{client.type}</p>
              </div>
            </div>
            <Info label="Business ID" value={client.id.toUpperCase()} />
            <Info label="Owner" value={client.owner} />
            <Info label="Email" value={client.email} />
            <Info label="Phone" value={client.phone} />
            <Info label="Address" value={`${client.city} · India`} />
            <Info label="Plan" value={<Badge variant="outline" className="rounded-full">{client.plan}</Badge>} />
            <Info label="Status" value={<Badge className="rounded-full capitalize">{client.status}</Badge>} />
            <Info label="Expiry" value={client.expiry} />
            <Info label="Joined" value="2025-11-04" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Storage & usage</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="mb-1.5 flex justify-between"><span>Storage</span><span className="text-muted-foreground">4.2 / 20 GB</span></div>
              <Progress value={21} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between"><span>Customers</span><span className="text-muted-foreground">{client.customers} / ∞</span></div>
              <Progress value={64} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between"><span>WhatsApp credits</span><span className="text-muted-foreground">3,214 / 5,000</span></div>
              <Progress value={64} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total customers" value={cust.toLocaleString()} icon={Users} accent="primary" />
        <StatCard label="Active customers" value={Math.round(cust * 0.72).toLocaleString()} icon={Users} accent="accent" />
        <StatCard label="Total orders" value={totalOrders.toLocaleString()} icon={ShoppingBag} accent="info" />
        <StatCard label="Total revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} accent="warning" />
        {client.type === "Restaurant" && <StatCard label="Active tables" value={activeTables} icon={Store} accent="primary" />}
        <StatCard label="Today's orders" value={todaysOrders} icon={ShoppingBag} accent="accent" />
        <StatCard label="Pending reviews" value={pendingReviews} icon={Star} accent="warning" />
        <StatCard label="Active campaigns" value={activeCampaigns} icon={Megaphone} accent="info" />
        <StatCard label="Coupons created" value={coupons.length} icon={Ticket} accent="primary" />
        <StatCard label="WhatsApp sent" value={totalWhatsApp.toLocaleString()} icon={Send} accent="accent" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Monthly revenue</CardTitle><p className="text-xs text-muted-foreground">Last 7 months · ₹</p></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="revenue" fill="oklch(0.6 0.22 275)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Upcoming events</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <EventRow icon={<Cake className="h-4 w-4 text-primary" />} label="Today's birthdays" value={todaysBdays} />
            <EventRow icon={<Cake className="h-4 w-4 text-primary" />} label="Tomorrow's birthdays" value={tomorrowsBdays} />
            <EventRow icon={<Cake className="h-4 w-4 text-primary" />} label="This week's birthdays" value={weekBdays} />
            <EventRow icon={<Gift className="h-4 w-4 text-accent" />} label="Today's anniversaries" value={todaysAnni} />
            <EventRow icon={<Gift className="h-4 w-4 text-accent" />} label="Tomorrow's anniversaries" value={tomorrowsAnni} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Customer growth</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growth}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.17 165)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.7 0.17 165)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Area type="monotone" dataKey="customers" stroke="oklch(0.7 0.17 165)" fill="url(#cg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Business data</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="customers">
            <TabsList className="flex flex-wrap gap-1 rounded-full">
              <TabsTrigger value="customers" className="rounded-full">Customers</TabsTrigger>
              <TabsTrigger value="menu" className="rounded-full">{client.type === "Restaurant" ? "Menu" : "Services"}</TabsTrigger>
              <TabsTrigger value="campaigns" className="rounded-full">Campaigns</TabsTrigger>
              <TabsTrigger value="coupons" className="rounded-full">Coupons</TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-full">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="customers" className="mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Visits</TableHead><TableHead className="text-right">Spent</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {customers.slice(0, 8).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.phone}</TableCell>
                        <TableCell><Badge variant="outline" className="rounded-full text-[10px]">{c.status}</Badge></TableCell>
                        <TableCell className="text-right">{c.visits}</TableCell>
                        <TableCell className="text-right">₹{c.spent.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="menu" className="mt-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {menu.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <div className="flex items-center gap-2"><Utensils className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.category}</p></div></div>
                    <span className="font-medium">₹{m.price}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="campaigns" className="mt-4 space-y-2">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.channel} · {c.audience}</p></div>
                  <Badge variant="outline" className="rounded-full capitalize">{c.status}</Badge>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="coupons" className="mt-4 space-y-2">
              {coupons.map((cp) => (
                <div key={cp.code} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <div><p className="font-mono text-xs">{cp.code}</p><p className="text-xs text-muted-foreground">{cp.type} · {cp.discount}</p></div>
                  <span className="text-xs text-muted-foreground">{cp.used}/{cp.limit}</span>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="reviews" className="mt-4 space-y-2">
              {reviews.map((r, i) => (
                <div key={i} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between"><p className="font-medium">{r.customer}</p><p>{"⭐".repeat(r.rating)}</p></div>
                  <p className="mt-1 italic text-muted-foreground">"{r.comment}"</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-2xl border-destructive/30">
        <CardHeader><CardTitle className="font-display text-destructive">Danger zone</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => toast.warning("Account suspended (demo)")}><PauseCircle className="mr-1.5 h-4 w-4" /> Suspend account</Button>
          <Button variant="destructive" className="rounded-full" onClick={() => toast.error("Business deleted (demo)")}><Trash2 className="mr-1.5 h-4 w-4" /> Delete business</Button>
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function EventRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <div className="flex items-center gap-2">{icon}<span>{label}</span></div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}