import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { accountsQuery } from "@/lib/queries";
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

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts — AI Powered CST System" },
      { name: "description", content: "Customer accounts with related contacts and cases." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(accountsQuery);
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: RouteNotFound,
  component: AccountsPage,
});

function AccountsPage() {
  const { data: accounts } = useSuspenseQuery(accountsQuery);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Customer organizations — each account links to its contacts and cases
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Name</TableHead>
              <TableHead className="hidden md:table-cell">Industry</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Website</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
              <TableHead className="text-right">Cases</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="hidden md:table-cell">{a.industry ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{a.phone ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{a.website ?? "—"}</TableCell>
                <TableCell>{a.account_type}</TableCell>
                <TableCell className="text-right">{a.contacts?.[0]?.count ?? 0}</TableCell>
                <TableCell className="text-right">{a.cases?.[0]?.count ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
