import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Page } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatDay } from "@/client/lib/format";
import { getCustomers } from "@/serverFunctions/customers";

const search = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.enum(["name", "visits", "last", "joined"]).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/customers/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCustomers({ data: deps }),
  head: () => ({ meta: [{ title: "Customers" }] }),
  component: Customers,
});

type Sort = "name" | "visits" | "last" | "joined";

function Customers() {
  const data = Route.useLoaderData();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/customers/" });
  const [q, setQ] = useState(s.q ?? "");
  const sort = s.sort ?? "last";
  const dir = s.dir ?? (sort === "name" ? "asc" : "desc");
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  function header(key: Sort, label: string, className?: string) {
    const active = sort === key;
    const next = active && dir === "desc" ? "asc" : active ? "desc" : key === "name" ? "asc" : "desc";
    return (
      <TableHead className={className}>
        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => navigate({ search: { ...s, sort: key, dir: next, page: undefined } })}>
          {label}
          {active ? dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : null}
        </button>
      </TableHead>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Customers"
        actions={
          data.admin ? (
            <>
              {(["customers", "passes", "visits"] as const).map((kind) => (
                <Button key={kind} variant="outline" size="sm" nativeButton={false} data-testid={`export-${kind}`} render={<a href={`/api/export/${kind}.csv`} download />}>
                  <Download /> {kind[0]!.toUpperCase() + kind.slice(1)} CSV
                </Button>
              ))}
            </>
          ) : null
        }
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ search: { ...s, q: q.trim() || undefined, page: undefined } });
        }}
      >
        <Input type="search" placeholder="Search by name, email or phone" aria-label="Search customers" data-testid="customer-search" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {data.customers.length === 0 ? (
        <EmptyState kind={s.q ? "filtered" : "no-data"} title={s.q ? "No customers match" : "No customers yet"} description={s.q ? undefined : "Customers appear here when they join a program."} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {header("name", "Name")}
                  <TableHead>Passes</TableHead>
                  {header("visits", "Visits", "text-right")}
                  {header("last", "Last visit")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.customers.map((c) => (
                  <TableRow key={c.id} data-testid="customer-row">
                    <TableCell>
                      <Link to="/customers/$customerId" params={{ customerId: c.id }} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.contact ? <div className="text-xs text-muted-foreground">{c.contact}</div> : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.passes.map((p) => (
                        <div key={p.id}>
                          {p.programName} <span className="text-muted-foreground">· {p.balance}</span>
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums" data-testid="customer-visits">
                      {c.visits}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.lastVisit ? formatDay(c.lastVisit) : "Never"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pages > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">
                Page {data.page} of {pages}
              </span>
              <Button variant="outline" size="sm" disabled={data.page <= 1} data-testid="page-prev" onClick={() => navigate({ search: { ...s, page: data.page - 1 } })}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={data.page >= pages} data-testid="page-next" onClick={() => navigate({ search: { ...s, page: data.page + 1 } })}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Page>
  );
}
