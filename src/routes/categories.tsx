import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoriesQuery } from "@/lib/queries";
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

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Support Categories — AI Powered CST System" },
      {
        name: "description",
        content: "Support categories that drive automatic case priority assignment.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(categoriesQuery);
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: RouteNotFound,
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: categories } = useSuspenseQuery(categoriesQuery);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Support Categories</h1>
        <p className="text-sm text-muted-foreground">
          When a case is created without a priority, the category's default priority is applied
          automatically
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead>Default Priority</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="hidden max-w-md md:table-cell">
                  <span className="text-muted-foreground">{c.description ?? "—"}</span>
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={c.default_priority} />
                </TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Active" : "Inactive"}
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
