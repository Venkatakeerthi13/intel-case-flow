import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { aiFeedbackQuery } from "@/lib/queries";
import { StatusBadge } from "@/components/badges";
import { RouteErrorFallback, RouteNotFound } from "@/components/route-fallbacks";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/ai-feedback")({
  head: () => ({
    meta: [
      { title: "AI Feedback — AI Powered CST System" },
      {
        name: "description",
        content: "Agent feedback on AI-suggested responses, linked to support cases.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(aiFeedbackQuery);
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: RouteNotFound,
  component: AiFeedbackPage,
});

function AiFeedbackPage() {
  const { data: feedback } = useSuspenseQuery(aiFeedbackQuery);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">AI Feedback</h1>
        <p className="text-sm text-muted-foreground">
          How agents rated AI-suggested responses — used to measure AI quality
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feedback #</TableHead>
              <TableHead>Case</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Suggestion Type</TableHead>
              <TableHead className="hidden lg:table-cell">Agent Comments</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedback.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.feedback_number}</TableCell>
                <TableCell>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: f.case_id }}
                    className="text-primary hover:underline"
                  >
                    {f.case?.case_number ?? "—"}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={f.feedback_status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {f.ai_suggestion_type ?? "—"}
                </TableCell>
                <TableCell className="hidden max-w-md truncate lg:table-cell">
                  {f.agent_comments ?? "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {format(new Date(f.created_at), "MMM d, yyyy")}
                </TableCell>
              </TableRow>
            ))}
            {feedback.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No AI feedback yet. Generate an AI response on a case and log feedback.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
