import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { slaPoliciesQuery } from "@/lib/queries";
import { PriorityBadge } from "@/components/badges";
import { RouteErrorFallback, RouteNotFound } from "@/components/route-fallbacks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/sla-policies")({
  head: () => ({
    meta: [
      { title: "SLA Policies — AI Powered CST System" },
      {
        name: "description",
        content: "Resolution time targets per priority that drive SLA due date automation.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(slaPoliciesQuery);
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: RouteNotFound,
  component: SlaPoliciesPage,
});

function SlaPoliciesPage() {
  const { data: policies } = useSuspenseQuery(slaPoliciesQuery);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">SLA Policies</h1>
        <p className="text-sm text-muted-foreground">
          Each case's SLA due date is calculated automatically from its priority's policy
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy Name</TableHead>
              <TableHead>Priority Level</TableHead>
              <TableHead>Resolution Time</TableHead>
              <TableHead>Escalation Required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.policy_name}</TableCell>
                <TableCell>
                  <PriorityBadge priority={p.priority_level} />
                </TableCell>
                <TableCell>{p.resolution_hours} hours</TableCell>
                <TableCell>
                  <Badge variant={p.escalation_required ? "destructive" : "secondary"}>
                    {p.escalation_required ? "Yes" : "No"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
