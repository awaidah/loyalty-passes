import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/errors";
import { formatDateTime } from "@/client/lib/format";
import { createOffer, endOffer, getOffers } from "@/serverFunctions/offers";

export const Route = createFileRoute("/offers")({
  loader: () => getOffers(),
  head: () => ({ meta: [{ title: "Offers" }] }),
  component: Offers,
});

const STATUS = {
  scheduled: { label: "Scheduled", variant: "info" },
  active: { label: "Active", variant: "success" },
  ended: { label: "Ended", variant: "secondary" },
} as const;

const ALL = "all";

function Offers() {
  const { admin, offers, programs } = Route.useLoaderData();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function end() {
    if (!ending) return;
    setPending(true);
    try {
      await endOffer({ data: { id: ending } });
      await router.invalidate();
      setEnding(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title="Offers"
        actions={
          admin ? (
            <Button data-testid="offer-new" onClick={() => setCreating(true)}>
              New offer
            </Button>
          ) : null
        }
      />
      {offers.length === 0 ? (
        <EmptyState title="No offers yet" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {offers.map((o) => (
            <li key={o.id} data-testid="offer-row" className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{o.title}</span>
                  <Badge data-testid="offer-status" variant={STATUS[o.status].variant}>
                    {STATUS[o.status].label}
                  </Badge>
                </div>
                <p className="text-sm">{o.body}</p>
                <p className="text-xs text-muted-foreground">
                  {o.programName ?? "All programs"} · {formatDateTime(o.startsAt)}
                  {o.endsAt ? ` – ${formatDateTime(o.endsAt)}` : ""}
                </p>
              </div>
              {admin && o.status !== "ended" ? (
                <Button size="sm" variant="outline" data-testid="offer-end" onClick={() => setEnding(o.id)}>
                  End now
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <OfferDialog
          programs={programs}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            await router.invalidate();
            setCreating(false);
          }}
        />
      ) : null}
      {ending ? (
        <ConfirmDialog title="End this offer now?" confirmLabel="End offer" confirmTestId="confirm-end" pending={pending} onClose={() => setEnding(null)} onConfirm={end}>
          It disappears from passes right away.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}

function OfferDialog({
  programs,
  onClose,
  onSaved,
}: {
  programs: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [programId, setProgramId] = useState<string>(ALL);
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const items = [{ value: ALL, label: "All programs" }, ...programs.map((p) => ({ value: p.id, label: p.name }))];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createOffer({
        data: {
          title,
          body,
          programId: programId === ALL ? null : programId,
          startsAt: starts ? new Date(starts).toISOString() : null,
          endsAt: ends ? new Date(ends).toISOString() : null,
        },
      });
      await onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <FormDialog
      title="New offer"
      onClose={onClose}
      actions={
        <Button type="submit" form="offer-form" data-testid="offer-save" pending={pending}>
          Publish
        </Button>
      }
    >
      <form id="offer-form" onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="offer-title">Title</Label>
          <Input id="offer-title" data-testid="offer-title" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="offer-body">Message</Label>
          <Textarea id="offer-body" data-testid="offer-body" required maxLength={500} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Program</Label>
          <Select items={items} value={programId} onValueChange={(v) => setProgramId((v as string) ?? ALL)}>
            <SelectTrigger data-testid="offer-program" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="offer-starts">Starts</Label>
            <Input id="offer-starts" data-testid="offer-starts" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-ends">Ends (optional)</Label>
            <Input id="offer-ends" data-testid="offer-ends" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Leave Starts empty to publish now.</p>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </FormDialog>
  );
}
