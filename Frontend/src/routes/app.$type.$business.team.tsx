import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { teamMembers } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$type/$business/team")({ component: TeamPage });

function TeamPage() {
  return (
    <>
      <PageHeader title="Team members" description="Employees, roles, permissions and attendance."
        actions={<Button size="sm" className="rounded-full gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Invite member</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teamMembers.map((m) => (
          <Card key={m.name} className="rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-glow">
            <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
              <Avatar className="h-12 w-12"><AvatarFallback className="gradient-brand text-primary-foreground">{m.initials}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.role} · {m.email}</p>
              </div>
              <Badge variant="outline" className={cn("rounded-full capitalize", m.status === "active" ? "border-success/40 text-success" : "border-warning/40 text-warning-foreground")}>{m.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}