import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { casesQuery, agentsQuery, isSlaViolated } from "@/lib/queries";
import { RouteErrorFallback, RouteNotFound } from "@/components/route-fallbacks";
import { Ticket, CheckCircle2, Timer, Gauge } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AI Powered CST System" },
      {
        name: "description",
        content: "Live overview of open cases, SLA compliance, priorities and agent performance.",
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
  component: Dashboard,
});

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "var(--chart-5)",
  High: "var(--chart-4)",
  Medium: "var(--chart-1)",
  Low: "var(--chart-2)",
};

function Dashboard() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const { data: agents } = useSuspenseQuery(agentsQuery);

  const open = cases.filter((c) => c.status !== "Closed");
  const closed = cases.filter((c) => c.status === "Closed");
  const closedWithinSla = closed.filter((c) => !isSlaViolated(c));
  const slaCompliance = closed.length
    ? Math.round((closedWithinSla.length / closed.length) * 100)
    : 100;
  const avgResolution = closed.length
    ? (
        closed.reduce((sum, c) => sum + (c.resolution_time_hours ?? 0), 0) / closed.length
      ).toFixed(1)
    : "—";

  const priorityData = ["Critical", "High", "Medium", "Low"]
    .map((p) => ({ name: p, value: open.filter((c) => c.priority === p).length }))
    .filter((d) => d.value > 0);

  const categoryCounts = new Map<string, number>();
  for (const c of cases) {
    const name = c.category?.name ?? "Uncategorized";
    categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  }
  const categoryData = Array.from(categoryCounts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count,
  );

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM") };
  });
  const trendData = months.map((m) => ({
    month: m.label,
    Created: cases.filter((c) => format(new Date(c.created_at), "yyyy-MM") === m.key).length,
    Closed: cases.filter(
      (c) => c.closed_at && format(new Date(c.closed_at), "yyyy-MM") === m.key,
    ).length,
  }));

  const agentData = agents
    .filter((a) => a.role === "Support Agent")
    .map((a) => ({
      name: a.name.split(" ")[0],
      Open: open.filter((c) => c.assigned_agent_id === a.id).length,
      Closed: closed.filter((c) => c.assigned_agent_id === a.id).length,
    }));

  const kpis = [
    { label: "Open Cases", value: open.length, icon: Ticket, tone: "text-info" },
    { label: "Closed Cases", value: closed.length, icon: CheckCircle2, tone: "text-success" },
    { label: "SLA Compliance", value: `${slaCompliance}%`, icon: Gauge, tone: "text-primary" },
    { label: "Avg Resolution (hrs)", value: avgResolution, icon: Timer, tone: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Real-time view of your telecom support operation
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-muted p-2.5">
                <k.icon className={`h-5 w-5 ${k.tone}`} />
              </div>
              <div>
                <p className="text-2xl font-bold leading-tight">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Created" stroke="var(--chart-1)" strokeWidth={2} />
                <Line type="monotone" dataKey="Closed" stroke="var(--chart-3)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Cases by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cases by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={11} width={130} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Open" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Closed" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
