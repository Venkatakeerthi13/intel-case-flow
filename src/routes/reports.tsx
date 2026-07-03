import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { casesQuery, agentsQuery, isSlaViolated, type CaseRow } from "@/lib/queries";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { RouteErrorFallback, RouteNotFound } from "@/components/route-fallbacks";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — AI Powered CST System" },
      {
        name: "description",
        content:
          "Operational reports: open cases, closed cases, priorities, categories, SLA violations and agent performance.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(casesQuery),
      context.queryClient.ensureQueryData(agentsQuery),
    ]);
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: RouteNotFound,
  component: ReportsPage,
});

function CaseTable({ rows, showResolution }: { rows: CaseRow[]; showResolution?: boolean }) {
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case #</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead className="hidden md:table-cell">Account</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead className="hidden md:table-cell">
              {showResolution ? "Resolution (hrs)" : "SLA Due"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: c.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {c.case_number}
                </Link>
              </TableCell>
              <TableCell className="max-w-64 truncate">{c.subject}</TableCell>
              <TableCell className="hidden md:table-cell">{c.account?.name ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={c.priority} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {showResolution
                  ? (c.resolution_time_hours ?? "—")
                  : c.sla_due_date
                    ? format(new Date(c.sla_due_date), "MMM d, HH:mm")
                    : "—"}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                No records.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function ReportsPage() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const { data: agents } = useSuspenseQuery(agentsQuery);

  const open = cases.filter((c) => c.status !== "Closed");
  const closed = cases.filter((c) => c.status === "Closed");
  const violations = cases.filter(isSlaViolated);

  const byPriority = ["Critical", "High", "Medium", "Low"].map((p) => {
    const rows = cases.filter((c) => c.priority === p);
    return { priority: p, total: rows.length, open: rows.filter((c) => c.status !== "Closed").length };
  });

  const categoryMap = new Map<string, { total: number; open: number; violated: number }>();
  for (const c of cases) {
    const key = c.category?.name ?? "Uncategorized";
    const entry = categoryMap.get(key) ?? { total: 0, open: 0, violated: 0 };
    entry.total++;
    if (c.status !== "Closed") entry.open++;
    if (isSlaViolated(c)) entry.violated++;
    categoryMap.set(key, entry);
  }

  const agentRows = agents
    .filter((a) => a.role === "Support Agent")
    .map((a) => {
      const mine = cases.filter((c) => c.assigned_agent_id === a.id);
      const mineClosed = mine.filter((c) => c.status === "Closed");
      const avg = mineClosed.length
        ? (
            mineClosed.reduce((s, c) => s + (c.resolution_time_hours ?? 0), 0) /
            mineClosed.length
          ).toFixed(1)
        : "—";
      const withinSla = mineClosed.filter((c) => !isSlaViolated(c)).length;
      return {
        ...a,
        openCount: mine.length - mineClosed.length,
        closedCount: mineClosed.length,
        avgResolution: avg,
        slaRate: mineClosed.length
          ? `${Math.round((withinSla / mineClosed.length) * 100)}%`
          : "—",
      };
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Operational reports across cases, SLAs and agents
        </p>
      </div>

      <Tabs defaultValue="open">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="open">Open Cases ({open.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed Cases ({closed.length})</TabsTrigger>
          <TabsTrigger value="priority">By Priority</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="sla">SLA Violations ({violations.length})</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          <CaseTable rows={open} />
        </TabsContent>
        <TabsContent value="closed" className="mt-4">
          <CaseTable rows={closed} showResolution />
        </TabsContent>

        <TabsContent value="priority" className="mt-4">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Total Cases</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPriority.map((r) => (
                  <TableRow key={r.priority}>
                    <TableCell>
                      <PriorityBadge priority={r.priority} />
                    </TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.open}</TableCell>
                    <TableCell className="text-right">{r.total - r.open}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="mt-4">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total Cases</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">SLA Violations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(categoryMap, ([name, s]) => ({ name, ...s }))
                  .sort((a, b) => b.total - a.total)
                  .map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.open}</TableCell>
                      <TableCell className="text-right">
                        {r.violated > 0 ? (
                          <span className="font-medium text-destructive">{r.violated}</span>
                        ) : (
                          0
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="mt-4">
          <CaseTable rows={violations} />
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                  <TableHead className="text-right">Avg Resolution (hrs)</TableHead>
                  <TableHead className="text-right">SLA Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{a.email}</TableCell>
                    <TableCell className="text-right">{a.openCount}</TableCell>
                    <TableCell className="text-right">{a.closedCount}</TableCell>
                    <TableCell className="text-right">{a.avgResolution}</TableCell>
                    <TableCell className="text-right">{a.slaRate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
