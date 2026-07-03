import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  accountsQuery,
  contactsQuery,
  categoriesQuery,
  CASE_PRIORITIES,
  ISSUE_TYPES,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export function NewCaseDialog() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [issueType, setIssueType] = useState("");
  const [priority, setPriority] = useState("auto");
  const [errors, setErrors] = useState<{ subject?: string; description?: string }>({});

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery(accountsQuery);
  const { data: contacts } = useQuery(contactsQuery);
  const { data: categories } = useQuery(categoriesQuery);

  const accountContacts = (contacts ?? []).filter(
    (c) => !accountId || c.account_id === accountId,
  );

  const createCase = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .insert({
          subject: subject.trim(),
          description: description.trim(),
          account_id: accountId || null,
          contact_id: contactId || null,
          category_id: categoryId || null,
          issue_type: issueType || null,
          priority: priority === "auto" ? null : priority,
          status: "New",
        })
        .select("id, case_number")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.success(`Case ${data.case_number} created`, {
        description: "Priority, SLA due date and agent were assigned automatically.",
      });
      setOpen(false);
      resetForm();
      navigate({ to: "/cases/$caseId", params: { caseId: data.id } });
    },
    onError: (e: Error) => toast.error("Failed to create case", { description: e.message }),
  });

  function resetForm() {
    setSubject("");
    setDescription("");
    setAccountId("");
    setContactId("");
    setCategoryId("");
    setIssueType("");
    setPriority("auto");
    setErrors({});
  }

  function submit() {
    // Validation rules (mirrors Salesforce validation rules)
    const next: typeof errors = {};
    if (!subject.trim()) next.subject = "Subject cannot be blank.";
    if (!description.trim()) next.description = "Description cannot be blank.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    createCase.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New Case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Support Case</DialogTitle>
          <DialogDescription>
            Case number, priority, SLA due date and agent assignment are automated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
            />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full details of the customer issue"
              rows={4}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select
                value={accountId}
                onValueChange={(v) => {
                  setAccountId(v);
                  setContactId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {accountContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Support Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? [])
                    .filter((c) => c.active)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Issue Type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (from category)</SelectItem>
                  {CASE_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={submit} disabled={createCase.isPending}>
            {createCase.isPending ? "Creating…" : "Create Case"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
