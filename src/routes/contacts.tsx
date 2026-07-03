import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { contactsQuery } from "@/lib/queries";
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

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — AI Powered CST System" },
      { name: "description", content: "Customer contacts linked to their accounts." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(contactsQuery);
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: RouteNotFound,
  component: ContactsPage,
});

function ContactsPage() {
  const { data: contacts } = useSuspenseQuery(contactsQuery);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          People at customer accounts who raise support cases
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="hidden md:table-cell">Title</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.first_name} {c.last_name}
                </TableCell>
                <TableCell>{c.account?.name ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{c.title ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{c.email ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{c.phone ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
