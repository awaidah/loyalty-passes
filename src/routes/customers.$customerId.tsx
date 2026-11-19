import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { errorMessage } from "@/client/lib/errors";
import { formatDateTime, formatDay } from "@/client/lib/format";
import { getCustomer, revokePass } from "@/serverFunctions/customers";

export const Route = createFileRoute("/customers/$customerId")({
  loader: ({ params }) => getCustomer({ data: { id: params.customerId } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.customer.name }] : [] }),
  component: CustomerPage,
});

function describe(h: { kind: string; amount: number; note: string | null; programType: string }) {
  switch (h.kind) {
    case "stamp":
      return `+${h.amount} ${h.amount === 1 ? "stamp" : "stamps"}`;
    case "points":
      return `+${h.amount} points${h.note ? ` (${h.note})` : ""}`;
    case "checkin":
      return "Check-in";
    default:
      return `Redeemed${h.note ? `: ${h.note}` : ""}${h.programType === "points" ? ` (−${h.amount} points)` : ""}`;
  }
}

function CustomerPage() {
  const { admin, userId, customer, passes, history } = Route.useLoaderData();
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function revoke() {
    if (!revoking) return;
    setPending("revoke");
    try {
      await revokePass({ data: { passId: revoking } });
      await router.invalidate();
      setRevoking(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function undo(id: string) {
    setPending(id);
    try {
      const res = await fetch(`/api/visits/${id}/undo`, { method: "POST" });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "That didn't work.");
      await router.invalidate();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  const recentCutoff = Date.now() - 10 * 60 * 1000;

  return (
    <Page>
      <PageHeader
        title={<span data-testid="customer-name">{customer.name}</span>}
        backLink={
          <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Customers
          </Link>
        }
        description={[customer.email, customer.phone, `Joined ${formatDay(customer.createdAt)}`].filter(Boolean).join(" · ")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {passes.map((p) => (
          <Card key={p.id} data-testid="customer-pass" size="sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <Link to="/programs/$programId" params={{ programId: p.programId }} className="hover:underline">
                  {p.programName}
                </Link>
                {p.view.stateLabel ? <Badge variant="destructive">{p.view.stateLabel}</Badge> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-lg font-semibold tabular-nums">{p.view.balance}</div>
              <div className="text-muted-foreground">Code {p.code}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" nativeButton={false} render={<a href={`/p/${p.token}`} target="_blank" rel="noreferrer" />}>
                  Open pass
                </Button>
                {admin && p.status === "active" ? (
                  <Button size="sm" variant="ghost" data-testid="pass-revoke" onClick={() => setRevoking(p.id)}>
                    Cancel pass
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visits yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h, i) => {
                  const own = h.staffUserId === userId && Date.parse(h.createdAt) > recentCutoff;
                  const latestOnPass = history.findIndex((x) => x.programName === h.programName && !x.undone) === i;
                  return (
                    <TableRow key={h.id} data-testid="history-row" className={h.undone ? "text-muted-foreground" : undefined}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(h.createdAt)}</TableCell>
                      <TableCell>{h.programName}</TableCell>
                      <TableCell className={h.undone ? "line-through" : undefined}>{describe(h)}</TableCell>
                      <TableCell>{h.location ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{h.staffEmail}</TableCell>
                      <TableCell className="text-right">
                        {h.undone ? (
                          <Badge variant="secondary">Undone</Badge>
                        ) : admin || (own && latestOnPass) ? (
                          <Button size="xs" variant="ghost" data-testid="history-undo" pending={pending === h.id} onClick={() => undo(h.id)}>
                            Undo
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      {revoking ? (
        <ConfirmDialog title="Cancel this pass?" confirmLabel="Cancel pass" confirmTestId="confirm-revoke" destructive pending={pending === "revoke"} onClose={() => setRevoking(null)} onConfirm={revoke}>
          The customer can no longer use it, and this can't be reversed.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
