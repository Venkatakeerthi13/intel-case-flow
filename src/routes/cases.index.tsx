import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { casesQuery, isSlaViolated, CASE_STATUSES, CASE_PRIORITIES } from "@/lib/queries";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { NewCaseDialog } from "@/components/new-case-dialog";
import { RouteErrorFallback, RouteNotFound } from "@/components/route-fallbacks";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Search } from "lucide-react";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Cases — AI Powered CST System" },
      {
        name: "description",
        content: "Browse, filter and manage all customer support cases with SLA tracking.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(casesQuery);
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: RouteNotFound,
  component: CasesPage,
});

function CasesPage() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const filtered = cases.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (priority !== "all" && c.priority !== priority) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${c.case_number} ${c.subject} ${c.account?.name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cases</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {cases.length} cases
          </p>
        </div>
        <NewCaseDialog />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case #, subject, account…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CASE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {CASE_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case #</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="hidden md:table-cell">Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="hidden lg:table-cell">Agent</TableHead>
              <TableHead className="hidden lg:table-cell">SLA Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const violated = isSlaViolated(c);
              return (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: c.id }}
                      className="text-primary hover:underline"
                    >
                      {c.case_number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{c.subject}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {c.account?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={c.priority} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{c.agent?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.sla_due_date ? (
                      <span
                        className={
                          violated ? "flex items-center gap-1 text-destructive" : undefined
                        }
                      >
                        {violated && <AlertTriangle className="h-3.5 w-3.5" />}
                        {format(new Date(c.sla_due_date), "MMM d, HH:mm")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No cases match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
