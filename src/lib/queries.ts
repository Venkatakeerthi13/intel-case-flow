import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CASE_STATUSES = ["New", "In Progress", "Escalated", "Closed"] as const;
export const CASE_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export const ISSUE_TYPES = [
  "Network Outage",
  "Internet Speed",
  "Billing Dispute",
  "SIM Activation",
  "Roaming Issue",
  "Device Support",
  "Plan Change",
  "Technical",
] as const;
export const FEEDBACK_STATUSES = ["Accepted", "Modified", "Rejected"] as const;

export interface CaseRow {
  id: string;
  case_number: string | null;
  subject: string;
  description: string | null;
  status: string;
  priority: string | null;
  issue_type: string | null;
  account_id: string | null;
  contact_id: string | null;
  category_id: string | null;
  assigned_agent_id: string | null;
  sla_due_date: string | null;
  ai_suggested_response: string | null;
  resolution_time_hours: number | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  account: { name: string } | null;
  contact: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    title: string | null;
  } | null;
  category: { name: string } | null;
  agent: { name: string } | null;
}

export interface AccountRow {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  website: string | null;
  account_type: string;
  created_at: string;
  contacts: { count: number }[];
  cases: { count: number }[];
}

export interface ContactRow {
  id: string;
  account_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  created_at: string;
  account: { name: string } | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  default_priority: string;
  active: boolean;
  created_at: string;
}

export interface SlaPolicyRow {
  id: string;
  policy_name: string;
  priority_level: string;
  resolution_hours: number;
  escalation_required: boolean;
  created_at: string;
}

export interface AgentRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
}

export interface AiFeedbackRow {
  id: string;
  feedback_number: string | null;
  case_id: string;
  feedback_status: string;
  ai_suggestion_type: string | null;
  agent_comments: string | null;
  created_at: string;
  case: { case_number: string | null; subject: string } | null;
}

const CASE_SELECT =
  "*, account:accounts(name), contact:contacts(first_name,last_name,email,phone,title), category:support_categories(name), agent:agents(name)";

export const casesQuery = queryOptions({
  queryKey: ["cases"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("cases")
      .select(CASE_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as CaseRow[];
  },
});

export const caseQuery = (id: string) =>
  queryOptions({
    queryKey: ["cases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(CASE_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CaseRow) ?? null;
    },
  });

export const accountsQuery = queryOptions({
  queryKey: ["accounts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*, contacts(count), cases(count)")
      .order("name");
    if (error) throw error;
    return (data ?? []) as unknown as AccountRow[];
  },
});

export const contactsQuery = queryOptions({
  queryKey: ["contacts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*, account:accounts(name)")
      .order("last_name");
    if (error) throw error;
    return (data ?? []) as unknown as ContactRow[];
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("support_categories")
      .select("*")
      .order("name");
    if (error) throw error;
    return (data ?? []) as unknown as CategoryRow[];
  },
});

export const slaPoliciesQuery = queryOptions({
  queryKey: ["sla_policies"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("sla_policies")
      .select("*")
      .order("resolution_hours");
    if (error) throw error;
    return (data ?? []) as unknown as SlaPolicyRow[];
  },
});

export const agentsQuery = queryOptions({
  queryKey: ["agents"],
  queryFn: async () => {
    const { data, error } = await supabase.from("agents").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as unknown as AgentRow[];
  },
});

export const aiFeedbackQuery = queryOptions({
  queryKey: ["ai_feedback"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("ai_feedback")
      .select("*, case:cases(case_number, subject)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as AiFeedbackRow[];
  },
});

export function isSlaViolated(c: CaseRow): boolean {
  if (!c.sla_due_date) return false;
  if (c.status === "Closed") {
    return c.closed_at ? new Date(c.closed_at) > new Date(c.sla_due_date) : false;
  }
  return new Date() > new Date(c.sla_due_date);
}

export function contactName(c: CaseRow["contact"]): string {
  return c ? `${c.first_name} ${c.last_name}` : "—";
}
