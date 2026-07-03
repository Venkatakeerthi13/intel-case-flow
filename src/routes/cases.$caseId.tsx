import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateCaseReply } from "@/lib/ai.functions";
import {
  caseQuery,
  agentsQuery,
  isSlaViolated,
  contactName,
  CASE_STATUSES,
  CASE_PRIORITIES,
  FEEDBACK_STATUSES,
} from "@/lib/queries";
import { StatusBadge, PriorityBadge, SlaBadge } from "@/components/badges";
import { RouteErrorFallback, RouteNotFound } from "@/components/route-fallbacks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Sparkles, Save, Loader2 } from "lucide-react";

interface FeedbackRow {
  id: string;
  feedback_number: string | null;
  feedback_status: string;
  ai_suggestion_type: string | null;
  agent_comments: string | null;
  created_at: string;
}

const caseFeedbackQuery = (caseId: string) =>
  queryOptions({
    queryKey: ["ai_feedback", "case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_feedback")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FeedbackRow[];
    },
  });

export const Route = createFileRoute("/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case Detail — AI Powered CST System" },
      { name: "description", content: "Work a support case with AI-suggested responses." },
    ],
  }),
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(caseQuery(params.caseId));
    if (!c) throw notFound();
    await context.queryClient.ensureQueryData(caseFeedbackQuery(params.caseId));
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: RouteNotFound,
  component: CaseDetail,
});

function CaseDetail() {
  const { caseId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: caseData } = useSuspenseQuery(caseQuery(caseId));
  // Loader throws notFound() when the case doesn't exist, so caseData is non-null here.
  const c = caseData!;
  const { data: feedback } = useSuspenseQuery(caseFeedbackQuery(caseId));
  const { data: agents } = useQuery(agentsQuery);

  const [draft, setDraft] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState("Accepted");
  const [comments, setComments] = useState("");

  const updateCase = useMutation({
    mutationFn: async (fields: {
      status?: string;
      priority?: string;
      assigned_agent_id?: string;
    }) => {
      const { error } = await supabase.from("cases").update(fields).eq("id", caseId);
      if (error) throw error;
      return fields;
    },
    onSuccess: (fields) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      if ("status" in fields && fields.status === "Closed") {
        toast.success("Case closed", {
          description:
            "Closure automation ran: close time stamped, resolution hours calculated, resolution email sent to the customer.",
        });
      } else {
        toast.success("Case updated");
      }
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  const generate = useMutation({
    mutationFn: () =>
      generateCaseReply({
        data: {
          caseNumber: c.case_number ?? "N/A",
          subject: c.subject,
          description: c.description,
          issueType: c.issue_type,
          priority: c.priority,
          customerName: c.contact ? `${c.contact.first_name} ${c.contact.last_name}` : null,
          accountName: c.account?.name ?? null,
          slaDueDate: c.sla_due_date,
        },
      }),
    onSuccess: async (res) => {
      setDraft(res.reply);
      const { error } = await supabase
        .from("cases")
        .update({ ai_suggested_response: res.reply })
        .eq("id", c.id);
      if (error) {
        toast.error("Generated, but failed to save", { description: error.message });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.success("AI response generated and saved to the case");
    },
    onError: (e: Error) =>
      toast.error("AI generation failed", {
        description: e.message.includes("429")
          ? "Rate limit reached — please try again in a moment."
          : e.message.includes("402")
            ? "AI credits exhausted — add credits in workspace settings."
            : e.message,
      }),
  });

  const saveResponse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cases")
        .update({ ai_suggested_response: responseText })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.success("Response saved to case");
    },
    onError: (e: Error) => toast.error("Save failed", { description: e.message }),
  });

  const logFeedback = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_feedback").insert({
        case_id: c.id,
        feedback_status: feedbackStatus,
        ai_suggestion_type: "Customer Reply",
        agent_comments: comments.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_feedback"] });
      queryClient.invalidateQueries({ queryKey: ["ai_feedback", "case", c.id] });
      setComments("");
      toast.success("AI feedback logged");
    },
    onError: (e: Error) => toast.error("Failed to log feedback", { description: e.message }),
  });

  const responseText = draft ?? c.ai_suggested_response ?? "";
  const violated = isSlaViolated(c);

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/cases"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to cases
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{c.case_number}</h1>
          <StatusBadge status={c.status} />
          <PriorityBadge priority={c.priority} />
          {c.sla_due_date && <SlaBadge violated={violated} />}
        </div>
        <p className="mt-1 text-lg text-muted-foreground">{c.subject}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Case Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Status">
                <Select
                  value={c.status}
                  onValueChange={(v) => updateCase.mutate({ status: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select
                  value={c.priority ?? "Medium"}
                  onValueChange={(v) => updateCase.mutate({ priority: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Assigned Agent">
                <Select
                  value={c.assigned_agent_id ?? ""}
                  onValueChange={(v) => updateCase.mutate({ assigned_agent_id: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {(agents ?? [])
                      .filter((a) => a.active)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Issue Type">{c.issue_type ?? "—"}</Field>
              <Field label="Category">{c.category?.name ?? "—"}</Field>
              <Field label="Created">{format(new Date(c.created_at), "MMM d, yyyy HH:mm")}</Field>
              <Field label="SLA Due Date">
                {c.sla_due_date ? (
                  <span className={violated ? "font-medium text-destructive" : undefined}>
                    {format(new Date(c.sla_due_date), "MMM d, yyyy HH:mm")}
                  </span>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Closed At">
                {c.closed_at ? format(new Date(c.closed_at), "MMM d, yyyy HH:mm") : "—"}
              </Field>
              <Field label="Resolution Time">
                {c.resolution_time_hours != null ? `${c.resolution_time_hours} hrs` : "—"}
              </Field>
            </div>
            <Separator />
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </p>
              <p className="whitespace-pre-wrap text-sm">{c.description ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Account">{c.account?.name ?? "—"}</Field>
            <Field label="Contact">{contactName(c.contact)}</Field>
            <Field label="Title">{c.contact?.title ?? "—"}</Field>
            <Field label="Email">{c.contact?.email ?? "—"}</Field>
            <Field label="Phone">{c.contact?.phone ?? "—"}</Field>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Suggested Response
          </CardTitle>
          <Button
            size="sm"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate with AI
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={responseText}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Click “Generate with AI” to draft a professional customer reply based on the issue type, priority and description."
            rows={8}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveResponse.mutate()}
              disabled={!responseText || saveResponse.isPending}
            >
              <Save className="h-4 w-4" /> Save Response
            </Button>
            <Separator orientation="vertical" className="hidden h-8 sm:block" />
            <div className="space-y-1">
              <Label className="text-xs">Feedback</Label>
              <Select value={feedbackStatus} onValueChange={setFeedbackStatus}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-48 flex-1 space-y-1">
              <Label className="text-xs">Agent comments</Label>
              <Input
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="How was the AI suggestion?"
                className="h-8"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => logFeedback.mutate()}
              disabled={!responseText || logFeedback.isPending}
            >
              Log Feedback
            </Button>
          </div>

          {feedback.length > 0 && (
            <div className="space-y-2 rounded-md bg-muted/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AI Feedback History
              </p>
              {feedback.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{f.feedback_number}</span>
                  <StatusBadge status={f.feedback_status} />
                  <span className="text-muted-foreground">
                    {f.agent_comments ?? "No comments"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(f.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
