import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Ticket,
  Building2,
  Users,
  Tags,
  Timer,
  Sparkles,
  BarChart3,
  Radio,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/cases", label: "Cases", icon: Ticket },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/sla-policies", label: "SLA Policies", icon: Timer },
  { to: "/ai-feedback", label: "AI Feedback", icon: Sparkles },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Radio className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-sm font-bold text-sidebar-accent-foreground">
          AI Powered CST
        </p>
        <p className="text-[11px] text-sidebar-foreground">Telecom Support Console</p>
      </div>
    </div>
  );
}

function NavLinks({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <>
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: "exact" in item && item.exact }}
            activeProps={{
              className:
                "bg-sidebar-accent text-sidebar-primary font-semibold",
            }}
            inactiveProps={{
              className: "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            }}
            className={
              orientation === "vertical"
                ? "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
                : "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors"
            }
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-4 py-5">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <NavLinks orientation="vertical" />
        </nav>
        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-[11px] text-sidebar-foreground">
            Demo of a Salesforce-style AI ticketing system
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar md:hidden">
        <div className="px-4 py-3">
          <Brand />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
          <NavLinks orientation="horizontal" />
        </nav>
      </header>

      <main className="md:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
