import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINKS = [
  { to: "/", label: "Dashboard", exact: true },
  { to: "/scan", label: "Scan" },
  { to: "/programs", label: "Programs" },
  { to: "/customers", label: "Customers" },
  { to: "/offers", label: "Offers" },
  { to: "/locations", label: "Locations" },
] as const;

/** Every member page: the AppShell with the app's sections in its bar. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: "exact" in link }}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
