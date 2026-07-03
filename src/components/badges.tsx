import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const statusStyles: Record<string, string> = {
  New: "bg-info/10 text-info border-info/25",
  "In Progress": "bg-warning/10 text-warning border-warning/25",
  Escalated: "bg-destructive/10 text-destructive border-destructive/25",
  Closed: "bg-success/10 text-success border-success/25",
};

const priorityStyles: Record<string, string> = {
  Critical: "bg-destructive text-destructive-foreground border-transparent",
  High: "bg-warning/15 text-warning border-warning/30",
  Medium: "bg-info/10 text-info border-info/25",
  Low: "bg-muted text-muted-foreground border-transparent",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(base, statusStyles[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn(base, priorityStyles[priority] ?? "bg-muted text-muted-foreground")}>
      {priority}
    </span>
  );
}

export function SlaBadge({ violated }: { violated: boolean }) {
  return (
    <span
      className={cn(
        base,
        violated
          ? "bg-destructive/10 text-destructive border-destructive/25"
          : "bg-success/10 text-success border-success/25",
      )}
    >
      {violated ? "SLA Violated" : "Within SLA"}
    </span>
  );
}
