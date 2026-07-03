import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function RouteErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This section failed to load. Please try again.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold">Record not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The record you're looking for doesn't exist or was deleted.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
