import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { errorMessage } from "@/client/lib/errors";
import { createLocation, getLocations, updateLocation } from "@/serverFunctions/locations";

export const Route = createFileRoute("/locations")({
  loader: () => getLocations(),
  head: () => ({ meta: [{ title: "Locations" }] }),
  component: Locations,
});

function Locations() {
  const { admin, locations } = Route.useLoaderData();
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [archiving, setArchiving] = useState<{ id: string; name: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function run(key: string, work: () => Promise<unknown>) {
    setPending(key);
    try {
      await work();
      await router.invalidate();
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setPending(null);
    }
  }

  return (
    <Page>
      <PageHeader title="Locations" />
      {admin ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("add", () => createLocation({ data: { name } }))) setName("");
          }}
        >
          <Input aria-label="Location name" placeholder="Location name" data-testid="location-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" data-testid="location-add" pending={pending === "add"}>
            Add
          </Button>
        </form>
      ) : null}
      {locations.length === 0 ? (
        <EmptyState title="No locations yet" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {locations.map((l) => (
            <li key={l.id} data-testid="location-row" data-id={l.id} className="flex flex-wrap items-center gap-2 p-3">
              {editing?.id === l.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run(l.id, () => updateLocation({ data: { id: l.id, name: editing.name } }))) setEditing(null);
                  }}
                >
                  <Input aria-label="New name" data-testid="location-rename-input" autoFocus required maxLength={80} value={editing.name} onChange={(e) => setEditing({ id: l.id, name: e.target.value })} />
                  <Button type="submit" size="sm" data-testid="location-rename-save" pending={pending === l.id}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-medium">{l.name}</span>
                  {l.status === "archived" ? <Badge variant="secondary">Archived</Badge> : null}
                  {admin ? (
                    <>
                      <Button size="sm" variant="ghost" data-testid="location-rename" onClick={() => setEditing({ id: l.id, name: l.name })}>
                        Rename
                      </Button>
                      {l.status === "active" ? (
                        <Button size="sm" variant="ghost" data-testid="location-archive" onClick={() => setArchiving({ id: l.id, name: l.name })}>
                          Archive
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" pending={pending === l.id} onClick={() => run(l.id, () => updateLocation({ data: { id: l.id, status: "active" } }))}>
                          Restore
                        </Button>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {archiving ? (
        <ConfirmDialog
          title={`Archive ${archiving.name}?`}
          confirmLabel="Archive"
          confirmTestId="confirm-archive"
          pending={pending === "archive"}
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            if (await run("archive", () => updateLocation({ data: { id: archiving.id, status: "archived" } }))) setArchiving(null);
          }}
        >
          It leaves the scanner's list.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
